import { afterEach, describe, expect, it } from 'vitest';

import { buildStartSearchBody, startSearchAction } from '../src/lib/actions/start-search';

import { RecordedRequest, TEST_KEY, restoreFetch, stubFetch } from './helpers';

afterEach(restoreFetch);

describe('buildStartSearchBody', () => {
  it('builds the minimal body from search terms + location', () => {
    expect(buildStartSearchBody({ searchTerms: ['dentist'], location: 'Austin, TX' })).toEqual({
      searchStrings: ['dentist'],
      locationQuery: 'Austin, TX',
    });
  });

  it('trims and drops blank search terms', () => {
    expect(
      buildStartSearchBody({ searchTerms: ['  dentist  ', '', '   ', 'lawyer'], location: 'Austin' }),
    ).toEqual({ searchStrings: ['dentist', 'lawyer'], locationQuery: 'Austin' });
  });

  it('throws when no usable search term remains', () => {
    expect(() => buildStartSearchBody({ searchTerms: ['', '   '], location: 'Austin' })).toThrow(
      /at least one search term/,
    );
    expect(() => buildStartSearchBody({ searchTerms: undefined, location: 'Austin' })).toThrow();
  });

  it('trims the location and throws on a whitespace-only location', () => {
    expect(buildStartSearchBody({ searchTerms: ['cafe'], location: '  Lyon  ' })).toEqual({
      searchStrings: ['cafe'],
      locationQuery: 'Lyon',
    });
    expect(() => buildStartSearchBody({ searchTerms: ['cafe'], location: '   ' })).toThrow(/location/);
  });

  it('includes optional fields only when set', () => {
    const body = buildStartSearchBody({
      searchTerms: ['cafe'],
      location: 'Lyon',
      maxResults: 50,
      nameMatch: 'contains',
      website: 'with',
      categories: ['cafe', '  ', 'coffee shop'],
      skipClosed: true,
      capCredits: 500,
      language: ' fr ',
    });
    expect(body).toEqual({
      searchStrings: ['cafe'],
      locationQuery: 'Lyon',
      maxResults: 50,
      nameMatch: 'contains',
      website: 'with',
      categories: ['cafe', 'coffee shop'],
      skipClosed: true,
      capCredits: 500,
      language: 'fr',
    });
  });

  it('omits empty categories and skips falsy/zero-but-meaningless optionals', () => {
    const body = buildStartSearchBody({
      searchTerms: ['gym'],
      location: 'Berlin',
      categories: [],
      skipClosed: false,
    });
    // categories omitted entirely; skipClosed:false is meaningful → kept.
    expect(body).toEqual({ searchStrings: ['gym'], locationQuery: 'Berlin', skipClosed: false });
    expect('categories' in body).toBe(false);
  });
});

describe('startSearchAction.run (wiring)', () => {
  it('resolves the key, builds the body, and POSTs to the API against a mocked fetch', async () => {
    const requests: RecordedRequest[] = stubFetch(() => ({ status: 202, body: { jobId: 'job-9', status: 'queued' } }));

    // The action reads only auth + propsValue; the rest of the run context is unused here.
    const ctx = {
      auth: TEST_KEY,
      propsValue: { searchTerms: ['dentist'], location: '  Austin, TX  ', skipClosed: true },
    } as unknown as Parameters<typeof startSearchAction.run>[0];

    const result = await startSearchAction.run(ctx);

    expect(result).toEqual({ jobId: 'job-9', status: 'queued' });
    expect(requests).toHaveLength(1);
    expect(requests[0].headers.get('x-api-key')).toBe(TEST_KEY);
    expect(requests[0].url).toBe('https://livemapleads.com/api/v1/jobs');
    // Location trimmed; optional skipClosed forwarded.
    expect(requests[0].body).toEqual({ searchStrings: ['dentist'], locationQuery: 'Austin, TX', skipClosed: true });
  });
});
