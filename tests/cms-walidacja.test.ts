import { describe, it, expect } from "vitest";
import { pole, sekcja, zdefiniujSchemat, walidujDokument, zbudujDomyslnyDokument } from "@panekweb/cms";

const schemat = zdefiniujSchemat({
  wersja: 3,
  meta: { title: pole.tekst("Tytuł", "Domyślny tytuł") },
  wspolne: { telefon: pole.tekst("Telefon", "700 100 200") },
  sekcje: [
    sekcja("hero", "Hero", {
      naglowek: pole.tekst("Nagłówek", "Domyślny nagłówek", { maks: 20 }),
      aktywny: pole.przelacznik("Aktywny", true),
      liczbaGwiazdek: pole.liczba("Ocena", 5),
    }),
    sekcja("cennik", "Cennik", {
      mycieOd: pole.cena("Mycie od", 130),
      dodatki: pole.lista(
        "Dodatki",
        { nazwa: pole.tekst("Nazwa", ""), cena: pole.cena("Cena", 0) },
        [{ nazwa: "Wosk", cena: 60 }]
      ),
    }),
  ],
});

describe("walidujDokument — wartości domyślne przy braku pola (B3, W10)", () => {
  it("nigdy nie rzuca wyjątkiem na pustym wejściu (undefined)", () => {
    expect(() => walidujDokument(schemat, undefined)).not.toThrow();
  });

  it("nigdy nie rzuca na kompletnie niepasującym kształcie", () => {
    expect(() => walidujDokument(schemat, { cokolwiek: 42, sekcje: "nie tablica" })).not.toThrow();
  });

  it("brakująca sekcja w dokumencie dostaje pełny komplet wartości domyślnych i trafia do naprawiono", () => {
    const { dokument, naprawiono } = walidujDokument(schemat, { sekcje: [] });
    expect(dokument.sekcje).toHaveLength(2);
    const hero = dokument.sekcje.find((s) => s.id === "hero")!;
    expect(hero.pola.naglowek).toBe("Domyślny nagłówek");
    expect(naprawiono).toContain("sekcje.hero");
    expect(naprawiono).toContain("sekcje.cennik");
  });

  it("brakujące pojedyncze pole w istniejącej sekcji dostaje wartość domyślną, reszta sekcji zostaje", () => {
    const wejscie = {
      sekcje: [{ id: "hero", widoczna: true, pola: { aktywny: false } }],
    };
    const { dokument, naprawiono } = walidujDokument(schemat, wejscie);
    const hero = dokument.sekcje.find((s) => s.id === "hero")!;
    expect(hero.pola.naglowek).toBe("Domyślny nagłówek");
    expect(hero.pola.aktywny).toBe(false); // pole obecne i poprawne — NIE naprawiane
    expect(naprawiono).toContain("hero.naglowek");
    expect(naprawiono).not.toContain("hero.aktywny");
  });

  it("zły typ wartości (string zamiast liczby) też liczy się jako naprawa", () => {
    const wejscie = { sekcje: [{ id: "hero", pola: { liczbaGwiazdek: "pięć" } }] };
    const { dokument, naprawiono } = walidujDokument(schemat, wejscie);
    const hero = dokument.sekcje.find((s) => s.id === "hero")!;
    expect(hero.pola.liczbaGwiazdek).toBe(5);
    expect(naprawiono).toContain("hero.liczbaGwiazdek");
  });

  it("przycina tekst dłuższy niż `maks`", () => {
    const wejscie = { sekcje: [{ id: "hero", pola: { naglowek: "x".repeat(50) } }] };
    const { dokument } = walidujDokument(schemat, wejscie);
    const hero = dokument.sekcje.find((s) => s.id === "hero")!;
    expect((hero.pola.naglowek as string).length).toBe(20);
  });

  it("naprawia elementy listy pojedynczo, nie całą listę naraz", () => {
    const wejscie = {
      sekcje: [
        {
          id: "cennik",
          pola: { dodatki: [{ nazwa: "Wosk", cena: 60 }, { nazwa: 123, cena: "zła" }] },
        },
      ],
    };
    const { dokument, naprawiono } = walidujDokument(schemat, wejscie);
    const cennik = dokument.sekcje.find((s) => s.id === "cennik")!;
    const dodatki = cennik.pola.dodatki as { nazwa: string; cena: number }[];
    expect(dodatki).toHaveLength(2);
    expect(dodatki[0]).toEqual({ nazwa: "Wosk", cena: 60 });
    expect(dodatki[1].cena).toBe(0); // wartość domyślna elementu listy
    expect(naprawiono.some((p) => p.startsWith("cennik.dodatki.1"))).toBe(true);
  });

  it("zachowuje kolejność sekcji z dokumentu wejściowego (redaktor mógł ją zmienić)", () => {
    const wejscie = {
      sekcje: [
        { id: "cennik", widoczna: true, pola: {} },
        { id: "hero", widoczna: false, pola: {} },
      ],
    };
    const { dokument } = walidujDokument(schemat, wejscie);
    expect(dokument.sekcje.map((s) => s.id)).toEqual(["cennik", "hero"]);
    expect(dokument.sekcje[1].widoczna).toBe(false);
  });

  it("pomija po cichu sekcję z dokumentu, której nie ma już w schemacie", () => {
    const wejscie = { sekcje: [{ id: "usunieta-sekcja", widoczna: true, pola: {} }] };
    const { dokument } = walidujDokument(schemat, wejscie);
    expect(dokument.sekcje.map((s) => s.id)).toEqual(["hero", "cennik"]);
  });
});

describe("zbudujDomyslnyDokument — seed", () => {
  it("produkuje dokument zgodny ze schematem, bez pola `naprawiono`", () => {
    const dokument = zbudujDomyslnyDokument(schemat);
    expect(dokument.wersjaSchematu).toBe(3);
    expect(dokument.sekcje).toHaveLength(2);
    expect(dokument.meta.title).toBe("Domyślny tytuł");
  });

  it("dokument z zbudujDomyslnyDokument przechodzi walidację bez żadnej naprawy", () => {
    const seed = zbudujDomyslnyDokument(schemat);
    const { naprawiono } = walidujDokument(schemat, seed);
    expect(naprawiono).toEqual([]);
  });
});
