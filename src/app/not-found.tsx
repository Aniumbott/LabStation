
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-background">
      <div className="max-w-md">
        <PageHeader
          title="404 - Page Not Found"
          icon={AlertTriangle}
          description="Oops! The page you're looking for doesn't seem to exist or you might not have access to it."
        />
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
        <p className="mt-12 text-sm text-muted-foreground">
          If you believe this is an error, please try again later or contact support.
        </p>
      </div>
    </div>
  );
}
