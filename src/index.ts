/**
 * `@panekweb/cms` — kontrakt schema-driven między panelem edytora a stronami-wizytówkami.
 *
 * Faza 1 (D2 z ADR-a): paczka żyje jako katalog w repo `edytor.panekweb.pl`, konsumowana
 * przez alias ścieżek TypeScript (`@panekweb/cms` → `paczki/cms/src/index.ts`), NIE jako
 * osobny pakiet npm workspaces. Decyzja "gustu" podjęta w tym zleceniu, uzasadnienie w
 * raporcie końcowym: w fazie 1 nic poza tym repo nie konsumuje paczki (ddcarspa.pl wchodzi
 * do gry w fazie 2), więc realny workspace + symlink w node_modules jest ryzykiem bez
 * korzyści na Windows (symlinki wymagają uprawnień), a wydzielenie do `Paneksu/cms-klient`
 * i tak ma nastąpić na granicy faz 1→2 (D2) — to i tak przepisanie importów, nie tylko
 * przeniesienie plików.
 */

export * from "./typy";
export * from "./schemat";
export * from "./walidacja";
export * from "./interpolacja";
// Widoczność pól (`ukryte`, punkt 6a planu przycięcia zakresu) — czysta prezentacja
// schematu, zero zależności, bezpieczna w bundlu klienta (patrz nagłówek `widocznosc.ts`).
export * from "./widocznosc";
// Silnik reguł językowych copy.md (faza 5, część 2) — bez `node:*`, bezpieczny w bundlu klienta
// (panel woła `sprawdzWartoscPola` na żywo z "use client" `PoleFormularza.tsx`).
export * from "./reguly";
// `obrazy.ts` nie importuje `node:*` (używa `Uint8Array`/`File`/`canvas`, wszystkie dostępne
// po obu stronach zależnie od kontekstu wywołania) — bezpieczne w barrelu klienta, w
// odróżnieniu od `hmac.ts` niżej.
export * from "./obrazy";
// UWAGA: `./hmac` celowo NIE jest tu re-eksportowany. Ten plik (`index.ts`) trafia też do
// bundla klienta (importowany przez `components/edytor/Edytor.tsx`, "use client") — `hmac.ts`
// używa `node:crypto`, którego webpack nie potrafi (i nie powinien) spakować do przeglądarki.
// Kod serwerowy importuje `@panekweb/cms/hmac` wprost (osobny subpath w package.json.exports),
// nigdy przez ten barrel. Odkryte przy pierwszym `next build` po dodaniu HMAC (raport fazy 2/2).
