import { describe, expect, it } from "vitest";
import { pole, sekcja, zdefiniujSchemat } from "@panekweb/cms";

/**
 * Testy `zdefiniujSchemat` (`paczki/cms/src/schemat.ts`) — strażniki wołane przy DEFINIOWANIU
 * schematu (build-time po stronie klienta), nie przy walidacji dokumentu.
 */

describe("zdefiniujSchemat — id sekcji zarezerwowane dla korzeni dokumentu (przegląd kodu, 20.08.2026, punkt 6)", () => {
  // `meta`/`wspolne` są rozpoznawane po SAMEJ NAZWIE w `lib/tresc.ts` i `lib/edytorStan.ts` —
  // sekcja klienta o takim `id` zapisywałaby się po cichu do złego korzenia dokumentu.
  it("rzuca, gdy sekcja ma id \"meta\"", () => {
    expect(() =>
      zdefiniujSchemat({
        wersja: 1,
        meta: {},
        wspolne: {},
        sekcje: [sekcja("meta", "Meta", { x: pole.tekst("X", "") })],
      })
    ).toThrow(/zarezerwowane/);
  });

  it("rzuca, gdy sekcja ma id \"wspolne\"", () => {
    expect(() =>
      zdefiniujSchemat({
        wersja: 1,
        meta: {},
        wspolne: {},
        sekcje: [sekcja("wspolne", "Wspólne", { x: pole.tekst("X", "") })],
      })
    ).toThrow(/zarezerwowane/);
  });

  it("kontrola: normalne id sekcji przechodzi bez błędu", () => {
    expect(() =>
      zdefiniujSchemat({
        wersja: 1,
        meta: {},
        wspolne: {},
        sekcje: [sekcja("hero", "Hero", { naglowek: pole.tekst("Nagłówek", "") })],
      })
    ).not.toThrow();
  });

  it("nadal rzuca na zduplikowane id (istniejący strażnik, sanity check)", () => {
    expect(() =>
      zdefiniujSchemat({
        wersja: 1,
        meta: {},
        wspolne: {},
        sekcje: [
          sekcja("hero", "Hero", { a: pole.tekst("A", "") }),
          sekcja("hero", "Hero 2", { b: pole.tekst("B", "") }),
        ],
      })
    ).toThrow(/zduplikowane/);
  });
});
