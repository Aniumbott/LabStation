
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { BarChart3, Info, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DeprecatedReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        description="This global reports page is being phased out."
        icon={BarChart3}
      />

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Page Update
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The global reporting dashboard is currently under review and its features are being integrated elsewhere for better context.
          </p>
          <p className="text-muted-foreground">
            You can now find **lab-specific reports** within the "Lab Overview" tab when you select a particular lab in the
            {' '}
            <Link href="/admin/lab-operations" className="text-primary hover:underline font-medium">
              Lab Operations Center
            </Link>.
          </p>
          <p className="text-sm text-muted-foreground flex items-start gap-2 pt-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <span>
                If you relied on specific system-wide aggregate reports from this page, please provide feedback to the development team
                regarding your needs as we transition to more contextual reporting.
            </span>
          </p>
           <div className="pt-2">
             <Button asChild>
                <Link href="/admin/lab-operations">
                    Go to Lab Operations Center
                </Link>
            </Button>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
