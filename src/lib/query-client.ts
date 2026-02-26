import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data fresh for 30 s by default. Individual hooks can override.
        staleTime: 30 * 1000,
        // Keep unused data in cache for 5 min before garbage collection.
        gcTime: 5 * 60 * 1000,
        // Retry once on failure before surfacing an error.
        retry: 1,
        // Refetch when the user returns to the tab so data stays current.
        refetchOnWindowFocus: true,
      },
    },
  });
}

// ─── Browser singleton ────────────────────────────────────────────────────────
// Avoid creating a new QueryClient on every render cycle in the browser.
let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // SSR: always create a fresh client per request.
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
