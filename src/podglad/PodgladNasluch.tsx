"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ustawPatch } from "./magazynPatchy";
import { DEBOUNCE_PATCH_MS, ZRODLO_WIADOMOSCI_CMS, jestWiadomosciaCms, type WiadomoscRamkaDoPanelu } from "./kontrakt";
import { czyWObszarzeWidoku, elementWidoczny, prostokatElementu, type Prostokat } from "./wyborElementu";

/**
 * Mostek ramka↔panel — jeden na całą stronę, montowany przez `StronaGlowna` WYŁĄCZNIE w
 * `tryb="podglad"` (faza 3 planu, część 2, punkty 6–7 zakresu). Trzy obowiązki w jednym
 * miejscu celowo (nie trzy osobne komponenty): nasłuch `message`, wysyłka `cms:gotowy`
 * przy starcie, i JEDNA nakładka podświetlenia — rozbicie na osobne komponenty
 * wymagałoby współdzielenia stanu prostokąta między nimi i tak, więc nie uprościłoby niczego.
 *
 * `event.origin` sprawdzany wobec `NEXT_PUBLIC_CMS_EDYTOR_ORIGIN` PRZED odczytaniem czegokolwiek
 * z `event.data` — bez tego dowolna inna ramka/skrypt na stronie mogłaby podesłać `cms:patch`
 * i nadpisać wyświetlaną treść. Brak zmiennej środowiskowej = KOMUNIKACJA WYŁĄCZONA (nie
 * "zaufaj każdemu originowi") — patrz ostrzeżenie w konsoli niżej.
 *
 * PODĄŻANIE PODŚWIETLENIA ZA ELEMENTEM (poprawka, punkt 2 zakresu): dawniej prostokąt liczył
 * się RAZ, w chwili odebrania `cms:podswietl` — nakładka jest `position: fixed`, więc przy
 * `scroll-behavior: smooth` i animacjach wejścia sekcji (framer-motion) element odjeżdżał,
 * a ramka zostawała przyklejona do starej pozycji. Zwykły listener `scroll` tego nie pokrywa
 * (animacje transformują element bez zdarzenia scrollu okna). Jedyne, co faktycznie nadąża,
 * to przeliczanie w pętli `requestAnimationFrame`, dopóki podświetlenie jest aktywne —
 * uruchamiana WYŁĄCZNIE gdy jest co śledzić i zatrzymywana natychmiast, gdy podświetlenie
 * gaśnie albo pole zniknie z DOM.
 *
 * KOSZT BATERII (poprawka z code review, tryb edycji na pełnym ekranie): podświetlenie w tym
 * trybie potrafi świecić długo (redaktor trzyma pole otwarte w szufladzie), a każda klatka
 * pętli robi `querySelectorAll` + `getBoundingClientRect` na wszystkich dopasowaniach — 60
 * razy na sekundę reflow, nawet gdy element stoi w bezruchu. Pętla zatrzymuje się po
 * `CZAS_BEZCZYNNOSCI_STOP_MS` bez zmiany prostokąta i wznawia się na `scroll`/`resize` okna
 * albo na `ResizeObserver` śledzonego elementu — więc animacje i przewijanie nadal są
 * pokryte, ale bezruch faktycznie kosztuje zero klatek, nie 60/s.
 *
 * ŻYWA AKTUALIZACJA POZA TEKSTEM (punkt 4 zakresu): `cms:patch` niesie wyłącznie stringi —
 * liczba, przełącznik, obraz, link i całe tablice list nie mają odpowiednika w kontrakcie.
 * Dla nich panel, PO UDANYM ZAPISIE, wysyła `cms:odswiez`, obsłużone tu przez
 * `useRouter().refresh()` (nie `window.location.reload()`) — `refresh()` re-pobiera drzewo RSC
 * zachowując pozycję przewinięcia i stan komponentów klienckich, więc redaktor nie traci
 * miejsca w formularzu ani nie widzi mignięcia całej strony. Trasa `/podglad/robocza` jest
 * `force-dynamic` i pobiera dokument bez cache, więc `refresh()` zawsze zobaczy świeże dane.
 * `cms:przeladuj` zostaje osobno dla zmian wymagających twardego przeładowania (kolejność/
 * widoczność sekcji).
 */
/** Po tylu milisekundach bez zmiany prostokąta pętla śledzenia się zatrzymuje (patrz komentarz
 *  „KOSZT BATERII” u góry pliku). */
const CZAS_BEZCZYNNOSCI_STOP_MS = 1000;

export function PodgladNasluch() {
  const [prostokat, setProstokat] = useState<Prostokat | null>(null);
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // `PodgladNasluch` jest montowany przez `StronaGlowna` wewnątrz drzewa strony App Router
  // (patrz `ddcarspa.pl/components/StronaGlowna.tsx`), więc kontekst routera zawsze istnieje —
  // `useRouter()` tutaj jest bezpieczne. Sam `refresh()` i tak wołamy przez ref w efekcie, żeby
  // nie zmieniać tożsamości `obsluzWiadomosc` przy każdej nawigacji.
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // Ścieżka AKTUALNIE śledzonego pola — nie tylko jego prostokąt. Pętla rAF w każdej klatce
  // odczytuje TĘ ścieżkę na nowo z DOM (przez `elementWidoczny`), więc nadąża też za zmianą
  // widoczności duplikatów selektora (punkt 2b: warianty desktop/mobile w `Pricing.tsx`) przy
  // zmianie szerokości okna w trakcie podświetlenia.
  const aktywnePoleRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const ostatniProstokatRef = useRef<Prostokat | null>(null);
  // Znacznik czasu ostatniej FAKTYCZNEJ zmiany prostokąta — pętla zatrzymuje się, gdy stoi bez
  // zmian dłużej niż `CZAS_BEZCZYNNOSCI_STOP_MS`, i wznawia na zdarzenie, nie po czasie.
  const ostatniaZmianaRef = useRef<number>(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const nasluchujeWznowieniaRef = useRef(false);

  useEffect(() => {
    const originPanelu = process.env.NEXT_PUBLIC_CMS_EDYTOR_ORIGIN;
    if (!originPanelu) {
      console.warn(
        "[cms-podglad] brak NEXT_PUBLIC_CMS_EDYTOR_ORIGIN — nasłuch wiadomości z panelu WYŁĄCZONY (klikanie w elementy nie zadziała)."
      );
      return;
    }

    function wyslij(wiadomosc: WiadomoscRamkaDoPanelu) {
      if (window.parent === window) return; // nie jesteśmy w ramce — nic do wysłania
      window.parent.postMessage(wiadomosc, originPanelu as string);
    }

    function zatrzymajSledzenie() {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }

    // Zdejmuje nasłuch wznawiający ("czy coś się poruszyło, mimo że pętla stoi") — wołane
    // zarówno przy faktycznym wznowieniu pętli, jak i przy całkowitym zgaszeniu podświetlenia.
    function przestanCzekacNaWznowienie() {
      if (!nasluchujeWznowieniaRef.current) return;
      window.removeEventListener("scroll", wznowSledzenie, true);
      window.removeEventListener("resize", wznowSledzenie);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      nasluchujeWznowieniaRef.current = false;
    }

    function schowajPodswietlenie() {
      zatrzymajSledzenie();
      przestanCzekacNaWznowienie();
      aktywnePoleRef.current = null;
      ostatniProstokatRef.current = null;
      setProstokat(null);
    }

    // Pętla stoi bez zmian prostokąta dłużej niż `CZAS_BEZCZYNNOSCI_STOP_MS` — zamiast dalej
    // kręcić klatki w bezruchu, czekamy na zdarzenie, które faktycznie może przesunąć element:
    // scroll okna (capture, żeby złapać scroll dowolnego przewijanego kontenera, nie tylko
    // `window`), resize okna i `ResizeObserver` na samym elemencie (łapie zmiany rozmiaru bez
    // scrolla/resize — np. sąsiedni element zmieniający wysokość i przesuwający ten).
    function czekajNaWznowienie() {
      if (nasluchujeWznowieniaRef.current) return;
      nasluchujeWznowieniaRef.current = true;
      window.addEventListener("scroll", wznowSledzenie, true);
      window.addEventListener("resize", wznowSledzenie);
      const pole = aktywnePoleRef.current;
      const el = pole ? elementWidoczny(pole) : null;
      if (el && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => wznowSledzenie());
        ro.observe(el);
        resizeObserverRef.current = ro;
      }
    }

    function wznowSledzenie() {
      przestanCzekacNaWznowienie();
      if (rafRef.current !== null || !aktywnePoleRef.current) return; // już się kręci / nic do śledzenia
      ostatniaZmianaRef.current = performance.now();
      rafRef.current = requestAnimationFrame(krokSledzenia);
    }

    // Jedna klatka śledzenia: zmierz na nowo, uaktualnij nakładkę TYLKO gdy prostokąt
    // faktycznie się zmienił (bez tego każda klatka wywoływałaby re-render nakładki nawet w
    // bezruchu). Element zniknięty z DOM (usunięta pozycja listy, zmiana sekcji) chowa
    // podświetlenie zamiast zostawiać sierotę wskazującą pustkę. Bez zmiany przez
    // `CZAS_BEZCZYNNOSCI_STOP_MS` — pętla się zatrzymuje i czeka na zdarzenie
    // (`czekajNaWznowienie` wyżej) zamiast kręcić kolejne klatki bez powodu.
    function krokSledzenia() {
      rafRef.current = null;
      const pole = aktywnePoleRef.current;
      if (!pole) return;
      const el = elementWidoczny(pole);
      if (!el) {
        schowajPodswietlenie();
        return;
      }
      const r = prostokatElementu(el);
      const poprzedni = ostatniProstokatRef.current;
      const zmienil =
        !poprzedni ||
        poprzedni.top !== r.top ||
        poprzedni.left !== r.left ||
        poprzedni.width !== r.width ||
        poprzedni.height !== r.height;
      if (zmienil) {
        ostatniProstokatRef.current = r;
        setProstokat(r);
        ostatniaZmianaRef.current = performance.now();
      }
      if (performance.now() - ostatniaZmianaRef.current >= CZAS_BEZCZYNNOSCI_STOP_MS) {
        czekajNaWznowienie();
        return;
      }
      rafRef.current = requestAnimationFrame(krokSledzenia);
    }

    function rozpocznijSledzenie(pole: string) {
      przestanCzekacNaWznowienie();
      aktywnePoleRef.current = pole;
      ostatniProstokatRef.current = null;
      ostatniaZmianaRef.current = performance.now();
      zatrzymajSledzenie();
      krokSledzenia();
    }

    function obsluzWiadomosc(event: MessageEvent) {
      if (event.origin !== originPanelu) return;
      if (!jestWiadomosciaCms(event.data)) return;
      const dane = event.data as { typ: string; pole?: unknown; wartosc?: unknown };

      switch (dane.typ) {
        case "cms:patch": {
          if (typeof dane.pole !== "string" || typeof dane.wartosc !== "string") return;
          const pole = dane.pole;
          const wartosc = dane.wartosc;
          const timeouty = debounceRef.current;
          const istniejacy = timeouty.get(pole);
          if (istniejacy) clearTimeout(istniejacy);
          timeouty.set(
            pole,
            setTimeout(() => {
              ustawPatch(pole, wartosc);
              timeouty.delete(pole);
            }, DEBOUNCE_PATCH_MS)
          );
          return;
        }
        case "cms:podswietl": {
          const pole = typeof dane.pole === "string" ? dane.pole : null;
          if (!pole) {
            schowajPodswietlenie();
            return;
          }
          // Pole poza widokiem: przewinąć do niego NAJPIERW (dawniej ramka rysowała się poza
          // ekranem) — pętla rAF uruchomiona zaraz niżej dogoni pozycję w trakcie płynnego
          // przewijania, bez osobnej obsługi animacji scrolla.
          const el = elementWidoczny(pole);
          if (el && !czyWObszarzeWidoku(prostokatElementu(el))) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          rozpocznijSledzenie(pole);
          return;
        }
        case "cms:przewin": {
          if (typeof dane.pole !== "string") return;
          elementWidoczny(dane.pole)?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        case "cms:przeladuj":
          window.location.reload();
          return;
        case "cms:odswiez":
          try {
            routerRef.current.refresh();
          } catch {
            // Awaryjnie: brak kontekstu routera (nie powinno się zdarzyć, patrz komentarz
            // przy `PodgladNasluch`) — twarde przeładowanie zamiast ciszy.
            window.location.reload();
          }
          return;
      }
    }

    window.addEventListener("message", obsluzWiadomosc);

    // `cms:gotowy` RAZ, po zamontowaniu — lista sekcji obecnych na stronie, wynik skanu DOM
    // (nie kopia z dokumentu), żeby panel widział to, co FAKTYCZNIE się wyrenderowało.
    const sekcje = Array.from(
      new Set(
        Array.from(document.querySelectorAll("[data-cms-sekcja]"))
          .map((el) => el.getAttribute("data-cms-sekcja"))
          .filter((v): v is string => !!v)
      )
    );
    wyslij({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:gotowy", sekcje });

    return () => {
      window.removeEventListener("message", obsluzWiadomosc);
      zatrzymajSledzenie();
      przestanCzekacNaWznowienie();
      for (const t of debounceRef.current.values()) clearTimeout(t);
      debounceRef.current.clear();
    };
  }, []);

  if (!prostokat) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        pointerEvents: "none",
        top: prostokat.top - 3,
        left: prostokat.left - 3,
        width: prostokat.width + 6,
        height: prostokat.height + 6,
        border: "2px solid #FEBD59",
        borderRadius: "4px",
        boxShadow: "0 0 0 1px rgba(20,24,21,0.35)",
        zIndex: 2147483647,
      }}
    />
  );
}
