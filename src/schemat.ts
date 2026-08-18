/**
 * Builder schematu treści — `zdefiniujSchemat()` i fabryki pól.
 *
 * Ważne: `wartoscDomyslna` każdego pola jest tu traktowana jako REALNA treść startowa
 * (seed), nie pusty placeholder. Dzięki temu `zbudujDomyslnyDokument()` z `walidacja.ts`
 * służy jednocześnie do: (a) seedowania pierwszej wersji roboczej klienta, (b) naprawy
 * pojedynczego brakującego pola przy rozjeździe schematu (B3) — a fallback dla brakującego
 * pola jest prawdziwym, wysłanym już na produkcję tekstem, nie "—" czy pustym stringiem.
 */

import type {
  OpcjaWyboru,
  Pole,
  PoleBogate,
  PoleCena,
  PoleGrupa,
  PoleLink,
  PoleLista,
  PoleLiczba,
  PoleObraz,
  PolePrzelacznik,
  PoleTekst,
  PoleTekstDlugi,
  PoleWybor,
  SchematPol,
  SchematStrony,
  SekcjaDefinicja,
  WartoscLink,
  WartoscObraz,
} from "./typy";

type OpcjeWspolne = { pomoc?: string; maks?: number };

export const pole = {
  tekst(etykieta: string, wartoscDomyslna = "", opcje: OpcjeWspolne = {}): PoleTekst {
    return { typ: "tekst", etykieta, wartoscDomyslna, ...opcje };
  },
  tekstDlugi(etykieta: string, wartoscDomyslna = "", opcje: OpcjeWspolne = {}): PoleTekstDlugi {
    return { typ: "tekst_dlugi", etykieta, wartoscDomyslna, ...opcje };
  },
  bogaty(etykieta: string, wartoscDomyslna = "", opcje: OpcjeWspolne = {}): PoleBogate {
    return { typ: "bogaty", etykieta, wartoscDomyslna, ...opcje };
  },
  liczba(
    etykieta: string,
    wartoscDomyslna = 0,
    opcje: OpcjeWspolne & { min?: number; max?: number } = {}
  ): PoleLiczba {
    return { typ: "liczba", etykieta, wartoscDomyslna, ...opcje };
  },
  /** Kwota brutto w złotówkach. Jedyny typ pola, do którego wolno się odwołać z `{cena.…}`. */
  cena(etykieta: string, wartoscDomyslna: number, opcje: OpcjeWspolne & { min?: number } = {}): PoleCena {
    return { typ: "cena", etykieta, wartoscDomyslna, ...opcje };
  },
  wybor(
    etykieta: string,
    opcjeWyboru: readonly OpcjaWyboru[],
    wartoscDomyslna: string,
    opcje: OpcjeWspolne = {}
  ): PoleWybor {
    return { typ: "wybor", etykieta, opcje: opcjeWyboru, wartoscDomyslna, ...opcje };
  },
  przelacznik(etykieta: string, wartoscDomyslna = false, opcje: OpcjeWspolne = {}): PolePrzelacznik {
    return { typ: "przelacznik", etykieta, wartoscDomyslna, ...opcje };
  },
  obraz(etykieta: string, altDomyslny = "", opcje: OpcjeWspolne = {}): PoleObraz {
    const wartoscDomyslna: WartoscObraz = { sciezka: null, alt: altDomyslny };
    return { typ: "obraz", etykieta, wartoscDomyslna, ...opcje };
  },
  link(etykieta: string, wartoscDomyslna: WartoscLink, opcje: OpcjeWspolne = {}): PoleLink {
    return { typ: "link", etykieta, wartoscDomyslna, ...opcje };
  },
  grupa(etykieta: string, pola: SchematPol, opcje: OpcjeWspolne = {}): PoleGrupa {
    return { typ: "grupa", etykieta, pola, ...opcje };
  },
  lista(
    etykieta: string,
    elementSchema: SchematPol,
    wartoscDomyslna: readonly Record<string, unknown>[],
    opcje: OpcjeWspolne & { minElementow?: number; maksElementow?: number } = {}
  ): PoleLista {
    return { typ: "lista", etykieta, elementSchema, wartoscDomyslna, ...opcje };
  },
};

export function sekcja(id: string, etykieta: string, pola: SchematPol, pomoc?: string): SekcjaDefinicja {
  return { id, etykieta, pola, pomoc };
}

export function zdefiniujSchemat(definicja: {
  wersja: number;
  wspolne: SchematPol;
  meta: SchematPol;
  sekcje: readonly SekcjaDefinicja[];
}): SchematStrony {
  const idy = new Set<string>();
  for (const s of definicja.sekcje) {
    if (idy.has(s.id)) {
      throw new Error(`[cms] zduplikowane id sekcji w schemacie: "${s.id}"`);
    }
    idy.add(s.id);
  }
  return definicja;
}

/** Re-eksport dla czytelności w plikach schematu klienta (`import type { Pole } from "@panekweb/cms"`). */
export type { Pole };
