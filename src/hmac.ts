/**
 * Podpis HMAC-SHA256 kontraktu publikacja→rewalidacja (ADR, sekcja "Jak strona czyta treść",
 * punkt 3 planu fazy 2). Jedna implementacja, konsumowana przez OBIE strony kontraktu:
 *
 *   - panel (`edytor.panekweb.pl/lib/publikacja.ts`) PODPISUJE żądanie do `webhook_url` strony,
 *   - wizytówka (`ddcarspa.pl/app/api/rewalidacja/route.ts`) WERYFIKUJE ten podpis.
 *
 * Trzymanie tej logiki w DWÓCH niezależnych plikach (jeden po stronie panelu, drugi po
 * stronie strony) to dokładnie ten rodzaj rozjazdu, który już raz kosztował czas w tym
 * projekcie (dwie kopie schematu, `wiedza/stan/stan-edytora-cms.md`, PUŁAPKI) — stąd wspólna
 * paczka `@panekweb/cms`, którą obie aplikacje i tak już importują.
 *
 * Ładunek podpisu to `${timestamp}.${klucz}` — `klucz` jest identyfikatorem tenanta
 * (`tresci.strony.klucz`), nie sekretem, ale wiązanie go w podpis chroni przed przeklejeniem
 * ważnego podpisu jednej strony do żądania rewalidacji innej (każda strona ma OSOBNY sekret
 * w `tresci.sekrety_stron`, ale w razie pomyłki w konfiguracji to dodatkowa warstwa).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Domyślne okno ważności podpisu — 5 minut, zgodnie ze zleceniem (ochrona przed replay). */
export const OKNO_WAZNOSCI_PODPISU_MS = 5 * 60 * 1000;

/**
 * Okno ważności podpisu podglądu (token w URL `/podglad?t=...` I ciasteczko `cms_podglad`) —
 * 30 minut, zgodnie ze zleceniem fazy 3 ("faza 3, część pierwsza — tryb podglądu"). Stała
 * jest TU, w paczce wspólnej dla obu aplikacji (`edytor.panekweb.pl/lib/podglad.ts` generuje
 * token, `ddcarspa.pl/lib/podgladAuth.ts` weryfikuje token i ciasteczko), z tego samego
 * powodu co `OKNO_WAZNOSCI_PODPISU_MS` wyżej: dwie niezależne kopie tej samej liczby w dwóch
 * repo to gwarantowany rozjazd (patrz komentarz nad `OKNO_WAZNOSCI_PODPISU_MS`).
 */
export const OKNO_WAZNOSCI_PODGLADU_MS = 30 * 60 * 1000;

/** `${timestamp}.${klucz}` podpisane HMAC-SHA256 sekretem strony, zwrócone jako hex. */
export function podpiszWebhook(sekretHmac: string, kluczStrony: string, timestamp: string): string {
  return createHmac("sha256", sekretHmac).update(`${timestamp}.${kluczStrony}`).digest("hex");
}

/** Timestamp jest liczbą (ms od epoki) i mieści się w oknie ważności względem "teraz". */
function czyTimestampSwiezy(timestamp: string, oknoMs: number): boolean {
  const wartosc = Number(timestamp);
  if (!Number.isFinite(wartosc)) return false;
  return Math.abs(Date.now() - wartosc) <= oknoMs;
}

/**
 * Weryfikacja ODPORNA NA CZAS (`timingSafeEqual`, nigdy `===` na surowych stringach —
 * porównanie znak-po-znaku ujawnia atakującemu długość poprawnego prefiksu przez pomiar
 * czasu odpowiedzi). Zwraca `false` przy KAŻDYM niepowodzeniu (zły podpis, przeterminowany
 * timestamp, różna długość) — celowo bez rozróżniania powodu w wyniku, żeby wywołujący nie
 * mógł przez pomyłkę zdradzić go w odpowiedzi HTTP.
 */
export function zweryfikujPodpisWebhook(opcje: {
  sekretHmac: string;
  kluczStrony: string;
  timestamp: string;
  podpis: string;
  oknoMs?: number;
}): boolean {
  const { sekretHmac, kluczStrony, timestamp, podpis, oknoMs = OKNO_WAZNOSCI_PODPISU_MS } = opcje;
  if (!czyTimestampSwiezy(timestamp, oknoMs)) return false;

  const oczekiwany = podpiszWebhook(sekretHmac, kluczStrony, timestamp);
  const bufOczekiwany = Buffer.from(oczekiwany, "hex");
  const bufPodpis = Buffer.from(podpis, "hex");
  // timingSafeEqual rzuca, gdy bufory mają różną długość — zły podpis o innej długości
  // (np. pusty string, albo losowe znaki niehex) jest wtedy zwyczajnym `false`, nie wyjątkiem.
  if (bufOczekiwany.length !== bufPodpis.length) return false;
  return timingSafeEqual(bufOczekiwany, bufPodpis);
}
