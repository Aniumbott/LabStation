
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-context';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading) {
      if (currentUser) {
        router.replace('/dashboard');
      } else {
        // If not loading and no current user, AppLayout will handle redirect to /login
        // However, we can also explicitly redirect to login if preferred,
        // or rely on AppLayout for consistency.
        // For now, let AppLayout handle unauthenticated root access.
        // If a direct redirect is desired: router.replace('/login');
      }
    }
  }, [router, currentUser, isLoading]);

  // Show a loading state while checking auth status and redirecting
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 selection:bg-accent selection:text-accent-foreground">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-lg text-muted-foreground sm:text-xl">
          Loading LabStation...
        </p>
      </div>
    </main>
  );
}
