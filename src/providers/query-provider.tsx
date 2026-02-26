'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';

/**
 * Wraps the app with TanStack QueryClientProvider using the browser singleton
 * QueryClient. Placed at the root layout so every page can use useQuery hooks.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  // getQueryClient() returns a stable singleton in the browser.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
