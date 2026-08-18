import type { ReactNode } from "react";
import { EdytowalnePodgladowe } from "./EdytowalnePodgladowe";

/**
 * Oznacza JEDNO pole tekstowe jako klikalne w podglądzie — faza 3 planu, część 2, punkt 4
 * zakresu. `pole` jest PEŁNĄ ścieżką w tej samej konwencji co `sciezkaPola` w panelu
 * (`lib/tresc.ts`, `zapiszPole`) — np. `"hero.naglowekLinia1"`, `"proces.kroki.0.opis"` — żeby
 * `cms:klik` mógł polecieć do panelu bez żadnego mapowania pośredniego.
 *
 * CELOWO nie jest komponentem klienckim samo w sobie: to zwykła funkcja, więc poza podglądem
 * (`tryb !== "podglad"`) zwraca `children` BEZ ŻADNEGO opakowania — zero `<span>`, zero
 * atrybutów `data-cms-*`, zero handlerów. To jest sedno wymogu zlecenia ("zero kosztu w
 * produkcyjnym HTML") w DWÓCH warstwach naraz: żaden atrybut nie trafia do wyrenderowanego
 * znacznika `/`, i — bo `EdytowalnePodgladowe` (komponent kliencki z hookami) jest importowany,
 * ale NIGDY nie renderowany na tej gałęzi — Next.js nie ma powodu wysyłać jego chunku JS do
 * przeglądarki odwiedzającej `/` (RSC wysyła tylko chunki elementów faktycznie obecnych w
 * wyrenderowanym drzewie, nie wszystkiego, co moduł IMPORTUJE).
 */
export function Edytowalne({
  pole,
  typ,
  sekcja,
  tryb,
  children,
}: {
  /** Pełna ścieżka pola, np. `"hero.naglowekLinia1"`. */
  pole: string;
  /** Typ pola ze schematu (`"tekst" | "tekst_dlugi" | "bogaty" | …`) — niesiony w `cms:klik`, żeby panel wiedział, jaki formularz otworzyć, bez ponownego odpytywania schematu. */
  typ: string;
  /** Id sekcji nadrzędnej — osobno od `pole`, bo `cms:klik` niesie je jako osobne pole wiadomości (kontrakt zlecenia). */
  sekcja: string;
  tryb: "opublikowana" | "podglad";
  children: ReactNode;
}) {
  if (tryb !== "podglad") return <>{children}</>;
  return (
    <EdytowalnePodgladowe pole={pole} typ={typ} sekcja={sekcja}>
      {children}
    </EdytowalnePodgladowe>
  );
}
