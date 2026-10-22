import { describe, it, expect } from "vitest";
import { pole, sekcja, zdefiniujSchemat } from "@panekweb/cms";
import { sprawdzWartoscPola, sprawdzWykrzyknikiDokumentu, zbierzNaruszeniaDokumentu } from "@panekweb/cms/reguly";
import type { DokumentTresci } from "@panekweb/cms";

const NBSP = " ";

/**
 * Testy silnika reguł językowych (`paczki/cms/src/reguly.ts`, faza 5 część 2). Zlecenie:
 * reguły są DANYMI (`Pole.reguly` + `SchematStrony.regulyKopii`), silnik jest wspólny.
 * Ostrzeżenia (`poziom: "ostrzezenie"`) NIE MAJĄ blokować publikacji, błędy (`"blad"`) MAJĄ.
 */

const config = {
  zakazaneSlowa: ["dekontaminacja", "PPF", "korekta lakieru"],
  zakazaneZwroty: ["Witamy na naszej stronie", "Dowiedz się więcej"],
  telefonKanoniczny: `700${NBSP}100${NBSP}200`,
  maksWykrzyknikowDokument: 1,
  metaTitleMaks: 60,
  metaDescriptionMin: 120,
  metaDescriptionMaks: 165,
};

const schemat = zdefiniujSchemat({
  wersja: 1,
  regulyKopii: config,
  meta: {
    title: pole.tekst("Tytuł", "x".repeat(30), { reguly: ["dlugosc_meta_title"] }),
    description: pole.tekstDlugi("Opis", "x".repeat(140), { reguly: ["dlugosc_meta_description"] }),
  },
  wspolne: {
    telefonHref: pole.tekst("Telefon href", "tel:+48700100200", { reguly: [] }),
  },
  sekcje: [
    sekcja("hero", "Hero", {
      naglowek: pole.tekst("Nagłówek", "Detailing samochodowy"),
      opis: pole.tekstDlugi("Opis", "Myjemy ręcznie."),
    }),
    sekcja("faq", "FAQ", {
      pytania: pole.lista(
        "Pytania",
        { odpowiedz: pole.tekstDlugi("Odpowiedź", "") },
        [{ odpowiedz: "" }]
      ),
    }),
  ],
});

function dokBazowy(): DokumentTresci {
  return {
    wersjaSchematu: 1,
    meta: { title: "x".repeat(30), description: "x".repeat(140) },
    wspolne: { telefonHref: "tel:+48700100200" },
    sekcje: [
      { id: "hero", typ: "hero", widoczna: true, pola: { naglowek: "Detailing samochodowy", opis: "Myjemy ręcznie." } },
      { id: "faq", typ: "faq", widoczna: true, pola: { pytania: [{ odpowiedz: "Kosztuje od 130 zł." }] } },
    ],
  };
}

describe("sprawdzWartoscPola — zakazane słowa i zwroty (BLOKADA)", () => {
  const pTekst = pole.tekst("Opis", "");

  it("zgłasza blad na dokładne dopasowanie zakazanego słowa", () => {
    const n = sprawdzWartoscPola(pTekst, "hero.opis", "Robimy dekontaminacja silnika.", config);
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({ regulaId: "zakazane_slowa", poziom: "blad" });
  });

  it("NIE łapie odmienionej (fleksyjnej) formy słowa spoza listy dosłownej — ograniczenie znane i udokumentowane", () => {
    // Silnik dopasowuje frazy DOSŁOWNIE (case-insensitive), nie stemuje polskiej fleksji.
    // "dekontaminację" (biernik) nie jest tym samym ciągiem znaków co "dekontaminacja" z listy.
    // Udokumentowane w raporcie jako świadome ograniczenie — lista w `regulyKopii.zakazaneSlowa`
    // powinna zawierać najczęstsze odmienione formy, jeśli mają być łapane.
    const n = sprawdzWartoscPola(pTekst, "x", "Robimy dekontaminację silnika.", config);
    expect(n.filter((v) => v.regulaId === "zakazane_slowa")).toHaveLength(0);
  });

  it("zgłasza blad na zakazany zwrot wielowyrazowy", () => {
    const n = sprawdzWartoscPola(pTekst, "hero.opis", "Witamy na naszej stronie Firma!", config);
    expect(n.some((x) => x.regulaId === "zakazane_zwroty")).toBe(true);
  });

  it("nie zgłasza nic na czystym tekście", () => {
    const n = sprawdzWartoscPola(pTekst, "hero.opis", "Myjemy ręcznie, bez szczotek.", config);
    expect(n.filter((x) => x.regulaId === "zakazane_slowa" || x.regulaId === "zakazane_zwroty")).toHaveLength(0);
  });

  it("nie łapie fragmentu słowa wewnątrz innego, niepowiązanego słowa", () => {
    // "PPF" jako fraza NIE powinna dopasować się do zwykłego słowa zawierającego te litery
    // gdzie indziej w losowej kolejności — sanity check granic frazy.
    const n = sprawdzWartoscPola(pTekst, "x", "Auto jest czyste i ładne.", config);
    expect(n).toHaveLength(0);
  });
});

describe("sprawdzWartoscPola — półpauza (BLOKADA, z wyjątkiem zakresów liczbowych)", () => {
  const pTekst = pole.tekst("Opis", "");

  it("blokuje półpauzę w zwykłym zdaniu", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Mycie – szybkie i tanie.", config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "polpauza", poziom: "blad" })]);
  });

  it("PRZEPUSZCZA zakres liczbowy bez spacji, np. 2–3", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Dodaj 2–3 zdjęcia auta.", config);
    expect(n.filter((v) => v.regulaId === "polpauza")).toHaveLength(0);
  });

  it("PRZEPUSZCZA zakres z przecinkiem dziesiętnym, np. 1,5–2 godziny", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Trwa 1,5–2 godziny.", config);
    expect(n.filter((v) => v.regulaId === "polpauza")).toHaveLength(0);
  });

  it("łapie półpauzę OBOK dozwolonego zakresu w tym samym tekście", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Trwa 2–3 godziny – zależnie od auta.", config);
    expect(n.filter((v) => v.regulaId === "polpauza")).toHaveLength(1);
  });
});

describe("sprawdzWartoscPola — telefon (BLOKADA na inny zapis niż kanoniczny)", () => {
  const pTekst = pole.tekst("Telefon", "");

  it("blokuje zwykłe spacje zamiast twardych", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Zadzwoń 700 100 200", config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "telefon", poziom: "blad" })]);
  });

  it("blokuje myślniki", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "700-100-200", config);
    expect(n.some((v) => v.regulaId === "telefon")).toBe(true);
  });

  it("PRZEPUSZCZA dokładnie kanoniczny zapis z twardymi spacjami", () => {
    const n = sprawdzWartoscPola(pTekst, "x", `Zadzwoń 700${NBSP}100${NBSP}200`, config);
    expect(n.filter((v) => v.regulaId === "telefon")).toHaveLength(0);
  });

  it("pole z reguly:[] (np. telefonHref) NIE jest w ogóle sprawdzane", () => {
    const pHref = pole.tekst("Telefon href", "", { reguly: [] });
    const n = sprawdzWartoscPola(pHref, "wspolne.telefonHref", "tel:+48700100200", config);
    expect(n).toHaveLength(0);
  });
});

describe("sprawdzWartoscPola — format ceny (OSTRZEŻENIE, nie blokuje)", () => {
  const pTekst = pole.tekstDlugi("Odpowiedź", "");

  it("zgłasza ostrzeżenie na cenę wpisaną prozą", () => {
    const n = sprawdzWartoscPola(pTekst, "faq.pytania.0.odpowiedz", "Kosztuje od 130 do 190 zł.", config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "format_ceny", poziom: "ostrzezenie" })]);
  });

  it("nie zgłasza nic dla tokenu {cena...}", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Kosztuje od {cena.uslugiGlowne.0.cenaS}.", config);
    expect(n.filter((v) => v.regulaId === "format_ceny")).toHaveLength(0);
  });
});

describe("sprawdzWartoscPola — forma „Ty” (OSTRZEŻENIE)", () => {
  const pTekst = pole.tekst("Opis", "");

  it("ostrzega o formie Państwo/Państwa", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Zapraszamy Państwa do skorzystania z usługi.", config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "forma_ty", poziom: "ostrzezenie" })]);
  });

  it("nie ostrzega przy formie Ty", () => {
    const n = sprawdzWartoscPola(pTekst, "x", "Twoje auto czeka gotowe.", config);
    expect(n.filter((v) => v.regulaId === "forma_ty")).toHaveLength(0);
  });
});

describe("sprawdzWartoscPola — długość meta (OSTRZEŻENIE z licznikiem)", () => {
  it("ostrzega, gdy title przekracza limit", () => {
    const pTitle = pole.tekst("Tytuł", "", { reguly: ["dlugosc_meta_title"] });
    const n = sprawdzWartoscPola(pTitle, "meta.title", "x".repeat(70), config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "dlugosc_meta_title", poziom: "ostrzezenie" })]);
    expect(n[0].komunikat).toContain("70");
  });

  it("ostrzega, gdy description jest za krótki albo za długi, milczy w widełkach", () => {
    const pDesc = pole.tekstDlugi("Opis", "", { reguly: ["dlugosc_meta_description"] });
    expect(sprawdzWartoscPola(pDesc, "x", "x".repeat(50), config)).toHaveLength(1);
    expect(sprawdzWartoscPola(pDesc, "x", "x".repeat(200), config)).toHaveLength(1);
    expect(sprawdzWartoscPola(pDesc, "x", "x".repeat(140), config)).toHaveLength(0);
  });
});

describe("sprawdzWykrzyknikiDokumentu — liczy CAŁY DOKUMENT, nie pole", () => {
  it("bez wykrzykników — pusto", () => {
    expect(sprawdzWykrzyknikiDokumentu(schemat, dokBazowy(), config)).toHaveLength(0);
  });

  it("dokładnie jeden wykrzyknik w całym dokumencie — pusto (w limicie)", () => {
    const d = dokBazowy();
    d.sekcje[0].pola.naglowek = "Detailing samochodowy!";
    expect(sprawdzWykrzyknikiDokumentu(schemat, d, config)).toHaveLength(0);
  });

  it("drugi wykrzyknik W INNYM POLU — ostrzeżenie (nie blad)", () => {
    const d = dokBazowy();
    d.sekcje[0].pola.naglowek = "Detailing samochodowy!";
    d.sekcje[0].pola.opis = "Myjemy ręcznie!";
    const n = sprawdzWykrzyknikiDokumentu(schemat, d, config);
    expect(n).toHaveLength(1);
    expect(n[0].poziom).toBe("ostrzezenie");
    expect(n[0].komunikat).toContain("2");
  });

  it("trzeci wykrzyknik — blad, blokuje", () => {
    const d = dokBazowy();
    d.sekcje[0].pola.naglowek = "Detailing samochodowy!";
    d.sekcje[0].pola.opis = "Myjemy ręcznie!";
    d.meta.title = "x".repeat(29) + "!";
    const n = sprawdzWykrzyknikiDokumentu(schemat, d, config);
    expect(n).toHaveLength(1);
    expect(n[0].poziom).toBe("blad");
  });

  it("dwa wykrzykniki W JEDNYM polu liczą się jak dwa, nie jak jeden", () => {
    const d = dokBazowy();
    d.sekcje[0].pola.naglowek = "Ale super!!";
    const n = sprawdzWykrzyknikiDokumentu(schemat, d, config);
    expect(n).toEqual([expect.objectContaining({ poziom: "ostrzezenie" })]);
  });
});

describe("zbierzNaruszeniaDokumentu — pełny dokument, telefonHref (reguly:[]) nie jest fałszywym alarmem", () => {
  it("dokument bazowy: telefonHref w formacie tel: nie generuje naruszenia „telefon”", () => {
    const n = zbierzNaruszeniaDokumentu(schemat, dokBazowy());
    expect(n.filter((v) => v.regulaId === "telefon")).toHaveLength(0);
  });

  it("dokument bazowy: cena prozą w FAQ daje TYLKO ostrzeżenie — dokument nadal 'publikowalny'", () => {
    const n = zbierzNaruszeniaDokumentu(schemat, dokBazowy());
    const bledy = n.filter((v) => v.poziom === "blad");
    const ostrzezenia = n.filter((v) => v.poziom === "ostrzezenie");
    expect(bledy).toHaveLength(0);
    expect(ostrzezenia.some((v) => v.regulaId === "format_ceny")).toBe(true);
  });

  it("wstrzyknięcie zakazanego słowa w dowolnym polu blokuje CAŁY dokument", () => {
    const d = dokBazowy();
    d.sekcje[0].pola.opis = "Wykonujemy korekta lakieru na życzenie.";
    const n = zbierzNaruszeniaDokumentu(schemat, d);
    expect(n.some((v) => v.poziom === "blad" && v.regulaId === "zakazane_slowa")).toBe(true);
  });
});

describe("zbierzNaruszeniaDokumentu — pole `ukryte` nie ma jak zablokować publikacji (P5, punkt 6a planu)", () => {
  // Kontrolny schemat: to samo pole raz z `ukryte: true`, raz bez — żeby test nie przechodził
  // z niewłaściwego powodu (np. gdyby reguła w ogóle nie łapała tej treści).
  const schematZUkrytym = zdefiniujSchemat({
    wersja: 1,
    regulyKopii: config,
    meta: {},
    wspolne: {},
    sekcje: [
      sekcja("techniczna", "Techniczna", {
        alt: pole.tekst("Opis alternatywny", "", { ukryte: true }),
      }),
    ],
  });

  const schematBezUkrytego = zdefiniujSchemat({
    wersja: 1,
    regulyKopii: config,
    meta: {},
    wspolne: {},
    sekcje: [
      sekcja("techniczna", "Techniczna", {
        alt: pole.tekst("Opis alternatywny", ""),
      }),
    ],
  });

  function dokZLamiacaTrescia(): DokumentTresci {
    return {
      wersjaSchematu: 1,
      meta: {},
      wspolne: {},
      sekcje: [{ id: "techniczna", typ: "techniczna", widoczna: true, pola: { alt: "Robimy dekontaminacja silnika." } }],
    };
  }

  it("pole ukryte łamiące regułę NIE daje naruszenia", () => {
    const n = zbierzNaruszeniaDokumentu(schematZUkrytym, dokZLamiacaTrescia());
    expect(n.filter((v) => v.regulaId === "zakazane_slowa")).toHaveLength(0);
  });

  it("kontrola: to samo pole BEZ flagi ukryte daje naruszenie — test nie przechodzi z niewłaściwego powodu", () => {
    const n = zbierzNaruszeniaDokumentu(schematBezUkrytego, dokZLamiacaTrescia());
    expect(n.some((v) => v.regulaId === "zakazane_slowa" && v.poziom === "blad")).toBe(true);
  });
});

describe("sprawdzWykrzyknikiDokumentu — pole ukryte nie ma jak zablokować publikacji (przegląd kodu, 20.08.2026, bloker punkt 1)", () => {
  // Ten sam kształt błędu co P5 (opisany wyżej dla `zbierzNaruszeniaDokumentu`), ale w REGULE
  // CAŁODOKUMENTOWEJ, którą naprawiono osobno: `sprawdzWykrzyknikiDokumentu` chodziła po
  // DOKUMENCIE, nie po schemacie, więc `idzPoPolachGrupy` (który odsiewa `ukryte`) jej nie
  // obejmował — limit wykrzykników mógł zostać wyczerpany polem, którego redaktor nie widzi
  // w formularzu.
  const schematZUkrytymPlaceholderem = zdefiniujSchemat({
    wersja: 1,
    regulyKopii: config,
    meta: {},
    wspolne: {},
    sekcje: [
      sekcja("kontakt", "Kontakt", {
        formularz: pole.grupa("Formularz", {
          placeholderWiadomosc: pole.tekst("Placeholder wiadomości", "", { ukryte: true }),
        }),
        naglowek: pole.tekst("Nagłówek", ""),
      }),
    ],
  });

  function dokZTrzemaWykrzyknikamiWUkrytym(): DokumentTresci {
    return {
      wersjaSchematu: 1,
      meta: {},
      wspolne: {},
      sekcje: [
        {
          id: "kontakt",
          typ: "kontakt",
          widoczna: true,
          pola: {
            formularz: { placeholderWiadomosc: "Napisz!!! Co!" },
            naglowek: "Skontaktuj się",
          },
        },
      ],
    };
  }

  it("trzy wykrzykniki w ukrytym polu NIE dają naruszenia (redaktor nie ma jak ich usunąć)", () => {
    const n = sprawdzWykrzyknikiDokumentu(schematZUkrytymPlaceholderem, dokZTrzemaWykrzyknikamiWUkrytym(), config);
    expect(n).toHaveLength(0);
  });

  it("to samo przez zbierzNaruszeniaDokumentu (droga PUBLIKACJI) — publikacja nie jest blokowana", () => {
    const n = zbierzNaruszeniaDokumentu(schematZUkrytymPlaceholderem, dokZTrzemaWykrzyknikamiWUkrytym());
    expect(n.filter((v) => v.regulaId === "wykrzykniki")).toHaveLength(0);
  });

  it("kontrola: te same trzy wykrzykniki w WIDOCZNYM polu blokują — test nie przechodzi z niewłaściwego powodu", () => {
    const d = dokZTrzemaWykrzyknikamiWUkrytym();
    d.sekcje[0].pola.naglowek = "Napisz!!! Co!";
    d.sekcje[0].pola.formularz = { placeholderWiadomosc: "" };
    const n = sprawdzWykrzyknikiDokumentu(schematZUkrytymPlaceholderem, d, config);
    expect(n).toEqual([expect.objectContaining({ regulaId: "wykrzykniki", poziom: "blad" })]);
  });
});
