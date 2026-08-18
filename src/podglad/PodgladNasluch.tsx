"use client";

import { useEffect, useRef, useState } from "react";
import { ustawPatch } from "./magazynPatchy";
import { DEBOUNCE_PATCH_MS, ZRODLO_WIADOMOSCI_CMS, jestWiadomosciaCms, type WiadomoscRamkaDoPanelu } from "./kontrakt";

type Prostokat = { top: number; left: number; width: number; height: number };

/**
 * Mostek ramka↔panel — jeden na całą stronę, montowany przez `StronaGlowna` WYŁĄCZNIE w
 * `tryb="podglad"` (faza 3 planu, część 2, punkty 6–7 zakresu). Trzy obowiązki w jednym
 * miejscu celowo (nie trzy osobne komponenty): nasłuch `message`, wysyłka `cms:gotowy` /
 * `cms:wysokosc` przy starcie, i JEDNA nakładka podświetlenia — rozbicie na osobne komponenty
 * wymagałoby współdzielenia stanu prostokąta między nimi i tak, więc nie uprościłoby niczego.
 *
 * `event.origin` sprawdzany wobec `NEXT_PUBLIC_CMS_EDYTOR_ORIGIN` PRZED odczytaniem czegokolwiek
 * z `event.data` — bez tego dowolna inna ramka/skrypt na stronie mogłaby podesłać `cms:patch`
 * i nadpisać wyświetlaną treść. Brak zmiennej środowiskowej = KOMUNIKACJA WYŁĄCZONA (nie
 * "zaufaj każdemu originowi") — patrz ostrzeżenie w konsoli niżej.
 */
export function PodgladNasluch() {
  const [prostokat, setProstokat] = useState<Prostokat | null>(null);
  const debounceRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

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

    function znajdzProstokat(pole: string): Prostokat | null {
      const el = document.querySelector(`[data-cms-pole="${CSS.escape(pole)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
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
          setProstokat(pole ? znajdzProstokat(pole) : null);
          return;
        }
        case "cms:przewin": {
          if (typeof dane.pole !== "string") return;
          document
            .querySelector(`[data-cms-pole="${CSS.escape(dane.pole)}"]`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        case "cms:przeladuj":
          window.location.reload();
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

    // `cms:wysokosc` przy każdej zmianie wysokości dokumentu — panel dopasowuje wysokość
    // `<iframe>`, żeby uniknąć podwójnego paska przewijania (zewnętrzny panelu + wewnętrzny
    // ramki). Próg 4px odrzuca szum subpikselowy z animacji framer-motion.
    let ostatnia = 0;
    const obserwator = new ResizeObserver(() => {
      const wysokosc = document.documentElement.scrollHeight;
      if (Math.abs(wysokosc - ostatnia) < 4) return;
      ostatnia = wysokosc;
      wyslij({ zrodlo: ZRODLO_WIADOMOSCI_CMS, typ: "cms:wysokosc", px: wysokosc });
    });
    obserwator.observe(document.documentElement);

    return () => {
      window.removeEventListener("message", obsluzWiadomosc);
      obserwator.disconnect();
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
