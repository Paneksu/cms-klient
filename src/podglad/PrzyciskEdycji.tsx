"use client";

/**
 * Plakietka „Edytuj to pole" / „Zmień zdjęcie" — wspólna dla `EdytowalnePodgladowe.tsx`
 * (punkt 2c zakresu: pola tekstowe zagnieżdżone w linku/przycisku strony) i
 * `EdytowalnyObraz.tsx` (punkt 7a: pola typu `obraz`, które w Gallery/BeforeAfter też siedzą
 * wewnątrz `<button>`).
 *
 * CELOWO `<span role="button">`, nie literalny `<button>`: oba miejsca wywołania bywają
 * zagnieżdżone wewnątrz PRAWDZIWEGO `<button>`/`<a>` strony (CTA z edytowalnym tekstem, kafel
 * galerii otwierający lightbox) — `<button>` wewnątrz `<button>` jest nieprawidłowym HTML
 * (przeglądarki różnie to naprawiają przy parsowaniu, czytniki ekranu gubią kontekst).
 * `role="button"` + `tabIndex={0}` + obsługa Enter/Spacji odtwarza semantykę i dostępność
 * klawiaturową bez łamania zagnieżdżenia.
 *
 * Pozycjonowanie: `position: absolute`, z boku pola — nie przesuwa układu strony, bo element
 * wypada z przepływu dokumentu niezależnie od tego, gdzie się znajduje. Wymaga POZYCJONOWANEGO
 * przodka w drzewie (u obu wywołujących jest to albo sam `<span data-cms-pole>` z
 * `position: relative`, albo — dla `EdytowalnyObraz`, gdzie wrapper jest `display: contents`
 * i nie tworzy kontekstu pozycjonowania — najbliższy prawdziwy przodek, czyli istniejący
 * `<div className="relative">`/`<button className="relative">` w `Gallery.tsx`/`BeforeAfter.tsx`).
 *
 * DWA WARIANTY POZYCJONOWANIA (poprawka z code review, punkt 7a zakresu):
 * - `"tekst"` (domyślny) — plakietka POZA obrysem pola (`insetInlineEnd: -1.6rem`), bo tekst w
 *   podglądzie zwykle nie ma `overflow-hidden` na przodku.
 * - `"obraz"` — plakietka WEWNĄTRZ obrysu (`top/insetInlineEnd: 0.5rem`, bez `translateY`).
 *   Przodek pozycjonowany dla `EdytowalnyObraz` to kafel strony (`Gallery.tsx:188`,
 *   `BeforeAfter.tsx:58`), a oba kafle mają `overflow-hidden` — plakietka POZA obrysem była tam
 *   zawsze ucinana i nigdy się nie pokazywała. Na urządzeniach dotykowych, gdzie ta plakietka
 *   jest JEDYNĄ wskazówką, że w zdjęcie można kliknąć (`EdytowalnyObrazPodgladowe.tsx`), to
 *   znaczyło, że punkt 7a planu nie działał w praktyce nigdzie.
 */
export function PrzyciskEdycji({
  etykieta,
  onKlik,
  wariant = "tekst",
}: {
  etykieta: string;
  onKlik: (e: { preventDefault: () => void; stopPropagation: () => void }) => void;
  wariant?: "tekst" | "obraz";
}) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={etykieta}
      onClick={onKlik}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onKlik(e);
        }
      }}
      style={{
        position: "absolute",
        ...(wariant === "obraz"
          ? { top: "0.5rem", insetInlineEnd: "0.5rem" }
          : { top: "50%", insetInlineEnd: "-1.6rem", transform: "translateY(-50%)" }),
        width: "1.5rem",
        height: "1.5rem",
        borderRadius: "999px",
        border: "1px solid #fff",
        background: "#FEBD59",
        color: "#141815",
        fontSize: "0.7rem",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2147483000,
        boxShadow: "0 1px 4px rgba(20,24,21,0.4)",
        cursor: "pointer",
      }}
    >
      ✎
    </span>
  );
}
