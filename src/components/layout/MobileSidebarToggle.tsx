
'use client';

import { useState, useEffect } from 'react';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';

export function MobileSidebarToggle() {
  const { isMobile } = useSidebar();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || !isMobile) {
    // Render nothing if not client or not on a mobile viewport
    return null;
  }

  // Render the trigger only if on mobile. 
  // SidebarTrigger's onClick internally calls toggleSidebar from useSidebar context.
  return (
    <div className="absolute top-4 left-4 z-20 md:hidden">
        <SidebarTrigger />
    </div>
  );
}
