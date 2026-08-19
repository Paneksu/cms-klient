import type { ReactNode } from "react";
import { EdytowalnyObrazPodgladowe } from "./EdytowalnyObrazPodgladowe";

/**
 * Oznacza JEDNO pole typu `obraz` jako klikalne w podglądzie (punkt 7a zakresu) — odpowiednik
 * `Edytowalne.tsx` dla zdjęć zamiast tekstu, ta sama para plik-cienki-wrapper / plik-klienta
 * i z tego samego powodu: poza podglądem (`tryb !== "podglad"`) zwraca `children` BEZ
 * ŻADNEGO opakowania — zero `<span>`, zero `data-cms-*`, i `EdytowalnyObrazPodgladowe`
 * (komponent kliencki z hookami) nigdy nie trafia do wyrenderowanego drzewa opublikowanej
 * strony, więc RSC nie wysyła jego chunku JS do przeglądarki odwiedzającej `/`.
 */
export function EdytowalnyObraz({
  pole,
  sekcja,
  tryb,
  children,
}: {
  /** Pełna ścieżka pola obrazkowego, np. `"galeria.elementy.0.zdjecie"`. */
  pole: string;
  sekcja: string;
  tryb: "opublikowana" | "podglad";
  children: ReactNode;
}) {
  if (tryb !== "podglad") return <>{children}</>;
  return (
    <EdytowalnyObrazPodgladowe pole={pole} sekcja={sekcja}>
      {children}
    </EdytowalnyObrazPodgladowe>
  );
}
