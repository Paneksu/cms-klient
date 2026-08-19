/**
 * `@panekweb/cms/podglad` — komponenty i kontrakt "podgląd i klikanie w elementy" (faza 3
 * planu, część 2). Subpath OSOBNY od barrela głównego (`@panekweb/cms`), analogicznie do
 * `/hmac` i `/hash` — ale z odwrotnego powodu: te dwa są WYKLUCZONE z barrela, bo ciągną
 * `node:crypto`, którego nie wolno wysyłać do przeglądarki. Ten moduł jest BEZPIECZNY dla
 * przeglądarki (żaden z plików niżej nie importuje `node:crypto`), ale mimo to osobny subpath,
 * bo `Edytowalne`/`Sekcja` mają sens WYŁĄCZNIE dla stron-wizytówek renderujących podgląd —
 * panel (`edytor.panekweb.pl`) potrzebuje z tego pliku tylko `kontrakt.ts` (typy wiadomości),
 * nie komponentów React przeznaczonych do drzewa strony klienta.
 */

export * from "./kontrakt";
export { Sekcja } from "./Sekcja";
export { Edytowalne } from "./Edytowalne";
export { EdytowalnyObraz } from "./EdytowalnyObraz";
export { PodgladNasluch } from "./PodgladNasluch";
