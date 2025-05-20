'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const DynamicAuthProvider = dynamic(
  () => import('@/components/auth-context').then(mod => mod.AuthProvider),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg">Initializing App...</p>
      </div>
    ),
  }
);

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <DynamicAuthProvider>{children}</DynamicAuthProvider>;
}
