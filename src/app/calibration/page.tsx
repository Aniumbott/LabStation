// This page has been removed as the Smart Calibration Tool is no longer part of the application.
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { Wrench } from 'lucide-react'; // Icon kept for placeholder page consistency

export default function CalibrationPageRemoved() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Calibration Tool"
        description="This feature has been removed from the application."
        icon={Wrench}
      />
      <div className="text-center py-10">
        <p className="text-muted-foreground text-lg">The Smart Calibration Tool has been removed.</p>
        <p className="text-muted-foreground mt-2">Please use other features available in the sidebar.</p>
      </div>
    </div>
  );
}
