
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  CalendarDays,
  Users,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons/logo';
import { MobileSidebarToggle } from './MobileSidebarToggle'; // New import

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/resources', label: 'Resource Search', icon: Search },
  { href: '/bookings', label: 'Booking Calendar', icon: CalendarDays },
  { href: '/admin/users', label: 'User Management', icon: Users },
  { href: '/profile', label: 'My Profile', icon: UserCog },
];

// Header component is removed

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    // SSR and initial client render: Keep it simple to avoid hydration issues.
    // No complex sidebar structure, just the provider and main content area.
    return (
      <SidebarProvider defaultOpen>
        <div className="flex flex-col min-h-svh bg-background">
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // Client-side render after mount: Full layout
  return (
    <SidebarProvider defaultOpen>
      <Sidebar> {/* Sidebar handles its own mobile (Sheet) / desktop rendering */}
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)}
                    tooltip={item.label}
                    className={cn(
                      pathname.startsWith(item.href) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                    )}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      {/* SidebarInset acts as the <main> tag and wraps page content */}
      <SidebarInset className="flex flex-col relative p-4 md:p-6 lg:p-8">
        <MobileSidebarToggle /> {/* Mobile trigger positioned within the main content area */}
        {children} {/* Page content */}
      </SidebarInset>
    </SidebarProvider>
  );
}
