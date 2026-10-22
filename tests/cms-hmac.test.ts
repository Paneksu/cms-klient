import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OKNO_WAZNOSCI_PODPISU_MS,
  podpiszWebhook,
  zweryfikujPodpisWebhook,
} from "@panekweb/cms/hmac";

const SEKRET = "test-secret-not-real";
const KLUCZ = "strona-a";
const TERAZ = Date.UTC(2026, 9, 1, 12, 0, 0);

describe("webhook HMAC signature", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function podpisane(timestamp = String(TERAZ)) {
    return { sekretHmac: SEKRET, kluczStrony: KLUCZ, timestamp, podpis: podpiszWebhook(SEKRET, KLUCZ, timestamp) };
  }

  it("accepts a fresh, correct signature", () => {
    vi.useFakeTimers({ now: TERAZ });
    expect(zweryfikujPodpisWebhook(podpisane())).toBe(true);
  });

  it("rejects a signature made with another secret", () => {
    vi.useFakeTimers({ now: TERAZ });
    const ts = String(TERAZ);
    const podpis = podpiszWebhook("other-secret", KLUCZ, ts);
    expect(zweryfikujPodpisWebhook({ sekretHmac: SEKRET, kluczStrony: KLUCZ, timestamp: ts, podpis })).toBe(false);
  });

  it("binds the site key: a valid signature for one site does not work for another", () => {
    vi.useFakeTimers({ now: TERAZ });
    expect(zweryfikujPodpisWebhook({ ...podpisane(), kluczStrony: "strona-b" })).toBe(false);
  });

  it("rejects a replay outside the five-minute window, in both directions", () => {
    vi.useFakeTimers({ now: TERAZ });
    expect(zweryfikujPodpisWebhook(podpisane(String(TERAZ - OKNO_WAZNOSCI_PODPISU_MS - 1)))).toBe(false);
    expect(zweryfikujPodpisWebhook(podpisane(String(TERAZ + OKNO_WAZNOSCI_PODPISU_MS + 1)))).toBe(false);
    expect(zweryfikujPodpisWebhook(podpisane(String(TERAZ - OKNO_WAZNOSCI_PODPISU_MS)))).toBe(true);
  });

  it("returns false instead of throwing on malformed input", () => {
    vi.useFakeTimers({ now: TERAZ });
    expect(zweryfikujPodpisWebhook({ ...podpisane(), podpis: "" })).toBe(false);
    expect(zweryfikujPodpisWebhook({ ...podpisane(), podpis: "not-hex" })).toBe(false);
    expect(zweryfikujPodpisWebhook({ ...podpisane(), timestamp: "yesterday" })).toBe(false);
  });
});
