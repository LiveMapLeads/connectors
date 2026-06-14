// The typed HTTP client for the Live Map Leads API.
//
// The client is generated from the OpenAPI spec (`openapi.yaml`, vendored from the live
// `GET /api/v1/openapi.yaml`): `src/generated/v1.ts` holds the spec-derived TYPES
// (build-time only, erased at runtime) and `openapi-fetch` is the single ~6 KB runtime
// dependency. A wrong path, field, or query param fails to COMPILE — the spec is the
// contract, nothing here re-describes request or response shapes by hand. To refresh after
// the API changes: `npm run gen:types` (see README § Updating the client).
import createClient, { type Client } from 'openapi-fetch';

import type { paths } from '../../generated/v1';

import { PROD_BASE_URL } from './constants';

export type V1Client = Client<paths>;

/**
 * Resolve the API key string from an Activepieces auth value. A `SecretText` connection is
 * typed as `{ type, secret_text }` by the SDK but has historically been delivered to piece
 * code as the bare string — this accepts BOTH shapes so the key resolves correctly across
 * Activepieces versions. Throws if neither form yields a non-empty key.
 */
export function resolveApiKey(auth: unknown): string {
  if (typeof auth === 'string' && auth.length > 0) {
    return auth;
  }
  if (
    auth &&
    typeof auth === 'object' &&
    'secret_text' in auth &&
    typeof (auth as { secret_text: unknown }).secret_text === 'string' &&
    (auth as { secret_text: string }).secret_text.length > 0
  ) {
    return (auth as { secret_text: string }).secret_text;
  }
  throw new Error('Missing Live Map Leads API key. Reconnect your account in the connection settings.');
}

/**
 * Build an authenticated client. `apiKey` is the account API key from Live Map Leads
 * account settings; it is sent on the `x-api-key` header of every request. `baseUrl` is
 * overridable only so tests can point at a mock server — published actions/triggers always
 * use the production base.
 */
export function makeClient(apiKey: string, baseUrl: string = PROD_BASE_URL): V1Client {
  return createClient<paths>({
    baseUrl,
    headers: { 'x-api-key': apiKey },
  });
}
