// The connection users set up once: their Live Map Leads API key.
import { PieceAuth } from '@activepieces/pieces-framework';

import { LiveMapLeadsApiError, listCompletedSearches } from './api';
import { resolveApiKey } from './client';

const AUTH_DESCRIPTION = `Connect your Live Map Leads account with an API key.

1. Sign in at https://livemapleads.com and open **Account settings → API keys**.
2. Create a key and copy it — it is shown only once.
3. Paste it below.

The key acts on behalf of your account: it can start searches (which spend credits) and read your results. Keep it secret.`;

export const liveMapLeadsAuth = PieceAuth.SecretText({
  displayName: 'API Key',
  description: AUTH_DESCRIPTION,
  required: true,
  // Confirm the key works the moment it is entered, using the read-only "list searches"
  // endpoint (spends no credits). Only an explicit key rejection blocks the connection; a
  // transient outage is not treated as a bad key.
  validate: async ({ auth }) => {
    try {
      await listCompletedSearches(resolveApiKey(auth), { limit: 1 });
      return { valid: true };
    } catch (error) {
      if (error instanceof LiveMapLeadsApiError && (error.status === 401 || error.status === 403)) {
        return { valid: false, error: 'That API key was not accepted. Check it is correct and still active in your account settings.' };
      }
      // Network/server hiccup — don't reject a possibly-good key over a transient error.
      return { valid: true };
    }
  },
});
