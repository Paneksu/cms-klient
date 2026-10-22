import { describe, it, expect } from "vitest";
import { rozwinInterpolacje, zawieraTokenCeny, formatujCene } from "@panekweb/cms";
import type { DokumentTresci } from "@panekweb/cms";

const dokument: DokumentTresci = {
  wersjaSchematu: 1,
  meta: {},
  wspolne: {},
  sekcje: [
    {
      id: "cennik",
      typ: "cennik",
      widoczna: true,
      pola: {
        uslugiGlowne: [
          { nazwa: "Mycie detailingowe", cenaS: 130, cenaM: 150, cenaXL: 190 },
          { nazwa: "Detailing wnętrza", cenaS: 310, cenaM: 370, cenaXL: 430 },
        ],
        pakiet: { cenaOd: 250, cenaRegularna: 440, oszczednosc: 190 },
        dodatki: [
          { nazwa: "Pranie fotela", cena: 60 },
          { nazwa: "Pranie tylnej kanapy", cena: 150 },
        ],
      },
    },
    { id: "hero", typ: "hero", widoczna: true, pola: { naglowek: "Detailing samochodowy" } },
  ],
};

describe("formatujCene", () => {
  it("wstawia twardą spację (U+00A0) między kwotą a „zł”", () => {
    expect(formatujCene(130)).toBe("130 zł");
  });
});

describe("rozwinInterpolacje — cena ma jedno miejsce", () => {
  it("rozwija token wskazujący pole liczbowe w liście po indeksie", () => {
    expect(rozwinInterpolacje(dokument, "mycie od {cena.uslugiGlowne.0.cenaS}")).toBe(
      `mycie od 130${" "}zł`
    );
  });

  it("rozwija token wskazujący pole zagnieżdżone w grupie", () => {
    expect(rozwinInterpolacje(dokument, "pakiet od {cena.pakiet.cenaOd}")).toBe(`pakiet od 250${" "}zł`);
  });

  it("rozwija dwa tokeny w jednym tekście niezależnie", () => {
    const wynik = rozwinInterpolacje(
      dokument,
      "Osobno zapłacisz od {cena.pakiet.cenaRegularna}. W pakiecie zostaje {cena.pakiet.oszczednosc}."
    );
    expect(wynik).toBe(`Osobno zapłacisz od 440${" "}zł. W pakiecie zostaje 190${" "}zł.`);
  });

  it("zostawia token widoczny, gdy ścieżka nie istnieje (głośna awaria zamiast cichej)", () => {
    const wynik = rozwinInterpolacje(dokument, "cena: {cena.nieistniejace.pole}");
    expect(wynik).toBe("cena: {cena.nieistniejace.pole}");
  });

  it("zostawia token widoczny, gdy trafiona wartość nie jest liczbą", () => {
    const wynik = rozwinInterpolacje(dokument, "{cena.uslugiGlowne.0.nazwa}");
    expect(wynik).toBe("{cena.uslugiGlowne.0.nazwa}");
  });

  it("zostawia token widoczny, gdy w dokumencie nie ma sekcji cennik", () => {
    const dokumentBezCennika: DokumentTresci = { ...dokument, sekcje: [dokument.sekcje[1]] };
    expect(rozwinInterpolacje(dokumentBezCennika, "od {cena.uslugiGlowne.0.cenaS}")).toBe(
      "od {cena.uslugiGlowne.0.cenaS}"
    );
  });

  it("tekst bez tokenów wraca bez zmian (szybka ścieżka)", () => {
    expect(rozwinInterpolacje(dokument, "Zwykły tekst bez cen.")).toBe("Zwykły tekst bez cen.");
  });
});

describe("zawieraTokenCeny", () => {
  it("wykrywa obecność tokenu", () => {
    expect(zawieraTokenCeny("od {cena.pakiet.cenaOd}")).toBe(true);
  });
  it("zwraca false, gdy tokenu nie ma", () => {
    expect(zawieraTokenCeny("zwykły tekst")).toBe(false);
  });
});
