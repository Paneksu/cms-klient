/**
 * Wybór właściwego elementu DOM po ścieżce pola CMS — wyodrębnione z `PodgladNasluch.tsx`
 * (poprawka "podświetlenie nie podąża za elementem", punkt 2b zakresu), bo dwa niezależne
 * problemy wymagały tej samej logiki wyboru:
 *
 * 1. **Duplikaty selektora.** `document.querySelector(...)` bierze PIERWSZY pasujący element.
 *    `ddcarspa.pl/components/Pricing.tsx` renderuje te same ścieżki pól dwukrotnie (wariant
 *    desktop i mobilny — jeden zawsze ukryty przez klasy `hidden`/`lg:*`), więc branie
 *    pierwszego dopasowania trafiało czasem w wariant ukryty: prostokąt 0×0.
 * 2. **`display:contents` (`EdytowalnyObraz.tsx`, punkt 7a).** Taki element sam nie ma
 *    żadnego pudełka do zmierzenia — `getBoundingClientRect()` zwraca same zera, mimo że
 *    dziecko (obrazek) jest w pełni widoczne.
 *
 * Oba problemy sprowadzają się do jednego pytania: "jaki jest FAKTYCZNY, niezerowy prostokąt
 * tego pola na ekranie" — stąd wspólny moduł zamiast dwóch osobnych łatek.
 */

export type Prostokat = { top: number; left: number; width: number; height: number };

/** Czysta funkcja (bez DOM) — testowalna bez `jsdom`, w przeciwieństwie do reszty modułu.
 *  Zwraca indeks pierwszego prostokąta z niezerowym rozmiarem, a gdy żaden taki nie istnieje —
 *  `0` (odwrót do pierwszego elementu: lepszy zły prostokąt niż żaden, wywołujący i tak musi
 *  coś pokazać). Dla pustej tablicy zwraca `-1`. */
export function pierwszyWidocznyIndeks(prostokaty: readonly Prostokat[]): number {
  if (prostokaty.length === 0) return -1;
  const indeks = prostokaty.findIndex((r) => r.width > 0 && r.height > 0);
  return indeks === -1 ? 0 : indeks;
}

/** Wszystkie elementy strony oznaczone daną ścieżką pola — patrz punkt 1 komentarza modułu,
 *  nigdy nie zakładamy jednego dopasowania. */
export function wszystkieDopasowania(pole: string): Element[] {
  if (typeof document === "undefined") return [];
  return Array.from(document.querySelectorAll(`[data-cms-pole="${CSS.escape(pole)}"]`));
}

/**
 * Prostokąt elementu z obejściem `display:contents` (punkt 2 komentarza modułu wyżej): taki
 * element nie ma własnego pudełka, więc schodzimy do pierwszego dziecka, aż trafimy na coś
 * z realnym rozmiarem. Bezpiecznik `8` poziomów w dół — w praktyce `EdytowalnyObraz` ma jeden
 * poziom zagnieżdżenia (wrapper → `<Image>`), zapas jest na wypadek dodatkowego opakowania
 * w przyszłości, nie na nieskończoną pętlę po źle zbudowanym drzewie.
 */
export function prostokatElementu(el: Element): Prostokat {
  let cel: Element = el;
  for (let poziom = 0; poziom < 8; poziom++) {
    const r = cel.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
    if (!cel.firstElementChild) {
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }
    cel = cel.firstElementChild;
  }
  const r = cel.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/** Spośród wszystkich elementów pasujących do ścieżki pola zwraca ten, którego prostokąt
 *  `pierwszyWidocznyIndeks` wybrałby jako właściwy — `null`, gdy pole w ogóle zniknęło z DOM
 *  (lista wywołująca ma wtedy schować podświetlenie, nie zostawiać sieroty). */
export function elementWidoczny(pole: string): Element | null {
  const dopasowania = wszystkieDopasowania(pole);
  if (dopasowania.length === 0) return null;
  const prostokaty = dopasowania.map(prostokatElementu);
  const indeks = pierwszyWidocznyIndeks(prostokaty);
  return dopasowania[indeks] ?? null;
}

/** Czy prostokąt (choćby częściowo) leży w aktualnie widocznym oknie przeglądarki — używane
 *  przy `cms:podswietl` na pole poza ekranem, żeby najpierw do niego przewinąć (dziś ramka
 *  rysowała się poza widokiem). Prostokąt zerowy (pole niewidoczne) traktujemy jako "poza
 *  widokiem", nie ma sensu przewijać do czegoś bez rozmiaru. */
export function czyWObszarzeWidoku(r: Prostokat): boolean {
  if (r.width === 0 && r.height === 0) return false;
  if (typeof window === "undefined") return true;
  return r.top < window.innerHeight && r.top + r.height > 0 && r.left < window.innerWidth && r.left + r.width > 0;
}

