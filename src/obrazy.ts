/**
 * Zdjęcia — faza 4 planu ("Zdjęcia"). Trzy kawałki wspólne dla panelu i strony:
 *
 *   1. `obliczWymiarySkalowania` / `skalujObrazWPrzegladarce` — redukcja PRZED uploadem
 *      (canvas). Kod przeniesiony z `ddcarspa.pl/components/ContactForm.tsx`
 *      (`resizePhotoForUpload`), tam zostawiony (formularz kontaktowy ma swój, mniejszy próg
 *      1600 px na potrzeby maila) — tu dłuższy bok domyślnie 2400 px (zlecenie fazy 4).
 *      Bez tego wgranie 8 MB prosto z aparatu na LTE kończy się timeoutem.
 *   2. `wykryjTypObrazu` — rozpoznanie formatu po MAGIC BYTES, nie po `Content-Type` (nagłówek
 *      deklaruje klient, nic nie gwarantuje). Pure, działa na `Uint8Array` — bez importu
 *      `node:*`, więc bezpieczne w bundlu przeglądarki (choć w praktyce wołane po stronie
 *      serwera, w trasie `POST /api/media`).
 *   3. `zbudujUrlObrazu` — jedyne miejsce, które składa publiczny URL z relatywnej `sciezka`
 *      zapisanej w `tresci.media`/dokumencie. ODMAWIA, gdy `sciezka` już wygląda jak absolutny
 *      URL — druga warstwa pod CHECK-iem bazy (`sciezka !~ '^[a-z]+://'`, migracja 001),
 *      "w bazie ścieżka, nigdy URL" (zlecenie, punkt 4 zakresu).
 */

/** Dłuższy bok zdjęcia po redukcji w przeglądarce, zanim w ogóle trafi do `POST /api/media`. */
export const MAX_WYMIAR_UPLOADU_PX = 2400;
const JAKOSC_JPEG_UPLOADU = 0.85;

/** Czysta arytmetyka skalowania — wydzielona z `skalujObrazWPrzegladarce`, żeby dało się ją
 *  przetestować jednostkowo bez `createImageBitmap`/`canvas` (niedostępne w jsdom/Vitest). */
export function obliczWymiarySkalowania(
  szerokosc: number,
  wysokosc: number,
  maksDluzszyBok = MAX_WYMIAR_UPLOADU_PX
): { szerokosc: number; wysokosc: number } {
  const skala = Math.min(1, maksDluzszyBok / Math.max(szerokosc, wysokosc));
  return {
    szerokosc: Math.max(1, Math.round(szerokosc * skala)),
    wysokosc: Math.max(1, Math.round(wysokosc * skala)),
  };
}

/**
 * Skaluje plik obrazu przez canvas w przeglądarce, dłuższy bok domyślnie `MAX_WYMIAR_UPLOADU_PX`.
 * Bez powiększania mniejszych zdjęć (`Math.min(1, …)` w `obliczWymiarySkalowania`). Rzuca, gdy
 * plik jest uszkodzony / nie da się zdekodować — wołający ma to złapać i pokazać komunikat
 * (tak jak `ContactForm.tsx` dziś robi dla maila).
 */
export async function skalujObrazWPrzegladarce(
  plik: File,
  maksDluzszyBok = MAX_WYMIAR_UPLOADU_PX,
  jakosc = JAKOSC_JPEG_UPLOADU
): Promise<File> {
  const bitmap = await createImageBitmap(plik);
  try {
    const { szerokosc, wysokosc } = obliczWymiarySkalowania(bitmap.width, bitmap.height, maksDluzszyBok);

    const canvas = document.createElement("canvas");
    canvas.width = szerokosc;
    canvas.height = wysokosc;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Brak kontekstu 2D canvas");
    ctx.drawImage(bitmap, 0, 0, szerokosc, wysokosc);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (wynik) => (wynik ? resolve(wynik) : reject(new Error("toBlob zwrócił null"))),
        "image/jpeg",
        jakosc
      );
    });

    return new File([blob], plik.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export type TypObrazu = "image/jpeg" | "image/png" | "image/webp";

/**
 * Rozpoznanie formatu po magic bytes. `Content-Type` z `FormData`/nagłówka HTTP jest
 * deklaracją klienta — plik `.jpg`, który w środku jest skryptem albo czymkolwiek innym, ma
 * przejść to sprawdzenie PRZED dotknięciem przez `sharp` (B11 z ADR). Zwraca `null`, gdy
 * pierwsze bajty nie pasują do żadnego ze wspieranych formatów.
 */
export function wykryjTypObrazu(bajty: Uint8Array): TypObrazu | null {
  if (bajty.length >= 3 && bajty[0] === 0xff && bajty[1] === 0xd8 && bajty[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bajty.length >= 8 &&
    bajty[0] === 0x89 &&
    bajty[1] === 0x50 &&
    bajty[2] === 0x4e &&
    bajty[3] === 0x47 &&
    bajty[4] === 0x0d &&
    bajty[5] === 0x0a &&
    bajty[6] === 0x1a &&
    bajty[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bajty.length >= 12 &&
    bajty[0] === 0x52 &&
    bajty[1] === 0x49 &&
    bajty[2] === 0x46 &&
    bajty[3] === 0x46 &&
    bajty[8] === 0x57 &&
    bajty[9] === 0x45 &&
    bajty[10] === 0x42 &&
    bajty[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/** `true`, gdy wartość wygląda jak absolutny URL (schemat + `://`) — to samo, czego pilnuje CHECK w bazie. */
export function czyWygladaJakAbsolutnyUrl(wartosc: string): boolean {
  return /^[a-z]+:\/\//i.test(wartosc);
}

/**
 * Buduje publiczny URL zdjęcia z relatywnej `sciezka` (`tresci.media.sciezka` /
 * `WartoscObraz.sciezka`) i adresu instancji Supabase. Rzuca na ścieżce, która już wygląda jak
 * absolutny URL — baza tego nie powinna nigdy zapisać (CHECK), ale kod strony/panelu ma się
 * zachować tak, jakby mogła: druga, niezależna warstwa (zlecenie, punkt 4 zakresu).
 */
export function zbudujUrlObrazu(sciezka: string, adresSupabase: string): string {
  if (czyWygladaJakAbsolutnyUrl(sciezka)) {
    throw new Error(`[cms] sciezka mediów wygląda jak absolutny URL, odmawiam: "${sciezka}"`);
  }
  const baza = adresSupabase.replace(/\/+$/, "");
  const czystaSciezka = sciezka.replace(/^\/+/, "");
  return `${baza}/storage/v1/object/public/tresci-media/${czystaSciezka}`;
}
