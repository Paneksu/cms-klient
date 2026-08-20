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
  KonfiguracjaRegulKopii,
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
  RegulaId,
  SchematPol,
  SchematStrony,
  SekcjaDefinicja,
  WartoscLink,
  WartoscObraz,
} from "./typy";

// `ukryte` w `OpcjeWspolne` (nie tylko w `PoleWspolne`): wystarcza tu dopisać RAZ, bo KAŻDA
// fabryka niżej robi `...opcje` na budowanym obiekcie pola — nie trzeba dotykać ani jednej z nich.
type OpcjeWspolne = { pomoc?: string; maks?: number; ukryte?: boolean };
/** Pola tekstowe (`tekst`/`tekst_dlugi`/`bogaty`) dodatkowo przyjmują `reguly` (faza 5, część 2). */
type OpcjeTekstowe = OpcjeWspolne & { reguly?: readonly RegulaId[] };

/**
 * Zestaw reguł copy.md domyślny dla KAŻDEGO pola tekstowego, chyba że wywołanie jawnie poda
 * `reguly` (nawet pustą tablicę — to świadomy opt-out, np. dla `telefonHref`, które niesie
 * `tel:+48…`, nie tekst do wyświetlenia). Decyzja "gustu": zamiast wymagać wypisania reguł
 * przy każdym z ~150 pól schematu ddcarspa (mechaniczne, błędogenne kopiowanie), silnik
 * przyjmuje sensowny domyślny zestaw, który i tak nic nie zrobi bez skonfigurowanych list
 * słów/telefonu w `SchematStrony.regulyKopii` — a każde pole może go INDYWIDUALNIE nadpisać.
 * `dlugosc_meta_*` świadomie NIE wchodzi tu — ma sens tylko na `meta.title`/`meta.description`,
 * dopisywane tam wprost.
 */
export const DOMYSLNE_REGULY_TEKSTU: readonly RegulaId[] = [
  "zakazane_slowa",
  "zakazane_zwroty",
  "polpauza",
  "format_ceny",
  "telefon",
  "forma_ty",
];

function regulyPola(opcje: OpcjeTekstowe): readonly RegulaId[] | undefined {
  return opcje.reguly ?? DOMYSLNE_REGULY_TEKSTU;
}

export const pole = {
  tekst(etykieta: string, wartoscDomyslna = "", opcje: OpcjeTekstowe = {}): PoleTekst {
    const { reguly: _reguly, ...reszta } = opcje;
    return { typ: "tekst", etykieta, wartoscDomyslna, ...reszta, reguly: regulyPola(opcje) };
  },
  tekstDlugi(etykieta: string, wartoscDomyslna = "", opcje: OpcjeTekstowe = {}): PoleTekstDlugi {
    const { reguly: _reguly, ...reszta } = opcje;
    return { typ: "tekst_dlugi", etykieta, wartoscDomyslna, ...reszta, reguly: regulyPola(opcje) };
  },
  bogaty(etykieta: string, wartoscDomyslna = "", opcje: OpcjeTekstowe = {}): PoleBogate {
    const { reguly: _reguly, ...reszta } = opcje;
    return { typ: "bogaty", etykieta, wartoscDomyslna, ...reszta, reguly: regulyPola(opcje) };
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
  regulyKopii?: KonfiguracjaRegulKopii;
}): SchematStrony {
  const idy = new Set<string>();
  for (const s of definicja.sekcje) {
    if (idy.has(s.id)) {
      throw new Error(`[cms] zduplikowane id sekcji w schemacie: "${s.id}"`);
    }
    // `meta` i `wspolne` to ZAREZERWOWANE korzenie dokumentu (`DokumentTresci.meta`,
    // `DokumentTresci.wspolne`, patrz `typy.ts`) — `lib/tresc.ts` i `lib/edytorStan.ts`
    // rozpoznają je po SAMEJ NAZWIE, nie po żadnym innym oznaczeniu. Sekcja klienta o tym samym
    // `id` zapisywałaby się po cichu do `dane.meta`/`dane.wspolne` zamiast do własnego miejsca w
    // `dane.sekcje` — cicha utrata treści przy pierwszym zapisie, bez żadnego błędu po drodze.
    // Domknięcie zamiast czekać, aż realny schemat klienta na to trafi (przegląd kodu,
    // 20.08.2026, punkt 6).
    if (s.id === "meta" || s.id === "wspolne") {
      throw new Error(`[cms] id sekcji "${s.id}" jest zarezerwowane (korzeń dokumentu) — wybierz inne id.`);
    }
    idy.add(s.id);
  }
  return definicja;
}

/** Re-eksport dla czytelności w plikach schematu klienta (`import type { Pole } from "@panekweb/cms"`). */
export type { Pole };
