import { pollingHelper } from '@activepieces/pieces-common';
import type { FilesService, Store } from '@activepieces/pieces-framework';
import { AppConnectionType, type SecretTextConnectionValue } from '@activepieces/shared';
import { afterEach, describe, expect, it } from 'vitest';

import type { SearchSummary } from '../src/lib/common/api';
import { newSearchCompleted, polling, pollCompletedSearches } from '../src/lib/triggers/new-search-completed';

import { TEST_KEY, restoreFetch, stubFetch } from './helpers';

afterEach(restoreFetch);

const AUTH: SecretTextConnectionValue = { type: AppConnectionType.SECRET_TEXT, secret_text: TEST_KEY };

function fakeStore(initial: Record<string, unknown> = {}): Store {
  const map = new Map<string, unknown>(Object.entries(initial));
  return {
    get: async (key: string) => (map.has(key) ? map.get(key) : null),
    put: async (key: string, value: unknown) => {
      map.set(key, value);
      return value;
    },
    delete: async (key: string) => {
      map.delete(key);
    },
  } as unknown as Store;
}

const FILES = {} as unknown as FilesService;

/** Options object the polling helper takes; props is the trigger's empty prop set. */
function pollArgs(store: Store) {
  return { store, auth: AUTH, propsValue: {} as Record<string, never>, files: FILES };
}

function search(jobId: string, completedAt: string, recordCount = 10): SearchSummary {
  return {
    jobId,
    status: 'completed',
    recordCount,
    creditsCharged: recordCount,
    completedAt,
    downloads: { csv: `https://livemapleads.com/api/exports/download?token=${jobId}` },
    summary: `Your search finished with ${recordCount} records.`,
  };
}

describe('pollCompletedSearches', () => {
  it('maps each completed search to a timestamped poll item and sends no `since` on first run', async () => {
    const requests = stubFetch(() => ({
      status: 200,
      body: { data: [search('a', '2026-06-12T13:00:00.000Z')], hasMore: false },
    }));

    const items = await pollCompletedSearches(AUTH, 0);

    expect(items).toEqual([
      { epochMilliSeconds: Date.parse('2026-06-12T13:00:00.000Z'), data: search('a', '2026-06-12T13:00:00.000Z') },
    ]);
    expect(new URL(requests[0].url).searchParams.get('since')).toBeNull();
  });

  it('translates lastFetchEpochMS into the `since` query parameter', async () => {
    const requests = stubFetch(() => ({ status: 200, body: { data: [], hasMore: false } }));
    const cursor = Date.parse('2026-06-12T12:00:00.000Z');

    await pollCompletedSearches(AUTH, cursor);

    expect(new URL(requests[0].url).searchParams.get('since')).toBe('2026-06-12T12:00:00.000Z');
  });
});

describe('newSearchCompleted trigger (TIMEBASED polling integration)', () => {
  it('is a polling trigger wired to the polling definition', () => {
    expect(newSearchCompleted.name).toBe('new_search_completed');
    expect(newSearchCompleted.type).toBe('POLLING');
  });

  it('poll() emits only searches completed strictly after the stored cursor', async () => {
    const cursor = Date.parse('2026-06-12T12:00:00.000Z');
    const requests = stubFetch(() => ({
      status: 200,
      body: {
        // Newest first (as the API returns); one newer than the cursor, one older.
        data: [search('newer', '2026-06-12T13:00:00.000Z'), search('older', '2026-06-12T11:00:00.000Z')],
        hasMore: false,
      },
    }));
    const store = fakeStore({ lastPoll: cursor });

    const emitted = (await pollingHelper.poll(polling, pollArgs(store))) as SearchSummary[];

    expect(emitted.map((s) => s.jobId)).toEqual(['newer']);
    // The poll forwarded the cursor as `since`.
    expect(new URL(requests[0].url).searchParams.get('since')).toBe('2026-06-12T12:00:00.000Z');
    // The cursor advanced to the newest seen timestamp.
    expect(await store.get('lastPoll')).toBe(Date.parse('2026-06-12T13:00:00.000Z'));
  });

  it('onEnable() seeds the cursor so the first run only sees newer searches', async () => {
    const store = fakeStore();
    await pollingHelper.onEnable(polling, { store, auth: AUTH, propsValue: {} as Record<string, never> });
    expect(typeof (await store.get('lastPoll'))).toBe('number');
  });

  it('test() returns recent searches without a cursor (the "Test trigger" button)', async () => {
    stubFetch(() => ({
      status: 200,
      body: {
        data: [search('a', '2026-06-12T13:00:00.000Z'), search('b', '2026-06-12T12:30:00.000Z')],
        hasMore: false,
      },
    }));

    const sample = (await pollingHelper.test(polling, pollArgs(fakeStore()))) as SearchSummary[];

    expect(sample.map((s) => s.jobId)).toEqual(['a', 'b']);
  });
});
