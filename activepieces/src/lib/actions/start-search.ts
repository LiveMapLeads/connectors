// Action: "Start a Search" — POST /api/v1/jobs.
//
// Exposes the restricted public search fields (openapi.yaml StartSearchRequest). The
// location is a plain text query (the natural input for a no-code user); the drawn-area
// (GeoJSON) form the API also accepts is intentionally not surfaced here. Billable add-ons
// and personal-data options are not part of the v1 surface at all, so they can't be
// reached from this action.
import { Property, createAction } from '@activepieces/pieces-framework';

import { type StartSearchBody, startSearch } from '../common/api';
import { liveMapLeadsAuth } from '../common/auth';
import { resolveApiKey } from '../common/client';

/** Coerce an Activepieces array prop (its items are `unknown`) to clean, non-empty strings. */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
    .filter((item) => item.length > 0);
}

/** Shape of this action's prop values (kept permissive so the framework's inferred type assigns). */
export interface StartSearchProps {
  searchTerms: unknown;
  location: string;
  maxResults?: number;
  nameMatch?: 'all' | 'contains' | 'exact';
  website?: 'any' | 'with' | 'without';
  categories?: unknown;
  skipClosed?: boolean;
  capCredits?: number;
  language?: string;
}

/**
 * Map the action's prop values to the API request body. Pure + exported so it is unit-
 * tested without the Activepieces runtime. Optional fields are omitted entirely when unset
 * so the API applies its own defaults. Throws when no search term survives trimming (the
 * field is required, but an array of blanks would otherwise send an empty search).
 */
export function buildStartSearchBody(props: StartSearchProps): StartSearchBody {
  const searchStrings = toStringList(props.searchTerms);
  if (searchStrings.length === 0) {
    throw new Error('Enter at least one search term, e.g. "dentist".');
  }

  const location = (props.location ?? '').trim();
  if (location.length === 0) {
    throw new Error('Enter a location, e.g. "Austin, TX".');
  }

  const body: StartSearchBody = {
    searchStrings,
    locationQuery: location,
  };

  if (props.maxResults != null) body.maxResults = props.maxResults;
  if (props.nameMatch) body.nameMatch = props.nameMatch;
  if (props.website) body.website = props.website;
  if (props.skipClosed != null) body.skipClosed = props.skipClosed;
  if (props.capCredits != null) body.capCredits = props.capCredits;
  if (props.language && props.language.trim().length > 0) body.language = props.language.trim();

  const categories = toStringList(props.categories);
  if (categories.length > 0) body.categories = categories;

  return body;
}

export const startSearchAction = createAction({
  auth: liveMapLeadsAuth,
  name: 'start_search',
  displayName: 'Start a Search',
  description:
    'Start a new local-business search. Returns right away with a search ID while the search runs in the background — use the "New Search Completed" trigger to pick up the results when they are ready.',
  props: {
    searchTerms: Property.Array({
      displayName: 'Search Terms',
      description: 'What to look for, e.g. "dentist" or "italian restaurant". Add one term per line; each runs against your location.',
      required: true,
    }),
    location: Property.ShortText({
      displayName: 'Location',
      description: 'Where to search, e.g. "Austin, TX" or "Lyon, France".',
      required: true,
    }),
    maxResults: Property.Number({
      displayName: 'Max Results per Term',
      description: 'Optional cap on how many businesses to return for each search term. Leave empty for no cap.',
      required: false,
    }),
    nameMatch: Property.StaticDropdown<'all' | 'contains' | 'exact'>({
      displayName: 'Business Name Match',
      description: 'How strictly a business name must match your search term.',
      required: false,
      options: {
        options: [
          { label: 'Any name (no filter)', value: 'all' },
          { label: 'Name contains the term', value: 'contains' },
          { label: 'Name is exactly the term', value: 'exact' },
        ],
      },
    }),
    website: Property.StaticDropdown<'any' | 'with' | 'without'>({
      displayName: 'Website Filter',
      description: 'Keep only businesses with or without a website.',
      required: false,
      options: {
        options: [
          { label: 'Any (no filter)', value: 'any' },
          { label: 'Only with a website', value: 'with' },
          { label: 'Only without a website', value: 'without' },
        ],
      },
    }),
    categories: Property.Array({
      displayName: 'Categories',
      description: 'Optional. Restrict results to specific business categories (e.g. "dentist", "art gallery"). Each must be a recognised category — an unknown value is rejected. Leave empty to apply no category filter.',
      required: false,
    }),
    skipClosed: Property.Checkbox({
      displayName: 'Skip Closed Businesses',
      description: 'Exclude permanently or temporarily closed businesses.',
      required: false,
    }),
    capCredits: Property.Number({
      displayName: 'Credit Limit',
      description: 'Optional ceiling on how many credits this search may spend. Recommended for unattended automations.',
      required: false,
    }),
    language: Property.ShortText({
      displayName: 'Result Language',
      description: 'Optional language code for results (e.g. "en", "fr", "pt-br"). Defaults to English.',
      required: false,
    }),
  },
  async run(context) {
    const body = buildStartSearchBody(context.propsValue);
    return await startSearch(resolveApiKey(context.auth), body);
  },
});
