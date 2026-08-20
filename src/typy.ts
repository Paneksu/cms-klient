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

/**
 * Reguły językowe z `copy.md` jako DANE (faza 5, część 2 planu): silnik walidacji (`reguly.ts`)
 * jest wspólny dla wszystkich klientów, ale KTÓRE reguły obowiązują dane pole i JAKIE mają
 * parametry (lista słów zakazanych, kanoniczny zapis telefonu…) jest konfiguracją per pole
 * (`Pole.reguly`) i per strona (`SchematStrony.regulyKopii`) — dopisanie reguły dla kolejnego
 * klienta nie dotyka silnika. `wykrzykniki` NIE jest tu wymieniona: to reguła CAŁEGO dokumentu
 * ("maksimum jeden wykrzyknik NA CAŁY DOKUMENT, nie na pole" — zlecenie), więc nie da się jej
 * przypisać do pojedynczego pola — silnik liczy ją zawsze, dla każdego dokumentu, niezależnie
 * od `reguly` konkretnych pól.
 */
export type RegulaId =
  | "zakazane_slowa"
  | "zakazane_zwroty"
  | "polpauza"
  | "format_ceny"
  | "telefon"
  | "dlugosc_meta_title"
  | "dlugosc_meta_description"
  | "forma_ty";

/**
 * Parametry reguł językowych dla JEDNEJ strony — słowa zakazane, kanoniczny zapis telefonu,
 * progi długości meta. Dokładnie to jest "danymi, nie kodem rozsianym po komponentach": nowy
 * klient dostaje własną konfigurację, silnik (`reguly.ts`) się nie zmienia.
 */
export interface KonfiguracjaRegulKopii {
  readonly zakazaneSlowa?: readonly string[];
  readonly zakazaneZwroty?: readonly string[];
  /** Dokładny, poprawny zapis telefonu z twardymi spacjami (U+00A0), np. `"796 696 992"`. */
  readonly telefonKanoniczny?: string;
  /** Maks. wykrzykników na CAŁY dokument. Domyślnie 1 — ostrzeżenie przy N+1, blokada od N+2. */
  readonly maksWykrzyknikowDokument?: number;
  /** Domyślnie 60. */
  readonly metaTitleMaks?: number;
  /** Domyślnie 120. */
  readonly metaDescriptionMin?: number;
  /** Domyślnie 165. */
  readonly metaDescriptionMaks?: number;
}

/** Właściwości wspólne każdego pola — to, co panel potrzebuje, żeby wygenerować formularz. */
interface PoleWspolne {
  readonly etykieta: string;
  readonly pomoc?: string;
  /** Maks. długość (pola tekstowe) albo maks. liczba elementów (lista). */
  readonly maks?: number;
  /**
   * Reguły językowe copy.md obowiązujące TO pole (silnik: `reguly.ts`). Which reguły obowiązują
   * dane pole wynika WYŁĄCZNIE stąd — panel i trasa publikacji nigdy nie zgadują reguł z typu
   * pola czy z nazwy. Pola strukturalne (`grupa`, `lista`) same nie niosą tekstu, więc `reguly`
   * u nich nie ma znaczenia — reguły dopisuje się na polach-liściach wewnątrz.
   */
  readonly reguly?: readonly RegulaId[];
  /**
   * Ukrywa pole w formularzu panelu, bez usuwania go ze schematu ani z dokumentu (patrz
   * `paczki/cms/src/widocznosc.ts`, punkt 6a planu przycięcia zakresu edycji). Świadomie
   * flaga, nie usunięcie klucza: `naprawGrupe` (`walidacja.ts`) buduje dokument WYŁĄCZNIE
   * z kluczy schematu, a pierwsza publikacja po zmianie schematu nadpisuje wersję roboczą
   * okrojonym dokumentem — usunięcie pola skasowałoby istniejącą treść bez ostrzeżenia.
   * `ukryte: true` zostawia dane na miejscu, tylko odbiera redaktorowi kontrolkę.
   *
   * OSTRZEŻENIE: to pole NIE wyłącza samo z siebie klikalności w podglądzie strony. Jeśli
   * kiedyś ukryjesz pole, które NA STRONIE jest opakowane w `<Edytowalne>`, klik w podglądzie
   * stanie się MARTWY — bez błędu, ale i bez żadnej reakcji. Wtedy trzeba usunąć wrapper
   * `<Edytowalne>` z komponentu strony RAZEM z ustawieniem `ukryte: true` na polu.
   */
  readonly ukryte?: boolean;
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
  /** Parametry reguł językowych tej strony (słowa zakazane, telefon kanoniczny…). Brak = reguły z `reguly` pól i tak działają, ale bez list/progów (np. `zakazane_slowa` bez skonfigurowanej listy nie zgłosi nic). */
  readonly regulyKopii?: KonfiguracjaRegulKopii;
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
