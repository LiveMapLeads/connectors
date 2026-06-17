// Shared constants for the Live Map Leads piece.

/** The public Live Map Leads API base. Every action and trigger talks to this. */
export const PROD_BASE_URL = 'https://livemapleads.com/api/v1';

/**
 * Page size for listing completed searches. The API caps `limit` at 100; we ask for the
 * max so the "New Search Completed" trigger picks up everything finished since the last
 * check in a single call (one account rarely finishes more than 100 searches between
 * checks).
 */
export const MAX_LIST_LIMIT = 100;
