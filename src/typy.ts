/**
 * Typy kontraktu schema-driven CMS-a wizytówek (ADR, sekcja "Kontrakt strona↔panel").
 *
 * Zamknięty zbiór typów pól (12 pozycji z ADR/planu): tekst, tekst_dlugi, bogaty, liczba,
 * cena, wybor, przelacznik, obraz, link, lista, grupa. Rozszerzenie o nowy typ pola jest
 * decyzją architektoniczną (nowy ADR), nie dopisaniem wariantu tutaj — patrz ryzyko R11.
 */

export type TypPola =
  | "tekst"
  | "tekst_dlugi"
  | "bogaty"
  | "liczba"
  | "cena"
  | "wybor"
  | "przelacznik"
  | "obraz"
  | "link"
  | "lista"
  | "grupa";

/** Właściwości wspólne każdego pola — to, co panel potrzebuje, żeby wygenerować formularz. */
interface PoleWspolne {
  readonly etykieta: string;
  readonly pomoc?: string;
  /** Maks. długość (pola tekstowe) albo maks. liczba elementów (lista). */
  readonly maks?: number;
}

export interface PoleTekst extends PoleWspolne {
  readonly typ: "tekst";
  readonly wartoscDomyslna: string;
}

export interface PoleTekstDlugi extends PoleWspolne {
  readonly typ: "tekst_dlugi";
  readonly wartoscDomyslna: string;
}

/** Tylko pogrubienie i link (ADR) — sanityzacja treści dzieje się przy renderze, nie tutaj. */
export interface PoleBogate extends PoleWspolne {
  readonly typ: "bogaty";
  readonly wartoscDomyslna: string;
}

export interface PoleLiczba extends PoleWspolne {
  readonly typ: "liczba";
  readonly wartoscDomyslna: number;
  readonly min?: number;
  readonly max?: number;
}

/** Kwota w złotówkach (liczba całkowita, brutto). Jedyne miejsce, z którego ceny idą do treści. */
export interface PoleCena extends PoleWspolne {
  readonly typ: "cena";
  readonly wartoscDomyslna: number;
  readonly min?: number;
}

export interface OpcjaWyboru {
  readonly wartosc: string;
  readonly etykieta: string;
}

export interface PoleWybor extends PoleWspolne {
  readonly typ: "wybor";
  readonly opcje: readonly OpcjaWyboru[];
  readonly wartoscDomyslna: string;
}

export interface PolePrzelacznik extends PoleWspolne {
  readonly typ: "przelacznik";
  readonly wartoscDomyslna: boolean;
}

/** `sciezka` to relatywna ścieżka w buckecie `tresci-media` — upload jest fazą 4, tu tylko kontrakt. */
export interface WartoscObraz {
  readonly sciezka: string | null;
  readonly alt: string;
}

export interface PoleObraz extends PoleWspolne {
  readonly typ: "obraz";
  readonly wartoscDomyslna: WartoscObraz;
}

export interface WartoscLink {
  readonly etykieta: string;
  readonly href: string;
}

export interface PoleLink extends PoleWspolne {
  readonly typ: "link";
  readonly wartoscDomyslna: WartoscLink;
}

export type SchematPol = Record<string, Pole>;

/** Pola zagnieżdżone bez powtórzeń (np. dane formularza kontaktowego). */
export interface PoleGrupa extends PoleWspolne {
  readonly typ: "grupa";
  readonly pola: SchematPol;
}

/** Powtarzalna kolekcja elementów o jednakowym kształcie (karty usług, kroki procesu, FAQ…). */
export interface PoleLista extends PoleWspolne {
  readonly typ: "lista";
  readonly elementSchema: SchematPol;
  readonly minElementow?: number;
  readonly maksElementow?: number;
  readonly wartoscDomyslna: readonly Record<string, unknown>[];
}

export type Pole =
  | PoleTekst
  | PoleTekstDlugi
  | PoleBogate
  | PoleLiczba
  | PoleCena
  | PoleWybor
  | PolePrzelacznik
  | PoleObraz
  | PoleLink
  | PoleGrupa
  | PoleLista;

export interface SekcjaDefinicja {
  readonly id: string;
  readonly etykieta: string;
  readonly pomoc?: string;
  readonly pola: SchematPol;
}

/** Definicja schematu jednej strony — wynik `zdefiniujSchemat()`. */
export interface SchematStrony {
  readonly wersja: number;
  readonly wspolne: SchematPol;
  readonly meta: SchematPol;
  readonly sekcje: readonly SekcjaDefinicja[];
}

// ── Kształt dokumentu (runtime, `wersje.dane`) ──────────────────────────────────────

export interface DokumentSekcja {
  id: string;
  /** == id definicji sekcji w schemacie; osobne pole, bo dokument nie zna schematu. */
  typ: string;
  widoczna: boolean;
  pola: Record<string, unknown>;
}

export interface DokumentTresci {
  wersjaSchematu: number;
  meta: Record<string, unknown>;
  wspolne: Record<string, unknown>;
  sekcje: DokumentSekcja[];
}
