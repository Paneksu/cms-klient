"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ZRODLO_WIADOMOSCI_CMS, type WiadomoscRamkaDoPanelu } from "./kontrakt";
import { PrzyciskEdycji } from "./PrzyciskEdycji";

/**
 * Wariant `Edytowalne` dla pól typu `obraz` (punkt 7a zakresu). `Edytowalne`/
 * `EdytowalnePodgladowe` opakowują dzieci TEKSTOWE w `<span>`, który sam jest widocznym
 * pudełkiem inline — dobrym nośnikiem dla `data-cms-pole`. Dziecko tu jest zawsze `<Image>`
 * (blokowy element z własnym rozmiarem/`fill`), więc zdjęcia w ogóle NIE MIAŁY żadnego
 * znacznika w DOM strony (`Edytowalne.tsx` w ogóle nie renderował się dla pól obrazkowych) —
 * redaktor klikał zdjęcie w podglądzie i nic się nie działo.
 *
 * ROZWIĄZANIE ŚWIADOMIE OPISANE (wymóg zlecenia): wrapper dostaje `display: contents` — znika
 * z drzewa LAYOUTU (nie dokłada własnego pudełka, nie psuje `fill`/proporcji obrazka), ale
 * ZOSTAJE w drzewie DOM (więc `data-cms-pole` jest znajdowalny przez `querySelector`) i nadal
 * przechwytuje zdarzenia (bąbelkowanie z `<Image>` działa normalnie przez element
 * `display: contents`). Konsekwencja uboczna: `getBoundingClientRect()` na TYM elemencie
 * zwraca sam prostokąt zerowy — nie ma własnego pudełka do zmierzenia. `PodgladNasluch.tsx`
 * (przez `wyborElementu.ts`, `prostokatElementu()`) o tym wie i w takim wypadku mierzy
 * pierwsze dziecko o niezerowym rozmiarze zamiast samego wrappera — podświetlenie i tak
 * trafia w faktycznie widoczny obrazek, nie w zero×zero.
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

export function EdytowalnyObrazPodgladowe({
  pole,
  sekcja,
  children,
}: {
  /** Pełna ścieżka pola obrazkowego, np. `"galeria.elementy.0.zdjecie"`. */
  pole: string;
  sekcja: string;
  children: ReactNode;
}) {
  // Urządzenia dotykowe nie mają hover — ten sam mechanizm co `EdytowalnePodgladowe.tsx`
  // (punkt 2c): bez tego redaktor na telefonie nie miałby jak trafić w samo zdjęcie.
  const [dotykowy, setDotykowy] = useState(false);
  useEffect(() => {
    setDotykowy(window.matchMedia("(hover: none)").matches);
  }, []);
  const [najechany, setNajechany] = useState(false);

  function klik(e: { preventDefault: () => void; stopPropagation: () => void }) {
    // Zdjęcia w Gallery/BeforeAfter siedzą wewnątrz `<button>` (otwiera lightbox) —
    // dokładnie ta sama sytuacja co tekst wewnątrz linku w `EdytowalnePodgladowe.tsx`: klik
    // w podglądzie ma otworzyć pole w panelu, NIE uruchamiać zachowanie rodzica.
    e.preventDefault();
    e.stopPropagation();
    wyslijDoPanelu({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:klik", pole, typPola: "obraz", sekcja });
  }

  return (
    <span
      data-cms-pole={pole}
      data-cms-sekcja={sekcja}
      data-cms-typ="obraz"
      onClick={klik}
      onMouseEnter={() => setNajechany(true)}
      onMouseLeave={() => setNajechany(false)}
      style={{ display: "contents", cursor: "pointer" }}
    >
      {children}
      {(dotykowy || najechany) && <PrzyciskEdycji etykieta="Zmień zdjęcie" onKlik={klik} wariant="obraz" />}
    </span>
  );
}
