import type { ReactNode } from "react";

/**
 * Znacznik granic jednej sekcji głównej w drzewie renderowanym przez `StronaGlowna` (ddcarspa)
 * — faza 3 planu, część 2. CELOWO nie jest komponentem klienckim i nie używa Reactowego
 * Contextu: to zwykła funkcja, więc poza podglądem (`tryb !== "podglad"`) zwraca `children`
 * BEZ ŻADNEJ zmiany — zero dodatkowego węzła DOM, zero atrybutów, zero kosztu w produkcyjnym
 * HTML (zlecenie, punkt 4 zakresu). Tylko w podglądzie dokleja `data-cms-sekcja`, po którym
 * `PodgladNasluch.tsx` skanuje DOM przy starcie (`cms:gotowy`) i liczy wysokość.
 *
 * `display: contents` na wrapperze w trybie podglądu: węzeł istnieje (żeby dało się go
 * odnaleźć atrybutem), ale nie wpływa na layout floweksowy/gridowy rodzica — sekcje główne
 * (`<section>` wewnątrz Hero/QuickFacts/…) i tak same zarządzają swoim pudełkiem.
 */
export function Sekcja({
  id,
  tryb,
  children,
}: {
  id: string;
  tryb: "opublikowana" | "podglad";
  children: ReactNode;
}) {
  if (tryb !== "podglad") return <>{children}</>;
  return (
    <div data-cms-sekcja={id} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
