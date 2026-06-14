# Live Map Leads — Activepieces piece

Pull filtered local-business lists from map data inside your [Activepieces](https://www.activepieces.com)
flows. Start a search and act on the results the moment they're ready.

- **Action — Start a Search** — kick off a local-business search (`POST /api/v1/jobs`).
- **Trigger — New Search Completed** — fires when one of your searches finishes, with its
  record count, the credits charged, and ready-to-use download links (CSV, XLSX, JSON).
- **Connection — API Key** — paste an API key from your Live Map Leads account settings.

## How it talks to Live Map Leads

The piece is a thin, typed client of the public [Live Map Leads API](https://livemapleads.com/api/v1/openapi.yaml)
(`/api/v1`). It does **not** re-describe request or response shapes by hand:

- `openapi.yaml` is vendored from the live, unauthenticated `GET /api/v1/openapi.yaml`.
- `src/generated/v1.ts` holds the spec-derived **types** (build-time only — erased at runtime).
- [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) (~6 KB) is the single runtime
  dependency; a wrong path, field, or query param fails to **compile**.

## Trigger: polling now, instant later

"New Search Completed" is a **polling** trigger: Activepieces checks the read-only list
endpoint (`GET /api/v1/jobs?status=completed&since=…`) on its schedule and emits one item per
newly-finished search. Dedupe is time-based on each search's completion time — exactly the
`since` cursor the API exposes. Listing spends **no credits**.

Polling-first is deliberate: the connector ships on the API alone, with no dependency on push
delivery. An **instant** (webhook) variant is a drop-in upgrade when Live Map Leads adds
push: only [`src/lib/triggers/new-search-completed.ts`](src/lib/triggers/new-search-completed.ts)
changes its trigger strategy — the action, the API client, and the connection stay as they are.

### Known limit

Each poll fetches the newest 100 completed searches (the API maximum; the API has no forward
pagination). If **more than 100** of your searches were to complete inside a single polling
interval, the overflow beyond the newest 100 would not be emitted. This is the upstream API's
accepted polling residual and is effectively unreachable in practice — an account runs one
search at a time, so a poll interval can't accumulate 100+ completions. The instant (webhook)
trigger removes the ceiling entirely.

## Develop

```bash
npm install
npm run typecheck   # tsc (sources + tests)
npm run lint        # eslint
npm run test        # vitest — runs against a MOCKED API, never spends credits
npm run build       # emits dist/
npm run check       # all of the above
```

To run it inside Activepieces locally, copy/symlink this package into your Activepieces
`packages/pieces/community/live-map-leads` and use the standard piece hot-reload dev loop
(`npm start` in the Activepieces repo). See the Activepieces
[piece development docs](https://www.activepieces.com/docs/build-pieces/building-pieces/start-building).

### Updating the client when the API changes

The API contract is the OpenAPI spec. To pull in API changes:

```bash
# 1. Refresh the vendored spec from production (byte-identical to docs/api/openapi.yaml).
curl -fsS https://livemapleads.com/api/v1/openapi.yaml -o openapi.yaml

# 2. Regenerate the typed client (pinned generator → reproducible output).
npm run gen:types   # openapi-typescript 7.13.0 → src/generated/v1.ts

# 3. tsc will flag any action/trigger that no longer matches the new contract.
npm run check
```

`--default-non-nullable false` (already in the `gen:types` script) makes request-body fields
that carry a server-side default optional, so callers don't have to send them.

## Publishing

Two sanctioned routes (operator-gated — needs the npm scope / marketplace account):

1. **Community / public npm (soft launch).** `npm publish --access public` under the
   `@livemapleads` scope, then install it in Activepieces by package name. Fast; no SEO surface.
2. **Contribute (cloud marketplace).** Open a PR adding this package to the Activepieces
   monorepo under `packages/pieces/community/live-map-leads`. This earns the indexed
   `activepieces.com/pieces/live-map-leads` listing page — the SEO-bearing path — and is done
   once the piece is proven.

Before publishing, confirm `minimumSupportedRelease` (in [`src/index.ts`](src/index.ts)) against
your target Activepieces version, and that the `logoUrl` resolves.

## License

[MIT](../../LICENSE).
