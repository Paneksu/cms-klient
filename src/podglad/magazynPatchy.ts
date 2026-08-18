"use client";

/**
 * Magazyn wartości "na żywo" nadpisanych przez `cms:patch` (panel→ramka) — singleton modułowy,
 * nie React Context. Uzasadnienie "gustu" (raport zlecenia, faza 3 część 2): jedna karta
 * przeglądarki = jedna instancja tego modułu, więc singleton jest wystarczający i prostszy niż
 * Provider, którego trzeba by owinąć wokół całego drzewa `StronaGlowna` — a to zmusiłoby
 * `<Sekcja>`/`<Edytowalne>` do bycia komponentami klienckimi WSZĘDZIE, łamiąc "zero kosztu poza
 * podglądem" (patrz komentarz na górze `Edytowalne.tsx`).
 */

type Sluchacz = () => void;

const wartosci = new Map<string, string>();
const sluchacze = new Map<string, Set<Sluchacz>>();

export function ustawPatch(pole: string, wartosc: string): void {
  wartosci.set(pole, wartosc);
  sluchacze.get(pole)?.forEach((fn) => fn());
}

export function pobierzPatch(pole: string): string | undefined {
  return wartosci.get(pole);
}

/** Do `useSyncExternalStore` w `EdytowalnePodgladowe.tsx`. Zwraca funkcję odsubskrybowującą. */
export function subskrybujPatch(pole: string, fn: Sluchacz): () => void {
  let zbior = sluchacze.get(pole);
  if (!zbior) {
    zbior = new Set();
    sluchacze.set(pole, zbior);
  }
  zbior.add(fn);
  return () => zbior?.delete(fn);
}
