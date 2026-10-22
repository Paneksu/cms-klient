import { describe, it, expect } from "vitest";
import {
  obliczWymiarySkalowania,
  wykryjTypObrazu,
  zbudujUrlObrazu,
  czyWygladaJakAbsolutnyUrl,
  MAX_WYMIAR_UPLOADU_PX,
} from "@panekweb/cms/obrazy";

describe("obliczWymiarySkalowania", () => {
  it("nie powiększa zdjęcia mniejszego niż limit", () => {
    expect(obliczWymiarySkalowania(800, 600, 2400)).toEqual({ szerokosc: 800, wysokosc: 600 });
  });

  it("skaluje dłuższy bok do limitu, zachowując proporcje", () => {
    // 4000x3000 -> dłuższy bok (4000) na 2400 => skala 0.6
    expect(obliczWymiarySkalowania(4000, 3000, 2400)).toEqual({ szerokosc: 2400, wysokosc: 1800 });
  });

  it("skaluje wg dłuższego boku, gdy to wysokość (pion — zdjęcie z telefonu)", () => {
    expect(obliczWymiarySkalowania(3000, 4000, 2400)).toEqual({ szerokosc: 1800, wysokosc: 2400 });
  });

  it("domyślny limit to MAX_WYMIAR_UPLOADU_PX (2400)", () => {
    expect(obliczWymiarySkalowania(8000, 6000)).toEqual(
      obliczWymiarySkalowania(8000, 6000, MAX_WYMIAR_UPLOADU_PX)
    );
  });

  it("nigdy nie zwraca zera (Math.max(1, …))", () => {
    expect(obliczWymiarySkalowania(1, 100000, 2400).szerokosc).toBeGreaterThanOrEqual(1);
  });
});

describe("wykryjTypObrazu — magic bytes, NIE Content-Type (B11 z ADR)", () => {
  it("rozpoznaje JPEG po FF D8 FF", () => {
    expect(wykryjTypObrazu(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
  });

  it("rozpoznaje PNG po sygnaturze ośmiu bajtów", () => {
    expect(
      wykryjTypObrazu(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))
    ).toBe("image/png");
  });

  it("rozpoznaje WEBP po RIFF….WEBP", () => {
    const bajty = new Uint8Array(12);
    bajty.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bajty.set([0, 0, 0, 0], 4); // rozmiar (nieistotny dla detekcji)
    bajty.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    expect(wykryjTypObrazu(bajty)).toBe("image/webp");
  });

  it("odrzuca plik .jpg, który w środku NIE jest obrazem (podszywanie się)", () => {
    // Skrypt tekstowy przemianowany na .jpg — pierwsze bajty to zwykły ASCII, nie żadna sygnatura.
    const falszywyPlik = new TextEncoder().encode("#!/bin/sh\necho pwned\n");
    expect(wykryjTypObrazu(falszywyPlik)).toBeNull();
  });

  it("odrzuca pusty bufor", () => {
    expect(wykryjTypObrazu(new Uint8Array(0))).toBeNull();
  });

  it("odrzuca GIF (poza zamkniętym zbiorem formatów wspieranych)", () => {
    const gif = new TextEncoder().encode("GIF89a");
    expect(wykryjTypObrazu(gif)).toBeNull();
  });
});

describe("zbudujUrlObrazu / czyWygladaJakAbsolutnyUrl — druga warstwa pod CHECK-iem bazy", () => {
  it("składa poprawny URL publiczny z relatywnej ścieżki", () => {
    expect(zbudujUrlObrazu("ddcarspa/abc-2400.webp", "https://supabase.panekweb.pl")).toBe(
      "https://supabase.panekweb.pl/storage/v1/object/public/tresci-media/ddcarspa/abc-2400.webp"
    );
  });

  it("toleruje końcowy ukośnik w adresie Supabase i wiodący w ścieżce", () => {
    expect(zbudujUrlObrazu("/ddcarspa/abc-2400.webp", "https://supabase.panekweb.pl/")).toBe(
      "https://supabase.panekweb.pl/storage/v1/object/public/tresci-media/ddcarspa/abc-2400.webp"
    );
  });

  it("rzuca, gdy sciezka wygląda jak absolutny URL (nigdy nie powinno przyjść z bazy, CHECK, ale kod ma się bronić)", () => {
    expect(() => zbudujUrlObrazu("https://zly.example/x.webp", "https://supabase.panekweb.pl")).toThrow();
    expect(() => zbudujUrlObrazu("http://zly.example/x.webp", "https://supabase.panekweb.pl")).toThrow();
  });

  it("czyWygladaJakAbsolutnyUrl rozpoznaje dowolny schemat z `://`, nie tylko http(s) — ta sama reguła co CHECK w bazie (`sciezka !~ '^[a-z]+://'`)", () => {
    expect(czyWygladaJakAbsolutnyUrl("ftp://zly.example/x.webp")).toBe(true);
    expect(czyWygladaJakAbsolutnyUrl("ddcarspa/plik.webp")).toBe(false);
  });
});
