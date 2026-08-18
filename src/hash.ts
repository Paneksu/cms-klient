/**
 * Hash kanoniczny schematu treści (ADR 5.5, "Schemat wynika z kodu strony" — zlecenie
 * "zlikwidować dwie kopie schematu", 18.08.2026).
 *
 * Strona wystawia `GET /api/cms/schemat`, który zwraca `{ schemat, hash }` podpisane HMAC
 * (`./hmac.ts`). Panel porównuje ten `hash` z `tresci.strony.schemat_hash`, żeby wykryć
 * rozjazd BEZ pobierania i porównywania całego (potencjalnie dużego) JSON-a pole po polu.
 *
 * `hash` musi wyjść IDENTYCZNIE po obu stronach kontraktu dla tego samego schematu, więc
 * kanonikalizacja (kolejność kluczy) jest tu, w jednym miejscu, konsumowanym przez OBIE
 * aplikacje przez `@panekweb/cms/hash` — dokładnie ten sam powód co przy `./hmac.ts` (patrz
 * komentarz na górze tamtego pliku): dwie niezależne implementacje tej samej funkcji to
 * gwarantowany rozjazd prędzej czy później.
 *
 * Świadomie NIE re-eksportowane z `./index.ts` (barrel trafia do bundla klienta w
 * `components/edytor/Edytor.tsx`) — używa `node:crypto`, którego webpack nie potrafi
 * spakować do przeglądarki. Konsument importuje wprost `@panekweb/cms/hash`, tak jak
 * `@panekweb/cms/hmac`.
 */

import { createHash } from "node:crypto";

/**
 * Stringify z kluczami obiektów posortowanymi rekurencyjnie — kolejność pól w literale
 * `zdefiniujSchemat()` (czyli kolejność wstawiania w silniku JS) nie jest tym, na czym wolno
 * polegać jako "kanoniczna": refaktor porządkujący pola w pliku źródłowym strony nie może
 * cicho zmienić hasha bez żadnej realnej zmiany kontraktu. Tablice zostają w oryginalnej
 * kolejności (kolejność elementów NIESIE znaczenie — np. kolejność sekcji, kolejność opcji
 * `wybor`).
 */
export function kanonicznyJson(wartosc: unknown): string {
  return JSON.stringify(uporzadkuj(wartosc));
}

function uporzadkuj(wartosc: unknown): unknown {
  if (Array.isArray(wartosc)) return wartosc.map(uporzadkuj);
  if (wartosc && typeof wartosc === "object") {
    return Object.keys(wartosc as Record<string, unknown>)
      .sort()
      .reduce((acc, klucz) => {
        acc[klucz] = uporzadkuj((wartosc as Record<string, unknown>)[klucz]);
        return acc;
      }, {} as Record<string, unknown>);
  }
  return wartosc;
}

/** SHA-256 (hex) kanonicznego JSON-a. Nie jest sekretem — schemat leci jawnie, hash tylko go skraca do porównania. */
export function hashSchematu(schemat: unknown): string {
  return createHash("sha256").update(kanonicznyJson(schemat)).digest("hex");
}

/**
 * Alias semantyczny `hashSchematu` dla DOKUMENTU TREŚCI, nie schematu (`GET
 * /api/podglad-danych`, faza 3 planu, część 2 — patrz `app/api/podglad-danych/route.ts` w
 * panelu). Implementacja jest identyczna (SHA-256 kanonicznego JSON-a dowolnej wartości) —
 * osobna nazwa istnieje wyłącznie po to, żeby czytający `route.ts` nie musiał się zastanawiać,
 * czy "hashSchematu" zastosowany do `wersje.dane` to pomyłka kopiuj-wklej.
 */
export function hashDokumentuTresci(dokument: unknown): string {
  return hashSchematu(dokument);
}
