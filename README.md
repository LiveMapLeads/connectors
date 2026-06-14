# Live Map Leads — connectors

Open-source connectors that let no-code automation platforms talk to
[Live Map Leads](https://livemapleads.com): start local-business searches and act on
the results when they're ready.

Each connector is a thin client of the public [Live Map Leads API](https://livemapleads.com/api/v1/openapi.yaml)
(`/api/v1`). The OpenAPI spec is the contract — every connector generates its typed client
from it, so nothing here re-describes request or response shapes by hand.

| Connector | Status | Location |
|-----------|--------|----------|
| **Activepieces** | Available (polling) | [`pieces/live-map-leads`](pieces/live-map-leads) |
| Zapier | Planned | — |
| n8n | Planned | — |

This repository is **public and MIT-licensed on purpose**: a verified n8n community node
requires a public repo + MIT + npm provenance, so the connectors live here rather than in the
proprietary app.

## License

[MIT](LICENSE).
