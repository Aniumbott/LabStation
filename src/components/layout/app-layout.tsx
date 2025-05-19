
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Added useRouter
import {
  LayoutDashboard,
  ClipboardList,
  CalendarDays,
  UserCog,
  Users as UsersIconLucide,
  ListChecks,
  CheckSquare,
  Wrench,
  Bell,
  CalendarOff,
  Loader2,
  // Building, // Removed as Lab Management was skipped
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

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
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons/logo';
import { MobileSidebarToggle } from './MobileSidebarToggle';
import type { RoleName } from '@/types';
import { useAuth } from '@/components/auth-context';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allowedRoles?: RoleName[];
}

// Define public routes - these routes are accessible without authentication
const PUBLIC_ROUTES = ['/login', '/signup']; // Add '/signup' if/when it's created

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/resources', label: 'Resources', icon: ClipboardList },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'My Profile', icon: UserCog },
  {
    href: '/admin/booking-approvals',
    label: 'Booking Approvals',
    icon: CheckSquare,
    allowedRoles: ['Admin', 'Lab Manager'],
  },
  {
    href: '/admin/blackout-dates',
    label: 'Blackout Dates',
    icon: CalendarOff,
    allowedRoles: ['Admin', 'Lab Manager'],
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: UsersIconLucide,
    allowedRoles: ['Admin'],
  },
  {
    href: '/admin/resource-types',
    label: 'Resource Types',
    icon: ListChecks,
    allowedRoles: ['Admin'],
  },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { currentUser, isLoading: authIsLoading } = useAuth();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleNavItems = useMemo(() => {
    if (!isMounted || authIsLoading) return [];

    if (!currentUser) {
      // For unauthenticated users, no sidebar items are typically shown in the main app layout.
      // If we had public navigation items meant for the sidebar, they'd be filtered here.
      return [];
    }

    return ALL_NAV_ITEMS.filter(item => {
      if (!item.allowedRoles || item.allowedRoles.length === 0) {
        return true; // Accessible to all authenticated users
      }
      return item.allowedRoles.includes(currentUser.role);
    });
  }, [currentUser, isMounted, authIsLoading]);

  // Client-side redirection logic
  useEffect(() => {
    if (isMounted && !authIsLoading && !currentUser && !PUBLIC_ROUTES.includes(pathname)) {
      router.push('/login');
    }
  }, [isMounted, authIsLoading, currentUser, pathname, router]);


  if (!isMounted || authIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg">Loading LabStation...</p>
      </div>
    );
  }

  // If not authenticated and trying to access a protected route, show a loader while redirecting.
  if (!currentUser && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  // If not authenticated but on a public route (e.g., /login page itself),
  // render only the children (the page content) without the main app layout.
  if (!currentUser && PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }
  
  // If we reach here, the user is authenticated, and we render the full AppLayout.
  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <Separator className="my-1 bg-sidebar-border" />
        <SidebarContent>
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    isActive={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))}
                    tooltip={item.label}
                    className={cn(
                      (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
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

      <SidebarInset className="flex flex-col relative p-4 md:p-6 lg:p-8">
        <MobileSidebarToggle />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
