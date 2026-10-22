/**
 * Podpis HMAC-SHA256 kontraktu publikacja → rewalidacja. Jedna implementacja dla obu stron:
 *
 *   - panel edycji PODPISUJE żądanie wysyłane na `webhook_url` strony,
 *   - strona klienta WERYFIKUJE ten podpis w swojej trasie rewalidacji.
 *
 * Dwie niezależne kopie tej logiki (po jednej w każdej aplikacji) prędzej czy później się
 * rozjadą, dlatego żyje we wspólnej paczce, którą obie aplikacje i tak importują.
 *
 * Ładunek podpisu to `${timestamp}.${klucz}`. `klucz` jest identyfikatorem strony, nie sekretem,
 * ale wiązanie go w podpis chroni przed przeklejeniem ważnego podpisu jednej strony do żądania
 * rewalidacji innej. Każda strona ma osobny sekret, więc to druga warstwa na wypadek pomyłki
 * w konfiguracji.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** Domyślne okno ważności podpisu: 5 minut (ochrona przed powtórzeniem żądania). */
export const OKNO_WAZNOSCI_PODPISU_MS = 5 * 60 * 1000;

/**
 * Okno ważności podpisu podglądu (token w URL `/podglad?t=...` i ciasteczko `cms_podglad`): 30 minut.
 * Panel generuje token, strona weryfikuje token i ciasteczko. Stała siedzi tutaj z tego samego
 * powodu co `OKNO_WAZNOSCI_PODPISU_MS`: ta sama liczba w dwóch repozytoriach to pewny rozjazd.
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
