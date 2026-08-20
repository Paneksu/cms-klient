/**
 * Silnik reguł językowych z `copy.md` (faza 5, część 2 planu — "Panel nie pozwoli zepsuć tekstu").
 *
 * Działa w DWÓCH miejscach z tym samym kodem (zlecenie, punkt 1 zakresu):
 *   - w panelu na żywo, jako ostrzeżenie przy polu (`PoleFormularza.tsx` woła `sprawdzWartoscPola`),
 *   - na serwerze przy publikacji, jako TWARDA BLOKADA (`app/api/tresc/publikuj/route.ts` woła
 *     `zbierzNaruszeniaDokumentu` i odrzuca publikację, gdy jest choć jedno naruszenie `blad`).
 * Panel można obejść (DevTools, żądanie wprost do trasy), bazę można zmienić skryptem — dlatego
 * blokada MUSI siedzieć w trasie serwerowej, nie tylko w komponencie formularza.
 *
 * Reguły są DANYMI: ten plik jest silnikiem współdzielonym przez wszystkich klientów (nie
 * dotyka go dopisanie kolejnej wizytówki), a to, KTÓRE reguły obowiązują dane pole i z JAKIMI
 * parametrami (lista słów zakazanych, kanoniczny zapis telefonu, progi długości meta), pochodzi
 * z `Pole.reguly` (per pole) i `SchematStrony.regulyKopii` (per strona) — patrz `typy.ts`.
 *
 * Wyjątek: `wykrzykniki` NIE jest w `RegulaId` i nie da się jej przypisać do pola — to reguła
 * CAŁEGO DOKUMENTU ("maksimum jeden wykrzyknik NA CAŁY DOKUMENT, nie na pole"), więc silnik
 * liczy ją zawsze, dla każdego dokumentu, przez `zbierzNaruszeniaDokumentu` — nie przez
 * `sprawdzWartoscPola` (który widzi tylko WARTOŚĆ JEDNEGO POLA, nie ma jak policzyć reszty
 * dokumentu).
 */

import type {
  DokumentTresci,
  KonfiguracjaRegulKopii,
  Pole,
  RegulaId,
  SchematPol,
  SchematStrony,
} from "./typy";

export type PoziomNaruszenia = "blad" | "ostrzezenie";

export interface Naruszenie {
  /** Ścieżka pola w dokumencie (`"hero.naglowekLinia1"`, `"cennik.dodatki.3.nazwa"`), albo `"__dokument__"` dla reguł całodokumentowych (wykrzykniki). */
  sciezka: string;
  regulaId: RegulaId | "wykrzykniki";
  poziom: PoziomNaruszenia;
  /** Komunikat po polsku mówiący, CO poprawić — zlecenie: "z czytelnym komunikatem mówiącym, CO zrobić". */
  komunikat: string;
}

// ── Klasa znaków "litera polska" — NIE \b ────────────────────────────────────────────────
//
// Pułapka znana z tego projektu (`wiedza/stan/stan-edytora-cms.md`): `\b` w JS opiera się na
// klasie `\w` (ASCII), która NIE obejmuje polskich liter z ogonkami. `\bPaństwo\b` fałszywie nie
// widzi granicy słowa, gdy sąsiedni znak jest polską literą spoza ASCII (np. w słowie sklejonym
// bez spacji przy literówce). Zamiast `\b` używamy jawnej klasy znaków w lookaroundach.
const ZNAK_LITERY = "a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9";

function escapujRegex(tekst: string): string {
  return tekst.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Fraza (słowo albo wielowyrazowy zwrot) jako CAŁOŚĆ, z granicami odpornymi na polskie litery. */
function zawieraFraze(tekst: string, fraza: string): boolean {
  if (!fraza) return false;
  const wzorzec = new RegExp(`(?<![${ZNAK_LITERY}])${escapujRegex(fraza)}(?![${ZNAK_LITERY}])`, "iu");
  return wzorzec.test(tekst);
}

// ── Reguły kontekstowo-wolne — działają na WARTOŚCI JEDNEGO POLA ────────────────────────────

/** `2–3`, `1,5–2 godziny` — dozwolone zakresy liczbowe. Wycięte PRZED szukaniem reszty półpauz. */
const WZORZEC_ZAKRESU_LICZBOWEGO = /\d+(?:,\d+)?–\d+(?:,\d+)?/g;

function sprawdzPolpauze(tekst: string, sciezka: string): Naruszenie[] {
  const bezZakresow = tekst.replace(WZORZEC_ZAKRESU_LICZBOWEGO, "");
  if (!bezZakresow.includes("–")) return [];
  return [
    {
      sciezka,
      regulaId: "polpauza",
      poziom: "blad",
      komunikat:
        'Znaleziono półpauzę ("–"). Nie używamy jej w zdaniach — zamień na przecinek, kropkę, dwukropek albo nawias. ' +
        "Wyjątek to zakresy liczbowe bez spacji, np. „2–3” albo „1,5–2 godziny” — te są dozwolone.",
    },
  ];
}

// Bez `\b` na końcu — pułapka Polish letters (`ł` w "zł" nie jest w klasie `\w`, więc `\b`
// fałszywie NIE widzi granicy słowa, gdy zaraz po "zł" stoi znak niealfanumeryczny jak kropka
// czy przecinek). Zamiast tego negatywny lookahead z jawną klasą liter.
const WZORZEC_CENY = new RegExp(`\\d+(?:[.,]\\d+)?\\s*(zł|PLN)(?![${ZNAK_LITERY}])`, "gi");

function sprawdzFormatCeny(tekst: string, sciezka: string): Naruszenie[] {
  WZORZEC_CENY.lastIndex = 0;
  const dopasowanie = WZORZEC_CENY.exec(tekst);
  if (!dopasowanie) return [];
  return [
    {
      sciezka,
      regulaId: "format_ceny",
      poziom: "ostrzezenie",
      komunikat:
        `Kwota wpisana wprost w tekście ("${dopasowanie[0]}"). Użyj tokenu {cena.…} wskazującego pole w sekcji ` +
        "Cennik zamiast wpisywać liczbę — inaczej po zmianie cennika ten tekst pokaże starą cenę (dotyczy też danych " +
        "strukturalnych FAQPage, które czytają dokładnie ten sam tekst).",
    },
  ];
}

/** Dowolny zapis numeru telefonu (spacje zwykłe, twarde, kropki, myślniki, bez separatorów) — do porównania z kanonicznym. */
function wzorzecTelefonuLuzny(): RegExp {
  return /7\d{2}[  .-]?\d{3}[  .-]?\d{3}/g;
}

/**
 * Normalizuje zapis numeru telefonu w dowolnym tekście: dopasowania `wzorzecTelefonuLuzny`,
 * których CYFRY zgadzają się z kanonicznym numerem (tylko separator jest inny — zwykła spacja,
 * kropka, myślnik), zamienia na dokładny zapis kanoniczny (z twardymi spacjami). Dopasowania
 * o INNYCH cyfrach (czyli realnie inny numer, nie literówka w separatorze) zostają nietknięte —
 * to nie jest ten sam numer i nie wolno go po cichu podmienić.
 *
 * Naprawia P2 ("publikacja blokowana błędem, którego klient nie umie naprawić", 19.08.2026):
 * reguła `telefon` istnieje po to, żeby numer nigdy nie złamał się na dwa wiersze — cel
 * typograficzny, który system osiąga SAM, bez żądania od redaktora znaku niewpisywalnego
 * z klawiatury (twarda spacja, U+00A0). Blokada zostaje jako siatka bezpieczeństwa na
 * WŁAŚCIWIE inny numer (patrz `sprawdzTelefon` niżej) — nie na drift formatowania.
 */
export function normalizujTelefonWTekscie(tekst: string, kanoniczny: string | undefined): string {
  if (!kanoniczny) return tekst;
  const cyfryKanoniczne = kanoniczny.replace(/\D/g, "");
  if (!cyfryKanoniczne) return tekst;
  return tekst.replace(wzorzecTelefonuLuzny(), (dopasowanie) =>
    dopasowanie.replace(/\D/g, "") === cyfryKanoniczne ? kanoniczny : dopasowanie
  );
}

/**
 * Normalizuje WARTOŚĆ JEDNEGO POLA wobec reguł, które to pole niesie — odpowiednik
 * `sprawdzWartoscPola`, ale POPRAWIA tekst zamiast tylko zgłaszać naruszenie. Dziś obejmuje
 * wyłącznie regułę `telefon` (patrz `normalizujTelefonWTekscie`); inne reguły (zakazane słowa,
 * półpauza…) dotyczą TREŚCI, nie formatu, więc nie da się ich "naprawić" bez zmiany sensu
 * zdania — te zostają wyłącznie ostrzeżeniami/blokadami z `sprawdzWartoscPola`.
 */
export function normalizujWartoscPola(p: Pole, wartosc: unknown, config: KonfiguracjaRegulKopii = {}): unknown {
  if (!p.reguly || p.reguly.length === 0) return wartosc;
  if (p.typ !== "tekst" && p.typ !== "tekst_dlugi" && p.typ !== "bogaty") return wartosc;
  if (typeof wartosc !== "string" || wartosc.length === 0) return wartosc;
  if (!p.reguly.includes("telefon")) return wartosc;
  return normalizujTelefonWTekscie(wartosc, config.telefonKanoniczny);
}

function sprawdzTelefon(tekst: string, sciezka: string, kanoniczny: string | undefined): Naruszenie[] {
  if (!kanoniczny) return [];
  const wzorzec = wzorzecTelefonuLuzny();
  const naruszenia: Naruszenie[] = [];
  let dopasowanie: RegExpExecArray | null;
  while ((dopasowanie = wzorzec.exec(tekst))) {
    if (dopasowanie[0] !== kanoniczny) {
      naruszenia.push({
        sciezka,
        regulaId: "telefon",
        poziom: "blad",
        komunikat:
          `Numer telefonu zapisany niepoprawnie ("${dopasowanie[0]}"). Wpisz dokładnie „${kanoniczny}” ` +
          "z twardymi spacjami między grupami cyfr (nie zwykłymi), żeby numer nigdy nie rozjechał się na dwa wiersze.",
      });
    }
  }
  return naruszenia;
}

function sprawdzFormeTy(tekst: string, sciezka: string): Naruszenie[] {
  if (!zawieraFraze(tekst, "Państwo") && !zawieraFraze(tekst, "Państwa")) return [];
  return [
    {
      sciezka,
      regulaId: "forma_ty",
      poziom: "ostrzezenie",
      komunikat:
        'Znaleziono formę „Państwo”/„Państwa”. Na tej stronie zwracamy się per „Ty”, konsekwentnie — zamień na formę bezpośrednią ("Twoje auto", "zadzwoń", "umów").',
    },
  ];
}

function sprawdzZakazaneFrazy(
  tekst: string,
  sciezka: string,
  lista: readonly string[] | undefined,
  regulaId: "zakazane_slowa" | "zakazane_zwroty"
): Naruszenie[] {
  if (!lista || lista.length === 0) return [];
  const naruszenia: Naruszenie[] = [];
  for (const fraza of lista) {
    if (zawieraFraze(tekst, fraza)) {
      naruszenia.push({
        sciezka,
        regulaId,
        poziom: "blad",
        komunikat: `Znaleziono zakazane sformułowanie „${fraza}”. Usuń je albo zastąp innym, dopuszczonym słownictwem z copy.md.`,
      });
    }
  }
  return naruszenia;
}

function sprawdzDlugoscMeta(
  tekst: string,
  sciezka: string,
  regulaId: "dlugosc_meta_title" | "dlugosc_meta_description",
  config: KonfiguracjaRegulKopii
): Naruszenie[] {
  const dlugosc = tekst.length;
  if (regulaId === "dlugosc_meta_title") {
    const maks = config.metaTitleMaks ?? 60;
    if (dlugosc > maks) {
      return [
        {
          sciezka,
          regulaId,
          poziom: "ostrzezenie",
          komunikat: `Tytuł ma ${dlugosc} znaków, zalecane maksimum to ${maks}. Skróć, inaczej wyszukiwarka utnie go w wynikach.`,
        },
      ];
    }
    return [];
  }
  const min = config.metaDescriptionMin ?? 120;
  const maks = config.metaDescriptionMaks ?? 165;
  if (dlugosc < min || dlugosc > maks) {
    return [
      {
        sciezka,
        regulaId,
        poziom: "ostrzezenie",
        komunikat:
          dlugosc < min
            ? `Opis ma ${dlugosc} znaków, zalecane minimum to ${min}. Dopisz konkret, inaczej opis w wynikach wygląda ubogo.`
            : `Opis ma ${dlugosc} znaków, zalecane maksimum to ${maks}. Skróć, inaczej wyszukiwarka utnie go w wynikach.`,
      },
    ];
  }
  return [];
}

/**
 * Sprawdza WARTOŚĆ JEDNEGO POLA wobec reguł, które to pole niesie (`p.reguly`). Używane:
 *   - w panelu na żywo (`PoleFormularza.tsx`), do ostrzeżeń przy polu, w trakcie pisania,
 *   - wewnątrz `zbierzNaruszeniaDokumentu` niżej, dla każdego pola-liścia dokumentu.
 * NIE liczy `wykrzykniki` — ta reguła jest całodokumentowa, patrz nagłówek pliku.
 */
export function sprawdzWartoscPola(
  p: Pole,
  sciezka: string,
  wartosc: unknown,
  config: KonfiguracjaRegulKopii = {}
): Naruszenie[] {
  if (!p.reguly || p.reguly.length === 0) return [];
  if (p.typ !== "tekst" && p.typ !== "tekst_dlugi" && p.typ !== "bogaty") return [];
  if (typeof wartosc !== "string" || wartosc.length === 0) return [];

  const naruszenia: Naruszenie[] = [];
  for (const regulaId of p.reguly) {
    switch (regulaId) {
      case "zakazane_slowa":
        naruszenia.push(...sprawdzZakazaneFrazy(wartosc, sciezka, config.zakazaneSlowa, "zakazane_slowa"));
        break;
      case "zakazane_zwroty":
        naruszenia.push(...sprawdzZakazaneFrazy(wartosc, sciezka, config.zakazaneZwroty, "zakazane_zwroty"));
        break;
      case "polpauza":
        naruszenia.push(...sprawdzPolpauze(wartosc, sciezka));
        break;
      case "format_ceny":
        naruszenia.push(...sprawdzFormatCeny(wartosc, sciezka));
        break;
      case "telefon":
        naruszenia.push(...sprawdzTelefon(wartosc, sciezka, config.telefonKanoniczny));
        break;
      case "forma_ty":
        naruszenia.push(...sprawdzFormeTy(wartosc, sciezka));
        break;
      case "dlugosc_meta_title":
      case "dlugosc_meta_description":
        naruszenia.push(...sprawdzDlugoscMeta(wartosc, sciezka, regulaId, config));
        break;
    }
  }
  return naruszenia;
}

// ── Reguła całodokumentowa: wykrzykniki ──────────────────────────────────────────────────

/** Wszystkie WARTOŚCI TEKSTOWE (liście) dokumentu, ze ścieżkami — meta, wspólne i sekcje, rekurencyjnie przez grupa/lista. */
function zbierzTekstyDokumentu(dokument: DokumentTresci): { sciezka: string; tekst: string }[] {
  const wynik: { sciezka: string; tekst: string }[] = [];

  function idzPoObiekcie(w: unknown, prefiks: string) {
    if (typeof w === "string") {
      wynik.push({ sciezka: prefiks, tekst: w });
      return;
    }
    if (Array.isArray(w)) {
      w.forEach((el, i) => idzPoObiekcie(el, `${prefiks}.${i}`));
      return;
    }
    if (w && typeof w === "object") {
      for (const [klucz, wartosc] of Object.entries(w as Record<string, unknown>)) {
        idzPoObiekcie(wartosc, prefiks ? `${prefiks}.${klucz}` : klucz);
      }
    }
  }

  idzPoObiekcie(dokument.meta, "meta");
  idzPoObiekcie(dokument.wspolne, "wspolne");
  for (const sekcja of dokument.sekcje) {
    idzPoObiekcie(sekcja.pola, sekcja.id);
  }
  return wynik;
}

/**
 * Liczy wykrzykniki w CAŁYM dokumencie (nie w jednym polu — zlecenie wprost). Zwraca `[]`, gdy
 * suma nie przekracza limitu; `ostrzezenie` przy dokładnie jednym za dużo; `blad` od dwóch za
 * dużo. Ścieżka naruszenia wylicza WSZYSTKIE pola, które niosą choć jeden wykrzyknik — redaktor
 * dostaje listę, gdzie szukać, nie tylko sumę.
 */
export function sprawdzWykrzyknikiDokumentu(
  dokument: DokumentTresci,
  config: KonfiguracjaRegulKopii = {}
): Naruszenie[] {
  const limit = config.maksWykrzyknikowDokument ?? 1;
  const teksty = zbierzTekstyDokumentu(dokument);
  const zWykrzyknikami = teksty
    .map((t) => ({ ...t, liczba: (t.tekst.match(/!/g) ?? []).length }))
    .filter((t) => t.liczba > 0);
  const suma = zWykrzyknikami.reduce((acc, t) => acc + t.liczba, 0);
  if (suma <= limit) return [];

  const listaPol = zWykrzyknikami.map((t) => t.sciezka).join(", ");
  const nadmiar = suma - limit;
  return [
    {
      sciezka: "__dokument__",
      regulaId: "wykrzykniki",
      poziom: nadmiar >= 2 ? "blad" : "ostrzezenie",
      komunikat:
        `W całym dokumencie jest ${suma} ${suma === 1 ? "wykrzyknik" : "wykrzykników"}, dozwolony limit to ${limit}. ` +
        `Usuń nadmiarowe (o ${nadmiar}) z pól: ${listaPol}.`,
    },
  ];
}

// ── Pełny dokument: chodzi po schemacie + dokumencie równolegle (jak `walidacja.ts`) ────────

function idzPoPolachGrupy(
  schemat: SchematPol,
  dane: unknown,
  prefiks: string,
  config: KonfiguracjaRegulKopii,
  wynik: Naruszenie[]
) {
  const zrodlo = dane && typeof dane === "object" && !Array.isArray(dane) ? (dane as Record<string, unknown>) : {};
  for (const [klucz, p] of Object.entries(schemat)) {
    // Pole ukryte w panelu (punkt 6a) nie ma kontrolki w formularzu — reguła, której redaktor
    // nie ma jak spełnić, nie jest bramką jakości tylko blokadą: publikacja stanęłaby na 422
    // z komunikatem wskazującym pole, którego w formularzu nie ma, bez żadnej drogi wyjścia
    // (P5 z planu). Pomijamy TYLKO tu — `sprawdzWartoscPola` samo zostaje bez zmian, bo jest
    // wołane per pole z żywego formularza, gdzie ukryte pole i tak nigdy nie trafi na wejście.
    if (p.ukryte === true) continue;
    const sciezka = `${prefiks}.${klucz}`;
    const wartosc = zrodlo[klucz];
    if (p.typ === "grupa") {
      idzPoPolachGrupy(p.pola, wartosc, sciezka, config, wynik);
    } else if (p.typ === "lista") {
      const elementy = Array.isArray(wartosc) ? wartosc : [];
      elementy.forEach((el, i) => idzPoPolachGrupy(p.elementSchema, el, `${sciezka}.${i}`, config, wynik));
    } else {
      wynik.push(...sprawdzWartoscPola(p, sciezka, wartosc, config));
    }
  }
}

function idzPoPolachGrupyNormalizujac(
  schemat: SchematPol,
  dane: unknown,
  config: KonfiguracjaRegulKopii,
  zmieniono: { licznik: number }
): Record<string, unknown> {
  const zrodlo = dane && typeof dane === "object" && !Array.isArray(dane) ? (dane as Record<string, unknown>) : {};
  const wynik: Record<string, unknown> = { ...zrodlo };
  for (const [klucz, p] of Object.entries(schemat)) {
    const wartosc = zrodlo[klucz];
    if (p.typ === "grupa") {
      wynik[klucz] = idzPoPolachGrupyNormalizujac(p.pola, wartosc, config, zmieniono);
    } else if (p.typ === "lista") {
      const elementy = Array.isArray(wartosc) ? wartosc : [];
      wynik[klucz] = elementy.map((el) => idzPoPolachGrupyNormalizujac(p.elementSchema, el, config, zmieniono));
    } else {
      const znormalizowana = normalizujWartoscPola(p, wartosc, config);
      if (znormalizowana !== wartosc) zmieniono.licznik += 1;
      wynik[klucz] = znormalizowana;
    }
  }
  return wynik;
}

/**
 * Normalizuje CAŁY dokument wg reguł formatu (dziś: `telefon`) — odpowiednik
 * `zbierzNaruszeniaDokumentu`, ale POPRAWIA zamiast zgłaszać. Woła to `sprawdzRegulyPublikacji`
 * (`lib/tresc.ts`) PRZED sprawdzeniem naruszeń: numer wpisany zwykłymi spacjami (ręcznie albo
 * przez uzupełnienie wartością domyślną sprzed tej poprawki) dostaje twarde spacje po cichu,
 * zamiast blokować publikację żądaniem znaku niewpisywalnego z klawiatury (P2, 19.08.2026).
 * Zwraca `zmieniono: 0`, gdy dokument już był czysty — wołający wtedy nie musi nic dopisywać
 * z powrotem do bazy.
 */
export function normalizujDokument(
  schemat: SchematStrony,
  dokument: DokumentTresci
): { dokument: DokumentTresci; zmieniono: number } {
  const config = schemat.regulyKopii ?? {};
  const zmieniono = { licznik: 0 };

  const meta = idzPoPolachGrupyNormalizujac(schemat.meta, dokument.meta, config, zmieniono);
  const wspolne = idzPoPolachGrupyNormalizujac(schemat.wspolne, dokument.wspolne, config, zmieniono);

  const mapaDef = new Map(schemat.sekcje.map((s) => [s.id, s]));
  const sekcje = dokument.sekcje.map((sekcjaDok) => {
    const def = mapaDef.get(sekcjaDok.id);
    if (!def) return sekcjaDok;
    return { ...sekcjaDok, pola: idzPoPolachGrupyNormalizujac(def.pola, sekcjaDok.pola, config, zmieniono) };
  });

  return { dokument: { ...dokument, meta, wspolne, sekcje }, zmieniono: zmieniono.licznik };
}

/**
 * Zbiera WSZYSTKIE naruszenia dokumentu: pole po polu (`meta`, `wspolne`, każda sekcja) wg
 * reguł przypisanych w schemacie, PLUS reguła całodokumentowa wykrzykników. Woła to trasa
 * publikacji (`app/api/tresc/publikuj/route.ts`), przed dopuszczeniem `opublikuj()` — jedyne
 * miejsce egzekwujące blokadę PO STRONIE SERWERA (panel można obejść).
 */
export function zbierzNaruszeniaDokumentu(schemat: SchematStrony, dokument: DokumentTresci): Naruszenie[] {
  const config = schemat.regulyKopii ?? {};
  const wynik: Naruszenie[] = [];

  idzPoPolachGrupy(schemat.meta, dokument.meta, "meta", config, wynik);
  idzPoPolachGrupy(schemat.wspolne, dokument.wspolne, "wspolne", config, wynik);

  const mapaDef = new Map(schemat.sekcje.map((s) => [s.id, s]));
  for (const sekcjaDok of dokument.sekcje) {
    const def = mapaDef.get(sekcjaDok.id);
    if (!def) continue;
    idzPoPolachGrupy(def.pola, sekcjaDok.pola, def.id, config, wynik);
  }

  wynik.push(...sprawdzWykrzyknikiDokumentu(dokument, config));
  return wynik;
}
