// Live Map Leads — Activepieces piece.
//
// Pull filtered local-business lists from map data: start a search, then act on the results
// when the search completes. A thin, typed client of the public Live Map Leads API
// (https://livemapleads.com/api/v1) — the OpenAPI spec is the contract.
import { PieceCategory } from '@activepieces/shared';
import { createPiece } from '@activepieces/pieces-framework';

import { startSearchAction } from './lib/actions/start-search';
import { liveMapLeadsAuth } from './lib/common/auth';
import { newSearchCompleted } from './lib/triggers/new-search-completed';

export { liveMapLeadsAuth };

export const liveMapLeads = createPiece({
  displayName: 'Live Map Leads',
  description:
    'Pull filtered local-business lists from map data. Start a search and get a notification when your results are ready to download.',
  auth: liveMapLeadsAuth,
  // The lowest Activepieces release this piece is known to run on. Confirm/raise against
  // your target Activepieces version before publishing (see README § Publishing).
  minimumSupportedRelease: '0.36.1',
  logoUrl: 'https://livemapleads.com/logo-icon.png',
  categories: [PieceCategory.MARKETING, PieceCategory.SALES_AND_CRM],
  authors: ['livemapleads'],
  actions: [startSearchAction],
  triggers: [newSearchCompleted],
});
