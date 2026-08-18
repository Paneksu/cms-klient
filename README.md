# @panekweb/cms

Kontrakt schema-driven między panelem `edytor.panekweb.pl` a stronami-wizytówkami
(ADR: `wiedza/decyzje/ADR-edytor-panekweb-cms-wizytowek.md`, decyzja D2). Eksportuje:

- `zdefiniujSchemat()`, `pole.*`, `sekcja()` — budowa schematu treści strony (`src/schemat.ts`).
- Zamknięty zbiór 11 typów pól (`src/typy.ts`).
- `walidujDokument`, `walidujWartoscPola`, `zbudujDomyslnyDokument`, `znajdzPoleWSekcji`,
  `domyslnePolaSekcji` — walidacja i naprawa dokumentu (`src/walidacja.ts`). Zasada: brakujące
  lub niepoprawne pole nigdy nie rzuca wyjątkiem, dostaje wartość domyślną ze schematu.
- `rozwinInterpolacje`, `formatujCene`, `zawieraTokenCeny` — token `{cena.<ścieżka>}`
  rozwijany do kwoty z sekcji `cennik` dokumentu (`src/interpolacja.ts`).
- `podpiszWebhook`, `zweryfikujPodpisWebhook` — podpis HMAC-SHA256, subpath `@panekweb/cms/hmac`
  (świadomie poza barrelem `index.ts` — używa `node:crypto`, serwer-only), `src/hmac.ts`.
- `kanonicznyJson`, `hashSchematu` — hash kanonicznego JSON-a schematu (`GET /api/cms/schemat`
  strony ↔ `tresci.strony.schemat_hash` panelu), subpath `@panekweb/cms/hash`, też
  serwer-only i poza barrelem, ten sam powód co `hmac.ts`, `src/hash.ts`.

## Jak to jest konsumowane — brak kroku budowania

Paczka **nie ma builda do `dist`**. `package.json.exports` wskazuje wprost na pliki `.ts`
w `src/`. Konsument (Next.js) musi mieć w `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@panekweb/cms"],
  // ...
};
```

Dzięki temu nie ma artefaktu `dist/`, który może się rozjechać z `src/` (klasyczny błąd
monorepo: ktoś edytuje `src`, zapomina przebudować, konsument dostaje stary kod). Next
kompiluje paczkę razem z resztą aplikacji przy każdym buildzie.

## Stan dzisiejszy: instalacja ze ścieżki lokalnej

Dopóki paczka mieszka w `paczki/cms/` wewnątrz repo `edytor.panekweb.pl`, konsument
(`ddcarspa.pl` i kolejne wizytówki) instaluje ją jako zależność ze ścieżki lokalnej:

```json
{
  "dependencies": {
    "@panekweb/cms": "file:../edytor.panekweb.pl/paczki/cms"
  }
}
```

To działa wyłącznie lokalnie (oba repo muszą leżeć obok siebie na tym samym dysku) i **nie
zadziała na buildzie w Coolify**, gdzie `ddcarspa.pl` jest budowane z własnego repo, bez
dostępu do `edytor.panekweb.pl`. To jest oczekiwane — jest to stan przejściowy do czasu
wydzielenia paczki do osobnego repo (patrz niżej), nie coś do "naprawienia" tutaj.

## Wydzielenie do `github:Paneksu/cms-klient` — co dokładnie podmienić

Zgodnie z ADR (D2), na granicy faz 1→2 paczka wychodzi do osobnego, prywatnego repo
`Paneksu/cms-klient`. Checklist dla tego, kto to wykona:

1. **Skopiuj `paczki/cms/` do nowego repo** `Paneksu/cms-klient` — cała zawartość tego
   katalogu (`src/`, `package.json`, `tsconfig.json`, `README.md`), bez zmian w kodzie źródłowym.
2. **Tag semver od razu przy pierwszym pushu**: `v0.1.0`, nie `1.0.0` — API będzie się jeszcze
   ruszać do końca fazy 3 (podgląd, `postMessage`, upload zdjęć mogą dodać typy/eksporty).
   Załóż `CHANGELOG.md` od tego tagu.
3. **W `ddcarspa.pl/package.json` podmień**:
   ```diff
   - "@panekweb/cms": "file:../edytor.panekweb.pl/paczki/cms"
   + "@panekweb/cms": "github:Paneksu/cms-klient#v0.1.0"
   ```
   **Zawsze dokładny tag, nigdy gałąź** (`#v0.1.0`, nigdy `#main`) — build z ruchomej gałęzi
   jest niereprodukowalny i niedeterministycznie psuje deploy strony klienta (ADR, D2).
4. **`next.config.ts` w `ddcarspa.pl` zostaje bez zmian** — `transpilePackages: ["@panekweb/cms"]`
   działa identycznie niezależnie od tego, skąd `npm`/`pnpm` wziął paczkę.
5. **Usuń `paczki/cms/` z repo `edytor.panekweb.pl`**, dodaj `@panekweb/cms` jako zależność
   `github:Paneksu/cms-klient#v0.1.0` w `edytor.panekweb.pl/package.json`, usuń alias
   `@panekweb/cms` z `tsconfig.json` paczek edytora (`paths`).
6. **Repo `cms-klient` musi być prywatne** (niesie nazwy pól i kształt treści klientów) —
   GitHub, nie publikacja do rejestru npm (ADR: "prywatne repo GitHub wystarcza i nie wymaga
   konta organizacji npm").
7. Przy każdym bumpie: podnieś wersję w `package.json` paczki, nowy tag, `CHANGELOG.md`,
   **dopiero potem** zaktualizuj tag w `package.json` konsumentów. Nigdy odwrotnie.

## Zasada zamkniętego kierunku zależności

`edytor` → `@panekweb/cms` ← `ddcarspa.pl` (i kolejne wizytówki). Paczka **nie importuje
niczego z `edytor.panekweb.pl`** — ani z aplikacji panelu, ani z `cms/ddcarspa.ts` (to jest
treść jednego klienta, nie kontrakt wspólny). Naruszenie tego kierunku uniemożliwiłoby
wydzielenie z kroku 1 bez przepisywania importów.

## Typy pól (zamknięty zbiór, 11 pozycji)

`tekst`, `tekst_dlugi`, `bogaty`, `liczba`, `cena`, `wybor`, `przelacznik`, `obraz`, `link`,
`lista`, `grupa`. Rozszerzenie o nowy typ jest decyzją architektoniczną (nowy ADR), nie
dopisaniem wariantu w `src/typy.ts` — patrz ryzyko R11 w ADR.
