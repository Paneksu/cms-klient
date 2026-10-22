import { describe, expect, it } from "vitest";
import { pole, czyPoleWidoczne, czySekcjaMaWidocznePola, widoczneWpisy } from "@panekweb/cms";
import type { SekcjaDefinicja } from "@panekweb/cms";

/**
 * Testy `paczki/cms/src/widocznosc.ts` (punkt 6a planu przycięcia zakresu edycji, 20.08.2026).
 * Czysta prezentacja schematu: `ukryte` NIE usuwa pól, tylko decyduje, czy formularz ma
 * wyrenderować dla nich kontrolkę.
 */

describe("czyPoleWidoczne", () => {
  it("pole bez flagi jest widoczne", () => {
    expect(czyPoleWidoczne(pole.tekst("Nazwa"))).toBe(true);
  });

  it("pole z ukryte: true nie jest widoczne", () => {
    expect(czyPoleWidoczne(pole.tekst("Nazwa", "", { ukryte: true }))).toBe(false);
  });

  it("grupa z jednym widocznym dzieckiem jest widoczna", () => {
    const grupa = pole.grupa("Dane", {
      alt: pole.tekst("Alt", "", { ukryte: true }),
      nazwa: pole.tekst("Nazwa"),
    });
    expect(czyPoleWidoczne(grupa)).toBe(true);
  });

  it("grupa ze wszystkimi dziećmi ukrytymi nie jest widoczna", () => {
    const grupa = pole.grupa("Dane techniczne", {
      alt: pole.tekst("Alt", "", { ukryte: true }),
      aria: pole.tekst("Aria", "", { ukryte: true }),
    });
    expect(czyPoleWidoczne(grupa)).toBe(false);
  });

  it("grupa zagnieżdżona dwa poziomy, widoczny tylko najgłębszy liść, jest widoczna", () => {
    const grupa = pole.grupa("Zewnętrzna", {
      wewnetrzna: pole.grupa("Wewnętrzna", {
        techniczne: pole.tekst("Techniczne", "", { ukryte: true }),
        widoczne: pole.tekst("Widoczne"),
      }),
    });
    expect(czyPoleWidoczne(grupa)).toBe(true);
  });

  it("grupa zagnieżdżona dwa poziomy, gdzie najgłębszy poziom jest cały ukryty, nie jest widoczna", () => {
    const grupa = pole.grupa("Zewnętrzna", {
      wewnetrzna: pole.grupa("Wewnętrzna", {
        techniczne: pole.tekst("Techniczne", "", { ukryte: true }),
      }),
    });
    expect(czyPoleWidoczne(grupa)).toBe(false);
  });

  it("lista, której elementSchema ma same ukryte pola, nie jest widoczna (przypadek galerii)", () => {
    const lista = pole.lista(
      "Galeria",
      { zdjecie: pole.obraz("Zdjęcie", "", { ukryte: true }) },
      []
    );
    expect(czyPoleWidoczne(lista)).toBe(false);
  });

  it("lista z choć jednym widocznym polem w elementSchema jest widoczna", () => {
    const lista = pole.lista(
      "Pytania",
      {
        pytanie: pole.tekst("Pytanie"),
        aria: pole.tekst("Aria", "", { ukryte: true }),
      },
      []
    );
    expect(czyPoleWidoczne(lista)).toBe(true);
  });
});

describe("widoczneWpisy", () => {
  it("zachowuje kolejność kluczy i pomija ukryte", () => {
    const pola = {
      a: pole.tekst("A"),
      b: pole.tekst("B", "", { ukryte: true }),
      c: pole.tekst("C"),
    };
    expect(widoczneWpisy(pola).map(([klucz]) => klucz)).toEqual(["a", "c"]);
  });

  it("zwraca [] gdy wszystkie pola są ukryte", () => {
    const pola = {
      a: pole.tekst("A", "", { ukryte: true }),
      b: pole.tekst("B", "", { ukryte: true }),
    };
    expect(widoczneWpisy(pola)).toEqual([]);
  });
});

describe("czySekcjaMaWidocznePola", () => {
  it("true, gdy sekcja ma choć jedno widoczne pole", () => {
    const def: SekcjaDefinicja = {
      id: "hero",
      etykieta: "Hero",
      pola: { tytul: pole.tekst("Tytuł"), alt: pole.tekst("Alt", "", { ukryte: true }) },
    };
    expect(czySekcjaMaWidocznePola(def)).toBe(true);
  });

  it("false, gdy wszystkie pola sekcji są ukryte", () => {
    const def: SekcjaDefinicja = {
      id: "techniczna",
      etykieta: "Techniczna",
      pola: { alt: pole.tekst("Alt", "", { ukryte: true }), aria: pole.tekst("Aria", "", { ukryte: true }) },
    };
    expect(czySekcjaMaWidocznePola(def)).toBe(false);
  });
});
