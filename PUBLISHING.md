# Publishing

Each connector is its own npm package, published from this repo by a GitHub Actions
workflow using **npm Trusted Publishing (OIDC)** — no long-lived npm token lives on any
machine, and every release gets an npm **provenance** attestation automatically. (The n8n
package will *require* this provenance path for verification; the Activepieces package uses
it for the same security benefit.)

| Package | Directory | Workflow | npm |
|---------|-----------|----------|-----|
| `@livemapleads/piece-live-map-leads` | [`activepieces/`](activepieces) | [`publish-activepieces.yml`](.github/workflows/publish-activepieces.yml) | [npm](https://www.npmjs.com/package/@livemapleads/piece-live-map-leads) |

## One-time setup per package (npmjs.com)

The package must already exist on npm (do the first version manually — see below), then
attach the trusted publisher:

1. npmjs.com → the package → **Settings** → **Trusted Publisher** → **Add**.
2. Provider: **GitHub Actions**. Fields (case-sensitive, must match exactly):
   - Organization or user: `LiveMapLeads`
   - Repository: `connectors`
   - Workflow filename: `publish-activepieces.yml`
   - Environment: *(leave blank)*
3. Save. From now on the workflow can publish with no token.

> **First-ever publish (bootstrap).** npm requires the package to exist before you can add a
> trusted publisher. The first `0.1.0` was published manually (`npm login` with interactive
> 2FA, then `cd activepieces && npm publish --access public`). Every release after the
> trusted publisher is configured goes through the workflow.

## Releasing a new version

1. Bump `version` in the package's `package.json` (npm never lets you overwrite a published
   version — a re-publish of an existing version fails with `E403`).
2. Open a PR; merge to `main` once CI is green.
3. Publish, either:
   - **Actions** tab → *Publish — Activepieces piece* → **Run workflow** (on `main`), or
   - push a tag: `git tag activepieces-v<version> && git push origin activepieces-v<version>`.
4. The workflow runs the full gate (`npm run check`) then `npm publish --provenance --access public`.

Before a release also confirm, in [`activepieces/src/index.ts`](activepieces/src/index.ts):
`minimumSupportedRelease` is ≤ your target Activepieces version, and `logoUrl` resolves.
