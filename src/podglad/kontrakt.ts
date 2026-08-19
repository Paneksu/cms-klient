/**
 * Kontrakt `postMessage` między ramką podglądu (strona klienta, `/podglad/robocza`, wewnątrz
 * `<iframe>`) a panelem (`edytor.panekweb.pl`, ekran edycji) — faza 3 planu, część 2 ("Podgląd
 * i klikanie w elementy"). Typy i stała `ZRODLO_WIADOMOSCI_CMS` żyją w paczce wspólnej
 * `@panekweb/cms`, konsumowanej przez OBIE aplikacje, z tego samego powodu co `hmac.ts` i
 * `hash.ts` (patrz komentarze tam): dwie niezależne kopie kształtu wiadomości w dwóch repo to
 * gwarantowany rozjazd prędzej czy później.
 *
 * BEZPIECZNE dla bundla przeglądarki (zero `node:crypto`) — inaczej niż `./hmac` i `./hash`,
 * ten plik JEST re-eksportowany z barrela głównego (`./index.ts`) tej podpaczki, konsumowanej
 * pod subpath `@panekweb/cms/podglad`.
 *
 * Każda wiadomość niesie `zrodlo: ZRODLO_WIADOMOSCI_CMS` — wymóg zlecenia: "wiadomość bez
 * znacznika źródła jest ignorowana". Bez tego znacznika dowolny inny skrypt na stronie (albo
 * w ramce) mógłby przypadkiem wysłać wiadomość o kształcie pasującym do `cms:patch` i coś by
 * się przez pomyłkę wykonało. Znacznik NIE zastępuje weryfikacji `event.origin` (to osobna,
 * niezależna warstwa — origin dowodzi KTO wysłał, znacznik dowodzi CO to za wiadomość) —
 * weryfikacja originu wobec białej listy siedzi po stronie odbiorcy (`PodgladNasluch.tsx` po
 * stronie ramki, ekran edycji po stronie panelu), nie tutaj.
 */

export const ZRODLO_WIADOMOSCI_CMS = "panekweb-cms" as const;

/** Debounce dla `cms:patch` (panel→ramka) — zlecenie: "~80 ms". Stała w jednym miejscu z tego
 *  samego powodu co `OKNO_WAZNOSCI_PODGLADU_MS` w `../hmac.ts`. */
export const DEBOUNCE_PATCH_MS = 80;

// Uwaga: `cms:wysokosc` istniało tu wcześniej (panel dopasowywał wysokość `<iframe>` do
// wysokości dokumentu). Usunięte — `<iframe>` ma na sztywno `h-full w-full` (`RamkaPodgladu.tsx`),
// więc obserwator wysyłający tę wiadomość nie miał żadnego efektu po stronie panelu. Martwa
// wiadomość w kontrakcie, który jedzie tarballem do każdej kolejnej wizytówki, tylko myli.
export type WiadomoscRamkaDoPanelu =
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:gotowy"; sekcje: string[] }
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:klik"; pole: string; typPola: string; sekcja: string }
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:hover"; pole: string | null };

export type WiadomoscPanelDoRamki =
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:patch"; pole: string; wartosc: string }
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:podswietl"; pole: string | null }
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:przewin"; pole: string }
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:przeladuj" }
  // Miękkie odświeżenie po zapisie wartości niepatchowalnej (liczba, przełącznik, obraz, link,
  // cała tablica listy) — ramka woła `useRouter().refresh()`, które re-pobiera drzewo RSC
  // zachowując pozycję przewinięcia i stan komponentów. `cms:przeladuj` zostaje dla przypadków
  // wymagających twardego przeładowania (zmiana kolejności/widoczności sekcji).
  | { zrodlo: typeof ZRODLO_WIADOMOSCI_CMS; typ: "cms:odswiez" };

/** Strażnik kształtu — sprawdza WYŁĄCZNIE obecność `zrodlo`/`typ`, nie cały wariant (to robi
 *  wywołujący, po `dane.typ`, bo TypeScript nie zawęzi discriminated union z samego `unknown`). */
export function jestWiadomosciaCms(dane: unknown): dane is { zrodlo: string; typ: string } {
  return (
    !!dane &&
    typeof dane === "object" &&
    (dane as Record<string, unknown>).zrodlo === ZRODLO_WIADOMOSCI_CMS &&
    typeof (dane as Record<string, unknown>).typ === "string"
  );
}
