/**
 * Widoczność pól w formularzu panelu (punkt 6a planu przycięcia zakresu edycji, 20.08.2026).
 *
 * Osobny plik, NIE dopisek do `walidacja.ts`: tamten ciągnie `zod` i odpowiada za NAPRAWĘ
 * danych (uzupełnianie brakujących pól, przycinanie nadmiarowych elementów listy) — to tutaj
 * jest czysta PREZENTACJA schematu, zero zależności, bezpieczne w bundlu klienta.
 *
 * Pole dostaje `ukryte: true` w schemacie (`typy.ts`, `PoleWspolne.ukryte`), ale ZOSTAJE
 * w schemacie i w dokumencie — patrz komentarz przy tej fladze o tym, dlaczego nie wolno
 * pól usuwać. Funkcje tutaj tylko DECYDUJĄ, co ma prawo wyrenderować kontrolkę.
 */

import type { Pole, SchematPol, SekcjaDefinicja } from "./typy";

/**
 * Czy pole ma być widoczne w formularzu. Rekurencyjnie: `grupa`/`lista` bez ANI JEDNEGO
 * widocznego dziecka są same niewidoczne — dzięki temu `<fieldset>`/`<legend>` takiej grupy
 * znika razem z zawartością, zamiast zostać osieroconą pustą ramką z etykietą bez pól w środku.
 */
export function czyPoleWidoczne(p: Pole): boolean {
  if (p.ukryte === true) return false;
  if (p.typ === "grupa") {
    return Object.values(p.pola).some(czyPoleWidoczne);
  }
  if (p.typ === "lista") {
    return Object.values(p.elementSchema).some(czyPoleWidoczne);
  }
  return true;
}

/** Wpisy `SchematPol` ograniczone do widocznych pól, z zachowaniem kolejności kluczy. */
export function widoczneWpisy(pola: SchematPol): [string, Pole][] {
  return Object.entries(pola).filter(([, p]) => czyPoleWidoczne(p));
}

/** Czy sekcja ma choć jedno widoczne pole (pierwszy poziom lub zagnieżdżone). */
export function czySekcjaMaWidocznePola(def: SekcjaDefinicja): boolean {
  return Object.values(def.pola).some(czyPoleWidoczne);
}
