// Typed wrappers over the two Live Map Leads API operations the connector uses, plus a
// single error type. Actions and triggers call these — they never touch the HTTP client
// directly, which keeps request/response handling (and its tests) in one place.
import type { components } from '../../generated/v1';

import { makeClient } from './client';
import { MAX_LIST_LIMIT, PROD_BASE_URL } from './constants';

/** The restricted public search request body (openapi.yaml StartSearchRequest). */
export type StartSearchBody = components['schemas']['StartSearchRequest'];
/** 202 response from starting a search. */
export type StartSearchResult = components['schemas']['StartSearchResponse'];
/** One completed search in the polling list. */
export type SearchSummary = components['schemas']['SearchSummary'];
/** A page of completed searches. */
export type SearchList = components['schemas']['SearchList'];

/**
 * A failed Live Map Leads API call. `status` is the HTTP status (0 if the request never
 * reached the server); `code` is the stable machine code from the API (`unauthorized`,
 * `rate_limited`, `invalid_request`, …) or a synthetic one for transport failures.
 * `message` is already ICP-friendly — safe to surface to the user.
 */
export class LiveMapLeadsApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'LiveMapLeadsApiError';
    this.status = status;
    this.code = code;
  }
}

/** Narrow an unknown error body to the API's `{ error, message }` Error schema. */
function readErrorBody(body: unknown): { code?: string; message?: string } {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    return {
      code: typeof record.error === 'string' ? record.error : undefined,
      message: typeof record.message === 'string' ? record.message : undefined,
    };
  }
  return {};
}

/**
 * Turn an `openapi-fetch` failure into a `LiveMapLeadsApiError` with copy a non-technical
 * user can act on. Known statuses get tailored guidance; the API's own human `message` is
 * preferred for validation (400) errors, which are already specific and readable.
 */
function toApiError(errorBody: unknown, response: Response | undefined): LiveMapLeadsApiError {
  const status = response?.status ?? 0;
  const { code: bodyCode, message: bodyMessage } = readErrorBody(errorBody);

  if (status === 401 || status === 403) {
    return new LiveMapLeadsApiError(
      status,
      bodyCode ?? 'unauthorized',
      'Your API key was not accepted. Open your Live Map Leads account settings, check the key is correct and still active, then reconnect.',
    );
  }
  if (status === 429) {
    const retryAfter = response?.headers.get('retry-after');
    const wait = retryAfter ? ` Wait ${retryAfter} seconds and try again.` : ' Please slow down and try again shortly.';
    return new LiveMapLeadsApiError(status, bodyCode ?? 'rate_limited', `Too many requests.${wait}`);
  }
  if (status === 400 && bodyMessage) {
    // The API's 400 message is human-readable and specific (e.g. an unrecognised category).
    return new LiveMapLeadsApiError(status, bodyCode ?? 'invalid_request', bodyMessage);
  }
  if (status === 0) {
    return new LiveMapLeadsApiError(
      0,
      'network_error',
      "Couldn't reach Live Map Leads. Check your connection and try again.",
    );
  }
  return new LiveMapLeadsApiError(
    status,
    bodyCode ?? 'request_failed',
    bodyMessage ?? 'Something went wrong talking to Live Map Leads. Please try again in a moment.',
  );
}

/**
 * Start a search (POST /jobs). Returns the `{ jobId, status: "queued" }` accept response.
 * The search runs in the background; credits are charged only on success, and never for a
 * search that fails. Throws `LiveMapLeadsApiError` on any non-2xx / transport failure.
 */
export async function startSearch(
  apiKey: string,
  body: StartSearchBody,
  baseUrl: string = PROD_BASE_URL,
): Promise<StartSearchResult> {
  let result;
  try {
    result = await makeClient(apiKey, baseUrl).POST('/jobs', { body });
  } catch {
    // fetch rejected (DNS / connection / abort) — openapi-fetch surfaces HTTP errors via
    // `error`, but transport failures throw, so convert them to the friendly network error.
    throw toApiError(undefined, undefined);
  }
  if (result.data === undefined) {
    throw toApiError(result.error, result.response);
  }
  return result.data;
}

/**
 * List the account's completed searches, newest first (GET /jobs). `since` (RFC 3339)
 * returns only searches that finished strictly after it — pass the newest `completedAt`
 * you have already seen for incremental polling. Read-only: spends no credits. Throws
 * `LiveMapLeadsApiError` on any non-2xx / transport failure.
 */
export async function listCompletedSearches(
  apiKey: string,
  params: { since?: string; limit?: number },
  baseUrl: string = PROD_BASE_URL,
): Promise<SearchList> {
  let result;
  try {
    result = await makeClient(apiKey, baseUrl).GET('/jobs', {
      params: {
        query: {
          status: 'completed',
          limit: params.limit ?? MAX_LIST_LIMIT,
          ...(params.since ? { since: params.since } : {}),
        },
      },
    });
  } catch {
    throw toApiError(undefined, undefined);
  }
  if (result.data === undefined) {
    throw toApiError(result.error, result.response);
  }
  return result.data;
}
