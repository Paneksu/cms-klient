# @panekweb/cms

[![CI](https://github.com/Paneksu/cms-klient/actions/workflows/ci.yml/badge.svg)](https://github.com/Paneksu/cms-klient/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

The contract between my CMS panel and the client websites it edits. A schema describes which sections and fields a page has. The panel builds its edit form from that schema, the website reads the finished document, and both sides check that they are talking about the same schema.

It is plain TypeScript with no dependency on the app that consumes it. It runs in production behind [edytor.panekweb.pl](https://edytor.panekweb.pl) and the client sites edited there. Identifiers in the code are in Polish, because so are my clients and the editor UI.

## What it exports

| Module | What it gives you |
|---|---|
| `zdefiniujSchemat()`, `pole.*`, `sekcja()` | building the content schema of a page |
| `walidujDokument`, `walidujWartoscPola`, `zbudujDomyslnyDokument` | validating and repairing a document |
| `rozwinInterpolacje`, `formatujCene` | a `{cena.<path>}` token expanded to a price from the price list |
| `@panekweb/cms/hmac`: `podpiszWebhook`, `zweryfikujPodpisWebhook` | HMAC-SHA256 signature on the panel-to-site webhook |
| `@panekweb/cms/hash`: `kanonicznyJson`, `hashSchematu` | a schema hash that tells the panel and the site their versions have drifted |

There are eleven field types and the set is closed. Adding a twelfth changes the contract: every field type has to map to a form control in the panel, to validation, and to a component on the website.

## Usage

```ts
import { pole, sekcja, zdefiniujSchemat, walidujDokument } from "@panekweb/cms";

export const schemat = zdefiniujSchemat({
  wersja: 1,
  meta: { title: pole.tekst("Title", "Car detailing in Rybnik") },
  wspolne: { telefon: pole.tekst("Phone", "") },
  sekcje: [
    sekcja("hero", "Hero", {
      naglowek: pole.tekst("Headline", "Hand wash, no brushes", { maks: 60 }),
      aktywny: pole.przelacznik("Visible", true),
    }),
    sekcja("cennik", "Prices", {
      mycieOd: pole.cena("Wash from", 130),
      dodatki: pole.lista("Extras", { nazwa: pole.tekst("Name", ""), cena: pole.cena("Price", 0) }, []),
    }),
  ],
});

// Never throws. Missing or broken fields get their schema default and are listed in `naprawiono`.
const { dokument, naprawiono } = walidujDokument(schemat, dataFromDatabase);
```

On the website, the revalidation route checks the signature before doing anything else (server only):

```ts
import { zweryfikujPodpisWebhook } from "@panekweb/cms/hmac";

const ok = zweryfikujPodpisWebhook({
  sekretHmac: process.env.CMS_WEBHOOK_SEKRET!,
  kluczStrony: process.env.CMS_KLUCZ_STRONY!,
  timestamp: request.headers.get("x-cms-timestamp") ?? "",
  podpis: request.headers.get("x-cms-signature") ?? "",
});
if (!ok) return new Response("Rejected", { status: 401 });
```

## Three decisions worth knowing

**Validation never throws.** A missing or invalid field gets the default value from the schema. A client's website has to render even when the document in the database is older than the schema, or when someone saved garbage into it. The alternative, a hard validation error, would mean a blank page for the client on every mismatch.

**The package has no build step.** `exports` in `package.json` points straight at the `.ts` files in `src/`, and the consumer transpiles them along with its own code:

```ts
const nextConfig: NextConfig = {
  transpilePackages: ["@panekweb/cms"],
};
```

So there is no build artefact that can fall out of sync with the source. The classic monorepo bug goes like this: someone edits `src`, forgets to rebuild, the consumer gets old code, and the bug hunt starts in the wrong place.

**HMAC and hash live outside the barrel.** `@panekweb/cms/hmac` and `@panekweb/cms/hash` are separate import paths, because they use `node:crypto` and only work on the server. If they were exported from `index.ts`, a single import in a client component would pull `node:crypto` into the browser bundle and break the build.

## Security notes

- The signed payload is `${timestamp}.${siteKey}`, signed with a secret that is different for every site. Binding the site key into the signature means a valid signature for one site cannot be replayed against another, even if two sites were misconfigured with the same secret.
- The timestamp must be within five minutes of the receiver's clock, in either direction. Preview tokens get a 30-minute window.
- Signatures are compared with `timingSafeEqual`, and a length mismatch returns `false` before the comparison, so malformed input never throws.
- Every failure (bad signature, stale timestamp, malformed hex) returns the same `false`. The caller cannot leak the reason in its HTTP response by accident.
- The signature does not cover the request body, and that is deliberate for this webhook. The request carries no content. It only tells the site to revalidate, and after verifying it the site fetches the document from its own source. The worst a replay inside the window can do is trigger one more revalidation.

Tests for these properties are in [`tests/cms-hmac.test.ts`](tests/cms-hmac.test.ts).

## Installing

Consumers install from a release tarball pinned to a tag, never from a branch:

```json
{
  "dependencies": {
    "@panekweb/cms": "https://github.com/Paneksu/cms-klient/archive/refs/tags/cms-v0.5.0.tar.gz"
  }
}
```

A build from a moving branch is not reproducible: the same commit of a client site could build differently twice, and a deploy could break without any change in the site's repository. I use the tarball URL rather than `github:` because npm rewrites `github:` and `git+https:` to `git+ssh://` in the lockfile, and the build container has neither git nor an SSH key.

## Development

```bash
npm install
npm run typecheck
npm run lint
npm test
```

CI runs the same three checks on every push.

## How this was built

I wrote this package with Claude Code, which is why most commits carry `Co-Authored-By: Claude`. I designed the contract and the security properties, reviewed the code, and a change counted as done once tests and review passed.

## License

[MIT](LICENSE)
