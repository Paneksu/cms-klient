/**
 * Walidacja dokumentu zodem + wartości domyślne przy rozjeździe schematu.
 *
 * Zasada z planu (sekcja "Jak strona czyta treść" / ryzyko R9): brakujące albo niepoprawne
 * pole w dokumencie NIGDY nie wywala walidacji wyjątkiem — dostaje wartość domyślną ze
 * schematu, a ścieżka pola trafia na listę `naprawiono`, żeby panel mógł to pokazać
 * redaktorowi jako diff (ADR 5.5). To dotyczy też sekcji: sekcja, której nie ma w dokumencie
 * (bo strona dostała nowy fragment kodu bez deployu panelu) dostaje pełny komplet wartości
 * domyślnych sekcji; sekcja, która jest w dokumencie, ale zniknęła ze schematu (bo kod
 * strony przestał ją renderować), jest pomijana po cichu — nie usuwamy z bazy nic
 * automatycznie, po prostu jej nie pokazujemy.
 */

import { z } from "zod";
import type {
  DokumentSekcja,
  DokumentTresci,
  Pole,
  SchematPol,
  SchematStrony,
  SekcjaDefinicja,
} from "./typy";

function jestObiektem(w: unknown): w is Record<string, unknown> {
  return typeof w === "object" && w !== null && !Array.isArray(w);
}

/**
 * Walidator zod TYLKO dla pól-liści (skalarnych) — celowo BEZ `grupa`/`lista`. Zagnieżdżone
 * struktury muszą być naprawiane pole po polu / element po elemencie (patrz `naprawPole`
 * niżej), więc walidacja całej zagnieżdżonej struktury jednym `z.object()`/`z.array()`
 * byłaby zbyt surowa: jedno niepoprawne pole w środku (albo tekst dłuższy niż `maks`)
 * odrzucałoby WSZYSTKIE pozostałe, poprawne pola tej samej grupy/listy razem z nim.
 */
function zSchemaLisc(p: Pole): z.ZodTypeAny {
  switch (p.typ) {
    case "tekst":
    case "tekst_dlugi":
    case "bogaty":
      return z.string();
    case "liczba":
      return z.number().finite();
    case "cena":
      return z.number().finite().nonnegative();
    case "przelacznik":
      return z.boolean();
    case "wybor":
      return z.enum(p.opcje.map((o) => o.wartosc) as [string, ...string[]]);
    case "link":
      return z.object({ etykieta: z.string(), href: z.string() });
    case "obraz":
      return z.object({ sciezka: z.string().nullable(), alt: z.string() });
    case "grupa":
    case "lista":
      throw new Error(`[cms] zSchemaLisc wywołane na typie strukturalnym "${p.typ}" — błąd wewnętrzny paczki`);
  }
}

/** Naprawia jedną wartość pola: poprawna → zwrócona (przycięta do `maks`), błędna → domyślna + wpis w `naprawiono`. */
export function naprawPole(p: Pole, wartosc: unknown, sciezka: string, naprawiono: string[]): unknown {
  if (p.typ === "grupa") {
    return naprawGrupe(p.pola, wartosc, sciezka, naprawiono);
  }
  if (p.typ === "lista") {
    if (!Array.isArray(wartosc)) {
      naprawiono.push(sciezka);
      return p.wartoscDomyslna.map((el, i) => naprawGrupe(p.elementSchema, el, `${sciezka}.${i}`, naprawiono));
    }
    const przyciete = p.maks ? wartosc.slice(0, p.maks) : wartosc;
    return przyciete.map((el, i) => naprawGrupe(p.elementSchema, el, `${sciezka}.${i}`, naprawiono));
  }

  const wynikZod = zSchemaLisc(p).safeParse(wartosc);
  if (!wynikZod.success) {
    naprawiono.push(sciezka);
    return klonuj(p.wartoscDomyslna);
  }
  if (p.typ === "tekst" || p.typ === "tekst_dlugi" || p.typ === "bogaty") {
    return p.maks ? (wynikZod.data as string).slice(0, p.maks) : wynikZod.data;
  }
  return wynikZod.data;
}

function naprawGrupe(
  schemat: SchematPol,
  wartosc: unknown,
  sciezka: string,
  naprawiono: string[]
): Record<string, unknown> {
  const zrodlo = jestObiektem(wartosc) ? wartosc : {};
  const wynik: Record<string, unknown> = {};
  for (const [klucz, p] of Object.entries(schemat)) {
    wynik[klucz] = naprawPole(p, zrodlo[klucz], `${sciezka}.${klucz}`, naprawiono);
  }
  return wynik;
}

function klonuj<T>(w: T): T {
  return typeof structuredClone === "function" ? structuredClone(w) : JSON.parse(JSON.stringify(w));
}

/** Wartości domyślne pełnej sekcji, bez dotykania danych wejściowych — do seeda i do dopisywania nowych sekcji. */
export function domyslnePolaSekcji(pola: SchematPol): Record<string, unknown> {
  const naprawiono: string[] = [];
  return naprawGrupe(pola, undefined, "__", naprawiono);
}

/** Pełny dokument zbudowany wyłącznie z wartości domyślnych schematu — seed pierwszej wersji. */
export function zbudujDomyslnyDokument(schemat: SchematStrony): DokumentTresci {
  return {
    wersjaSchematu: schemat.wersja,
    meta: domyslnePolaSekcji(schemat.meta),
    wspolne: domyslnePolaSekcji(schemat.wspolne),
    sekcje: schemat.sekcje.map((def) => ({
      id: def.id,
      typ: def.id,
      widoczna: true,
      pola: domyslnePolaSekcji(def.pola),
    })),
  };
}

export interface WynikWalidacji {
  dokument: DokumentTresci;
  /** Ścieżki pól, które nie pasowały do schematu i dostały wartość domyślną. Pusta = dokument czysty. */
  naprawiono: string[];
}

/**
 * Waliduje/naprawia dokument względem aktualnego schematu. Nigdy nie rzuca — to jest
 * fundament W10 ("brakujące pole = wartość domyślna, nigdy wyjątek"). Zachowuje kolejność
 * sekcji z dokumentu wejściowego (redaktor mógł ją zmienić), sekcje spoza schematu pomija,
 * brakujące sekcje dopisuje na końcu z wartościami domyślnymi.
 */
export function walidujDokument(schemat: SchematStrony, wejscie: unknown): WynikWalidacji {
  const naprawiono: string[] = [];
  const wej = jestObiektem(wejscie) ? wejscie : {};

  const meta = naprawGrupe(schemat.meta, wej.meta, "meta", naprawiono);
  const wspolne = naprawGrupe(schemat.wspolne, wej.wspolne, "wspolne", naprawiono);

  const mapaDef = new Map<string, SekcjaDefinicja>(schemat.sekcje.map((s) => [s.id, s]));
  const wejscioweSekcje = Array.isArray(wej.sekcje) ? (wej.sekcje as unknown[]) : [];
  const uzyte = new Set<string>();
  const sekcje: DokumentSekcja[] = [];

  for (const wpis of wejscioweSekcje) {
    if (!jestObiektem(wpis) || typeof wpis.id !== "string") continue;
    const def = mapaDef.get(wpis.id);
    if (!def || uzyte.has(wpis.id)) continue;
    uzyte.add(wpis.id);
    const widoczna = typeof wpis.widoczna === "boolean" ? wpis.widoczna : true;
    const pola = naprawGrupe(def.pola, wpis.pola, def.id, naprawiono);
    sekcje.push({ id: def.id, typ: def.id, widoczna, pola });
  }
  for (const def of schemat.sekcje) {
    if (uzyte.has(def.id)) continue;
    naprawiono.push(`sekcje.${def.id}`);
    sekcje.push({ id: def.id, typ: def.id, widoczna: true, pola: domyslnePolaSekcji(def.pola) });
  }

  return {
    dokument: { wersjaSchematu: schemat.wersja, meta, wspolne, sekcje },
    naprawiono,
  };
}

/**
 * Naprawia i waliduje WARTOŚĆ JEDNEGO POLA pod podaną ścieżką sekcji (`sekcja.klucz` albo
 * `sekcja.grupa.klucz`, `sekcja.lista.0.klucz`). Używane przez trasę `/api/tresc` do
 * odrzucenia zapisu, gdy redaktor (albo klient obchodzący panel) wysyła wartość niezgodną
 * z typem pola — w odróżnieniu od `walidujDokument`, TU niezgodność ma się skończyć błędem
 * 422 w trasie API, nie cichą naprawą, bo to jest świeży zapis użytkownika, nie odczyt
 * starego dokumentu po zmianie schematu.
 */
export function znajdzPoleWSekcji(def: SekcjaDefinicja, sciezkaWSekcji: string): Pole | null {
  const segmenty = sciezkaWSekcji.split(".");
  let biezace: SchematPol = def.pola;
  let wynik: Pole | null = null;
  for (let i = 0; i < segmenty.length; i++) {
    const seg = segmenty[i];
    // `Object.hasOwn`, nie samo `biezace[seg]`: segment pochodzi ze ścieżki przysłanej w żądaniu,
    // więc `__proto__`, `constructor` czy `toString` zwracałyby obiekt Z PROTOTYPU. Taki „kandydat"
    // przechodził dalej, choć nie ma `.typ` — `zSchemaLisc` zwracało wtedy `undefined`, a wołający
    // robił na tym `.safeParse()` i trasa oddawała 500 zamiast czystego 404 (audyt 20.08.2026).
    // Zapisu to nigdy nie dawało, ale hałasowało w logach i było powtarzalne jednym żądaniem.
    const kandydat: Pole | undefined =
      /^\d+$/.test(seg) || !Object.hasOwn(biezace, seg) ? undefined : biezace[seg];
    if (!kandydat) {
      // Segment liczbowy = indeks w liście: schemat elementu jest tym samym obiektem
      // pól dla każdego indeksu, więc po prostu kontynuujemy z tym samym `elementSchema`.
      if (/^\d+$/.test(seg) && wynik?.typ === "lista") {
        continue;
      }
      return null;
    }
    wynik = kandydat;
    if (i < segmenty.length - 1) {
      if (kandydat.typ === "grupa") biezace = kandydat.pola;
      else if (kandydat.typ === "lista") biezace = kandydat.elementSchema;
      else return null;
    }
  }
  return wynik;
}

/**
 * Walidator zod PEŁNY (rekurencyjny przez grupa/lista) — w odróżnieniu od `zSchemaLisc`,
 * tu celowo chcemy odrzucić zapis w całości, gdy którykolwiek zagnieżdżony liść jest zły:
 * to jest świeży zapis z formularza (trasa `/api/tresc`), więc "cicha naprawa" byłaby
 * myląca dla redaktora — ma dostać 422 i poprawić dokładnie to pole, nie zobaczyć, że
 * jego dane zostały po cichu podmienione na wartość domyślną.
 */
function zSchemaZapisu(p: Pole): z.ZodTypeAny {
  if (p.typ === "grupa") {
    return z.object(Object.fromEntries(Object.entries(p.pola).map(([k, sub]) => [k, zSchemaZapisu(sub)])));
  }
  if (p.typ === "lista") {
    const elementSchema = z.object(
      Object.fromEntries(Object.entries(p.elementSchema).map(([k, sub]) => [k, zSchemaZapisu(sub)]))
    );
    return p.maks ? z.array(elementSchema).max(p.maks) : z.array(elementSchema);
  }
  return zSchemaLisc(p);
}

/** Waliduje wartość zapisywaną przez redaktora dla POJEDYNCZEGO pola (trasa `/api/tresc`). Odrzuca, nie naprawia. */
export function walidujWartoscPola(p: Pole, wartosc: unknown): { ok: true; wartosc: unknown } | { ok: false } {
  const wynik = zSchemaZapisu(p).safeParse(wartosc);
  if (!wynik.success) return { ok: false };
  if ((p.typ === "tekst" || p.typ === "tekst_dlugi" || p.typ === "bogaty") && p.maks) {
    if ((wynik.data as string).length > p.maks) return { ok: false };
    return { ok: true, wartosc: wynik.data };
  }
  return { ok: true, wartosc: wynik.data };
}
