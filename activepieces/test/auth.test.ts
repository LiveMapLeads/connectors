import { afterEach, describe, expect, it } from 'vitest';

import { liveMapLeadsAuth } from '../src/lib/common/auth';

import { TEST_KEY, restoreFetch, stubFetch } from './helpers';

afterEach(restoreFetch);

// The validate hook receives the resolved key string and the server context; the impl uses
// only the key, so the server is stubbed.
function runValidate(auth: string) {
  return liveMapLeadsAuth.validate!({ auth } as never);
}

describe('liveMapLeadsAuth.validate', () => {
  it('accepts a key the API answers for', async () => {
    stubFetch(() => ({ status: 200, body: { data: [], hasMore: false } }));
    expect(await runValidate(TEST_KEY)).toEqual({ valid: true });
  });

  it('rejects a key the API refuses (401)', async () => {
    stubFetch(() => ({ status: 401, body: { error: 'unauthorized', message: 'Missing or invalid API key.' } }));
    const result = await runValidate(TEST_KEY);
    expect(result.valid).toBe(false);
  });

  it('does not reject a possibly-good key on a transient server error', async () => {
    stubFetch(() => ({ status: 503, body: { error: 'unavailable', message: 'temporary' } }));
    expect(await runValidate(TEST_KEY)).toEqual({ valid: true });
  });
});
