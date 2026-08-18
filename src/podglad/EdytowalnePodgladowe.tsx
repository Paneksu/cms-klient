"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { pobierzPatch, subskrybujPatch } from "./magazynPatchy";
import { ZRODLO_WIADOMOSCI_CMS, type WiadomoscRamkaDoPanelu } from "./kontrakt";

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

  function klik(e: { preventDefault: () => void; stopPropagation: () => void }) {
    // preventDefault+stopPropagation: pole bywa zagnieżdżone w `<a>`/`<button>` strony (np.
    // `ctaGlowne` wewnątrz przycisku CTA) — kliknięcie ma otworzyć pole w panelu, NIE
    // nawigować ani przewijać do kotwicy linku.
    e.preventDefault();
    e.stopPropagation();
    wyslijDoPanelu({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:klik", pole, typPola: typ, sekcja });
  }

  function hover(aktywne: boolean) {
    wyslijDoPanelu({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:hover", pole: aktywne ? pole : null });
  }

  return (
    <span
      data-cms-pole={pole}
      data-cms-sekcja={sekcja}
      data-cms-typ={typ}
      onClick={klik}
      onMouseEnter={() => hover(true)}
      onMouseLeave={() => hover(false)}
      style={{ cursor: "pointer", position: dotykowy ? "relative" : undefined }}
    >
      {patch ?? children}
      {dotykowy && (
        <button
          type="button"
          aria-label="Edytuj to pole"
          onClick={klik}
          style={{
            position: "absolute",
            top: "-0.5rem",
            insetInlineEnd: "-0.5rem",
            width: "1.35rem",
            height: "1.35rem",
            borderRadius: "999px",
            border: "1px solid #fff",
            background: "#FEBD59",
            color: "#141815",
            fontSize: "0.68rem",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2147483000,
          }}
        >
          ✎
        </button>
      )}
    </span>
  );
}
