import { describe, expect, it } from 'vitest';

import { buildStartSearchBody } from '../src/lib/actions/start-search';

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
