// Trigger: "New Search Completed" — fires once per search as it finishes.
//
// Polling-first (decoupled from any push/webhook delivery): Activepieces checks the
// read-only list endpoint (GET /api/v1/jobs?status=completed&since=…) on its schedule and
// emits one item per newly-completed search. Dedupe is TIME-BASED on `completedAt`: the
// helper stores the newest timestamp it has seen and only emits searches that finished
// strictly after it — which is exactly the `since` cursor the API exposes. Listing spends
// no credits.
//
// An instant (webhook) variant is a future, drop-in upgrade: only this file's strategy
// changes — the action and the API client stay as-is (see README § Polling vs. instant).
import { DedupeStrategy, type Polling, pollingHelper } from '@activepieces/pieces-common';
import { type AppConnectionValueForAuthProperty, TriggerStrategy, createTrigger } from '@activepieces/pieces-framework';

import { listCompletedSearches } from '../common/api';
import { liveMapLeadsAuth } from '../common/auth';
import { resolveApiKey } from '../common/client';
import { MAX_LIST_LIMIT } from '../common/constants';

// The connection value the polling helper passes to `items` — the SDK's `SecretText`
// wrapper. `resolveApiKey` extracts the key string from it (or a bare string at runtime).
type AuthValue = AppConnectionValueForAuthProperty<typeof liveMapLeadsAuth>;

/**
 * Fetch completed searches and map them to the helper's poll-item shape (exported for unit
 * tests). `lastFetchEpochMS` is supplied by the helper: `0` on the manual "test trigger"
 * run (return the most recent searches), or the timestamp of the newest search seen so far
 * on a live poll. We translate it into the API's `since` filter so the server only returns
 * newer searches; each item carries its `completedAt` as `epochMilliSeconds` for dedupe.
 */
export async function pollCompletedSearches(
  auth: AuthValue,
  lastFetchEpochMS: number,
): Promise<{ epochMilliSeconds: number; data: unknown }[]> {
  const since = lastFetchEpochMS > 0 ? new Date(lastFetchEpochMS).toISOString() : undefined;
  const page = await listCompletedSearches(resolveApiKey(auth), { since, limit: MAX_LIST_LIMIT });
  // One page (the newest MAX_LIST_LIMIT, the API maximum) per poll. The API exposes no
  // forward pagination — only `since` + `limit` (≤100) + `hasMore` — so if MORE than 100
  // searches completed since the last poll, the page is truncated to the newest 100 and the
  // older overflow is not emitted (the time cursor advances past them). This is the upstream
  // API's documented, accepted polling residual ("rare for a single account") and is bounded
  // to near-impossible here: an account runs one search at a time (each takes seconds to
  // minutes), so >100 completing inside one poll interval cannot realistically occur. The
  // instant (webhook) trigger upgrade removes the ceiling entirely. See README § Known limits.
  return page.data.map((search) => ({
    epochMilliSeconds: Date.parse(search.completedAt),
    data: search,
  }));
}

/** The polling definition wired into the trigger hooks (exported for integration tests). */
export const polling: Polling<AuthValue, Record<string, never>> = {
  strategy: DedupeStrategy.TIMEBASED,
  items: ({ auth, lastFetchEpochMS }) => pollCompletedSearches(auth, lastFetchEpochMS),
};

export const newSearchCompleted = createTrigger({
  auth: liveMapLeadsAuth,
  name: 'new_search_completed',
  displayName: 'New Search Completed',
  description:
    'Fires when one of your searches finishes, with its record count, the credits charged, and ready-to-use download links (CSV, XLSX, JSON).',
  type: TriggerStrategy.POLLING,
  props: {},
  sampleData: {
    jobId: '8f1d6c2a-3b4e-4f7a-9c1d-2e3f4a5b6c7d',
    status: 'completed',
    recordCount: 142,
    creditsCharged: 142,
    completedAt: '2026-06-12T14:22:05Z',
    downloads: {
      csv: 'https://livemapleads.com/api/exports/download?token=eyJhbGciOi...',
      xlsx: 'https://livemapleads.com/api/exports/download?token=eyJhbGciOi...',
      json: 'https://livemapleads.com/api/exports/download?token=eyJhbGciOi...',
    },
    summary: 'Your search finished with 142 records.',
  },
  async onEnable(context) {
    await pollingHelper.onEnable(polling, {
      store: context.store,
      auth: context.auth,
      propsValue: context.propsValue,
    });
  },
  async onDisable(context) {
    await pollingHelper.onDisable(polling, {
      store: context.store,
      auth: context.auth,
      propsValue: context.propsValue,
    });
  },
  async run(context) {
    return await pollingHelper.poll(polling, {
      store: context.store,
      auth: context.auth,
      propsValue: context.propsValue,
      files: context.files,
    });
  },
  async test(context) {
    return await pollingHelper.test(polling, {
      store: context.store,
      auth: context.auth,
      propsValue: context.propsValue,
      files: context.files,
    });
  },
});
