import { afterEach, describe, expect, it } from 'vitest';

import {
  LiveMapLeadsApiError,
  listCompletedSearches,
  startSearch,
  type SearchList,
} from '../src/lib/common/api';
import { resolveApiKey } from '../src/lib/common/client';

import { RecordedRequest, TEST_KEY, restoreFetch, stubFetch } from './helpers';

afterEach(restoreFetch);

const SAMPLE_LIST: SearchList = {
  data: [
    {
      jobId: '8f1d6c2a-3b4e-4f7a-9c1d-2e3f4a5b6c7d',
      status: 'completed',
      recordCount: 12,
      creditsCharged: 12,
      completedAt: '2026-06-12T14:22:05.000Z',
      downloads: { csv: 'https://livemapleads.com/api/exports/download?token=abc' },
      summary: 'Your search finished with 12 records.',
    },
  ],
  hasMore: false,
};

describe('resolveApiKey', () => {
  it('accepts a bare string secret', () => {
    expect(resolveApiKey('abc')).toBe('abc');
  });

  it('accepts the SecretText connection wrapper', () => {
    expect(resolveApiKey({ type: 'SECRET_TEXT', secret_text: 'abc' })).toBe('abc');
  });

  it('trims surrounding whitespace from the key', () => {
    expect(resolveApiKey('  abc  ')).toBe('abc');
    expect(resolveApiKey({ secret_text: '  abc  ' })).toBe('abc');
  });

  it('throws on a missing/empty/whitespace-only key', () => {
    expect(() => resolveApiKey(undefined)).toThrow(/Missing/);
    expect(() => resolveApiKey('')).toThrow(/Missing/);
    expect(() => resolveApiKey('   ')).toThrow(/Missing/);
    expect(() => resolveApiKey({ secret_text: '' })).toThrow(/Missing/);
    expect(() => resolveApiKey({ secret_text: '   ' })).toThrow(/Missing/);
  });
});

describe('startSearch', () => {
  it('sends the x-api-key header + JSON body to POST /jobs and returns the accept response', async () => {
    const requests: RecordedRequest[] = stubFetch(() => ({
      status: 202,
      body: { jobId: 'job-1', status: 'queued' },
    }));

    const result = await startSearch(
      TEST_KEY,
      { searchStrings: ['dentist'], locationQuery: 'Austin, TX' },
      'https://mock.test/api/v1',
    );

    expect(result).toEqual({ jobId: 'job-1', status: 'queued' });
    expect(requests).toHaveLength(1);
    const [req] = requests;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('https://mock.test/api/v1/jobs');
    expect(req.headers.get('x-api-key')).toBe(TEST_KEY);
    expect(req.body).toEqual({ searchStrings: ['dentist'], locationQuery: 'Austin, TX' });
  });

  it('maps a 401 to a friendly unauthorized error', async () => {
    stubFetch(() => ({ status: 401, body: { error: 'unauthorized', message: 'Missing or invalid API key.' } }));

    await expect(
      startSearch(TEST_KEY, { searchStrings: ['x'], locationQuery: 'y' }, 'https://mock.test/api/v1'),
    ).rejects.toMatchObject({ name: 'LiveMapLeadsApiError', status: 401, code: 'unauthorized' });
  });

  it('maps a 429 to a rate-limit error carrying the Retry-After hint', async () => {
    stubFetch(() => ({
      status: 429,
      body: { error: 'rate_limited', message: 'Too many requests. Retry after the indicated delay.' },
      headers: { 'retry-after': '30' },
    }));

    const error = await startSearch(TEST_KEY, { searchStrings: ['x'], locationQuery: 'y' }, 'https://mock.test/api/v1').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(LiveMapLeadsApiError);
    expect((error as LiveMapLeadsApiError).status).toBe(429);
    expect((error as LiveMapLeadsApiError).message).toContain('30 seconds');
  });

  it('converts a transport failure (fetch rejection) to a friendly network error', async () => {
    globalThis.fetch = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    const error = await startSearch(TEST_KEY, { searchStrings: ['x'], locationQuery: 'y' }, 'https://mock.test/api/v1').catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(LiveMapLeadsApiError);
    expect((error as LiveMapLeadsApiError).status).toBe(0);
    expect((error as LiveMapLeadsApiError).code).toBe('network_error');
  });

  it('surfaces the API\'s own 400 validation message', async () => {
    stubFetch(() => ({
      status: 400,
      body: { error: 'invalid_request', message: 'Unknown category (not in the recognised list).' },
    }));

    await expect(
      startSearch(TEST_KEY, { searchStrings: ['x'], locationQuery: 'y' }, 'https://mock.test/api/v1'),
    ).rejects.toMatchObject({ status: 400, message: 'Unknown category (not in the recognised list).' });
  });
});

describe('listCompletedSearches', () => {
  it('requests status=completed with the default limit and no since on first poll', async () => {
    const requests = stubFetch(() => ({ status: 200, body: SAMPLE_LIST }));

    const page = await listCompletedSearches(TEST_KEY, {}, 'https://mock.test/api/v1');

    expect(page).toEqual(SAMPLE_LIST);
    const url = new URL(requests[0].url);
    expect(url.pathname).toBe('/api/v1/jobs');
    expect(url.searchParams.get('status')).toBe('completed');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('since')).toBeNull();
    expect(requests[0].headers.get('x-api-key')).toBe(TEST_KEY);
  });

  it('passes since + an explicit limit through to the query string', async () => {
    const requests = stubFetch(() => ({ status: 200, body: SAMPLE_LIST }));

    await listCompletedSearches(
      TEST_KEY,
      { since: '2026-06-12T00:00:00.000Z', limit: 25 },
      'https://mock.test/api/v1',
    );

    const url = new URL(requests[0].url);
    expect(url.searchParams.get('since')).toBe('2026-06-12T00:00:00.000Z');
    expect(url.searchParams.get('limit')).toBe('25');
  });
});
