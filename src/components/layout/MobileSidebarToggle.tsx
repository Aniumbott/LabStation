
'use client';

import { useState, useEffect } from 'react';
import { useSidebar, SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="absolute top-4 left-4 z-20 md:hidden">
              <SidebarTrigger />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <p>Open Navigation Menu</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
