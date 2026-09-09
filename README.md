# @panekweb/cms

Kontrakt między panelem edycji treści a stronami, które te treści wyświetlają. Schemat opisuje, z jakich sekcji i pól składa się strona. Panel buduje z niego formularz, strona czyta gotowy dokument, a obie połowy sprawdzają, że mówią o tym samym schemacie.

Czysty TypeScript, bez zależności od aplikacji, która paczkę konsumuje. Używany w produkcji przez [edytor.panekweb.pl](https://edytor.panekweb.pl) i strony klientów.

## Co eksportuje

| Moduł | Co daje |
|---|---|
| `zdefiniujSchemat()`, `pole.*`, `sekcja()` | budowa schematu treści strony |
| `walidujDokument`, `walidujWartoscPola`, `zbudujDomyslnyDokument` | walidacja i naprawa dokumentu |
| `rozwinInterpolacje`, `formatujCene` | token `{cena.<ścieżka>}` rozwijany do kwoty z cennika |
| `podpiszWebhook`, `zweryfikujPodpisWebhook` | podpis HMAC-SHA256 pod webhookiem panel do strony |
| `kanonicznyJson`, `hashSchematu` | hash schematu, po którym panel i strona rozpoznają rozjazd wersji |

Typów pól jest jedenaście i zbiór jest zamknięty. Dodanie dwunastego to zmiana kontraktu, nie drobiazg: schemat musi dać się odwzorować na formularz w panelu, na walidację i na komponent po stronie strony.

## Trzy decyzje, które warto znać

**Walidacja nigdy nie rzuca wyjątkiem.** Brakujące albo niepoprawne pole dostaje wartość domyślną ze schematu. Strona klienta ma się wyświetlić nawet wtedy, gdy dokument w bazie jest starszy niż schemat albo ktoś zapisał do niego śmieć. Alternatywa, czyli twardy błąd walidacji, oznaczałaby białą stronę u klienta przy każdej rozbieżności.

**Paczka nie ma builda do `dist`.** `exports` w `package.json` wskazuje wprost na pliki `.ts` w `src/`, a konsument transpiluje ją razem ze sobą:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@panekweb/cms"],
};
```

Dzięki temu nie istnieje artefakt, który może się rozjechać ze źródłem. Klasyczny błąd w monorepo wygląda tak, że ktoś edytuje `src`, zapomina przebudować, a konsument dostaje stary kod i szuka błędu w niewłaściwym miejscu.

**HMAC i hash stoją poza barrelem.** `@panekweb/cms/hmac` i `@panekweb/cms/hash` są osobnymi ścieżkami importu, bo używają `node:crypto` i działają wyłącznie na serwerze. Gdyby wisiały w `index.ts`, jeden import w komponencie klienckim wciągnąłby `node:crypto` do bundla przeglądarki i wysadził build.

## Wersjonowanie

Konsument instaluje paczkę z dokładnego tagu, nigdy z gałęzi:

```json
{
  "dependencies": {
    "@panekweb/cms": "github:Paneksu/cms-klient#v0.1.0"
  }
}
```

Build z ruchomej gałęzi jest niereprodukowalny. Strona klienta zbudowana dwa razy z tego samego commita dałaby dwa różne wyniki, a wdrożenie psułoby się bez zmiany w repozytorium strony.
