/**
 * Interpolacja cen: `{cena.<sciezka>}` w dowolnym polu tekstowym rozwija się do kwoty
 * przechowanej w sekcji `cennik` (ADR: "Sekcja cennik trzyma kwoty, a teksty odwołują się
 * do nich przez interpolację"). To jest MECHANIZM egzekwujący "ceny mają jedno miejsce" —
 * klient fizycznie nie może wpisać kwoty prozą w Hero, może tylko wstawić token, który
 * ZAWSZE czyta aktualną wartość z cennika.
 *
 * Ścieżka nawiguje przez `pola` sekcji `cennik`: klucz obiektu (pole grupy) albo indeks
 * liczbowy (element listy), np. `{cena.uslugiGlowne.0.cenaS}`,
 * `{cena.pakiet.cenaOd}`, `{cena.dodatki.3.cena}`.
 *
 * Rozwijanie NIGDY nie rzuca: token, którego nie da się rozwiązać (literówka w ścieżce,
 * pole nie jest liczbą), zostaje w tekście jako widoczny `{cena.…}` — to jest świadomie
 * głośna awaria zamiast cichej, żeby błąd w treści było widać od razu w podglądzie, a nie
 * dopiero na produkcji.
 */

import type { DokumentTresci } from "./typy";

/** Id sekcji będącej jedynym źródłem cen — konwencja współdzielona przez wszystkie schematy klientów. */
export const SEKCJA_CENNIKA = "cennik";

const WZORZEC_TOKENU = /\{cena\.([a-zA-Z0-9_.]+)\}/g;

function rozwiazSciezke(korzen: unknown, sciezka: string): unknown {
  let biezacy: unknown = korzen;
  for (const segment of sciezka.split(".")) {
    if (biezacy == null) return undefined;
    if (Array.isArray(biezacy)) {
      if (!/^\d+$/.test(segment)) return undefined;
      biezacy = biezacy[Number(segment)];
    } else if (typeof biezacy === "object") {
      biezacy = (biezacy as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return biezacy;
}

/** Twarda spacja (U+00A0) — copy.md: kwota i "zł" nigdy nie mogą się rozjechać na dwa wiersze. */
const TWARDA_SPACJA = " ";

/** `130` → `130<nbsp>zł`, zgodnie z regułą copy.md ("zawsze 130 zł, nigdy 130zł ani 130 PLN"). */
export function formatujCene(kwota: number): string {
  return `${kwota}${TWARDA_SPACJA}zł`;
}

/** Rozwija wszystkie tokeny `{cena.…}` w podanym tekście, czytając wartości z sekcji `cennik` dokumentu. */
export function rozwinInterpolacje(dokument: DokumentTresci, tekst: string): string {
  if (!tekst.includes("{cena.")) return tekst;
  const sekcjaCennika = dokument.sekcje.find((s) => s.id === SEKCJA_CENNIKA);
  if (!sekcjaCennika) return tekst;

  return tekst.replace(WZORZEC_TOKENU, (dopasowanie, sciezka: string) => {
    const wartosc = rozwiazSciezke(sekcjaCennika.pola, sciezka);
    return typeof wartosc === "number" && Number.isFinite(wartosc) ? formatujCene(wartosc) : dopasowanie;
  });
}

/** True, gdy tekst zawiera przynajmniej jeden token `{cena.…}` — do pokazania linii podglądu w panelu. */
export function zawieraTokenCeny(tekst: string): boolean {
  WZORZEC_TOKENU.lastIndex = 0;
  return WZORZEC_TOKENU.test(tekst);
}
