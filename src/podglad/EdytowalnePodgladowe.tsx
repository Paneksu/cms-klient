"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { pobierzPatch, subskrybujPatch } from "./magazynPatchy";
import { ZRODLO_WIADOMOSCI_CMS, type WiadomoscRamkaDoPanelu } from "./kontrakt";
import { PrzyciskEdycji } from "./PrzyciskEdycji";

/**
 * Implementacja klikalnego pola w podglądzie — RENDEROWANA WYŁĄCZNIE przez `Edytowalne.tsx`,
 * WYŁĄCZNIE gdy `tryb === "podglad"` (patrz komentarz tam po uzasadnienie "zero kosztu poza
 * podglądem"). Nigdy nie importować/renderować stąd bezpośrednio z kodu sekcji — `Edytowalne`
 * jest jedynym dozwolonym wejściem.
 *
 * `NEXT_PUBLIC_CMS_EDYTOR_ORIGIN` musi być USTAWIONE, żeby cokolwiek poleciało do panelu —
 * bez niego (błąd konfiguracji Coolify) `wyslij()` cicho nic nie robi zamiast rzucać, bo
 * podgląd MA dalej działać jako zwykła strona nawet bez łączności z panelem (redaktor zobaczy
 * po prostu, że klikanie nic nie otwiera — gorsze niż crash całej ramki).
 */
function originPanelu(): string | undefined {
  return process.env.NEXT_PUBLIC_CMS_EDYTOR_ORIGIN;
}

function wyslijDoPanelu(wiadomosc: WiadomoscRamkaDoPanelu): void {
  if (typeof window === "undefined" || window.parent === window) return; // nie jesteśmy w ramce
  const origin = originPanelu();
  if (!origin) return;
  window.parent.postMessage(wiadomosc, origin);
}

export function EdytowalnePodgladowe({
  pole,
  typ,
  sekcja,
  children,
}: {
  pole: string;
  typ: string;
  sekcja: string;
  children: ReactNode;
}) {
  // `cms:patch` nadpisuje wyświetlaną wartość na żywo, bez przeładowania (zlecenie, punkt 7).
  // `useSyncExternalStore` zamiast `useState`+`useEffect` — magazyn jest zewnętrznym singletonem
  // (patrz `magazynPatchy.ts`), więc to dokładnie ten hook, do którego React go zaprojektował.
  const patch = useSyncExternalStore(
    (fn) => subskrybujPatch(pole, fn),
    () => pobierzPatch(pole),
    () => undefined // serwer: nigdy nie renderujemy tej gałęzi (patrz Edytowalne.tsx), ale hook wymaga snapshotu SSR
  );

  // Urządzenia dotykowe nie mają hover — bez tego redaktor na telefonie nie miałby JAK trafić
  // w niewielki fragment tekstu, żeby go otworzyć do edycji (zlecenie, punkt 8 zakresu).
  const [dotykowy, setDotykowy] = useState(false);
  useEffect(() => {
    setDotykowy(window.matchMedia("(hover: none)").matches);
  }, []);

  // Punkt 2c zakresu: na desktopie klik w tekst wewnątrz linku/przycisku strony JEST
  // przechwytywany (`preventDefault` w `klik()` niżej) — technicznie nie nawiguje — ale
  // redaktor tego nie wie i boi się kliknąć. Rozwiązanie: pokazać tę samą plakietkę ✎, którą
  // dotykowe urządzenia mają zawsze, także na desktopie PRZY NAJECHANIU, ale tylko dla pól
  // faktycznie zagnieżdżonych w elemencie nawigującym — zwykły akapit dostaje wyłącznie
  // `cursor: pointer`, żeby nie zaśmiecać podglądu plakietką przy każdym zdaniu.
  const refSpan = useRef<HTMLSpanElement>(null);
  const [wewnatrzLinku, setWewnatrzLinku] = useState(false);
  const [najechany, setNajechany] = useState(false);
  useEffect(() => {
    setWewnatrzLinku(!!refSpan.current?.closest("a[href], button"));
  }, []);

  function klik(e: { preventDefault: () => void; stopPropagation: () => void }) {
    // preventDefault+stopPropagation: pole bywa zagnieżdżone w `<a>`/`<button>` strony (np.
    // `ctaGlowne` wewnątrz przycisku CTA) — kliknięcie ma otworzyć pole w panelu, NIE
    // nawigować ani przewijać do kotwicy linku.
    e.preventDefault();
    e.stopPropagation();
    wyslijDoPanelu({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:klik", pole, typPola: typ, sekcja });
  }

  function hover(aktywne: boolean) {
    setNajechany(aktywne);
    wyslijDoPanelu({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:hover", pole: aktywne ? pole : null });
  }

  // Na dotyku pokazujemy plakietkę ZAWSZE (jedyny sposób trafić palcem w mały fragment
  // tekstu) — dla myszy tylko, gdy pole jest w linku/przycisku I jest najechane. `position:
  // relative` ustawiamy zawsze (nie tylko dla dotyku jak wcześniej): to jedyny sposób, żeby
  // plakietka desktopowa miała się względem czego pozycjonować, i nie ma wpływu na layout.
  const pokazPlakietke = dotykowy || (wewnatrzLinku && najechany);

  return (
    <span
      ref={refSpan}
      data-cms-pole={pole}
      data-cms-sekcja={sekcja}
      data-cms-typ={typ}
      onClick={klik}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      style={{ cursor: "pointer", position: "relative" }}
    >
      {patch ?? children}
      {pokazPlakietke && <PrzyciskEdycji etykieta="Edytuj to pole" onKlik={klik} />}
    </span>
  );
}
