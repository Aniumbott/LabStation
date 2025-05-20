
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Building,
  Loader2,
  UserCheck2,
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

const PUBLIC_ROUTES = ['/login', '/signup'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/resources', label: 'Resources', icon: ClipboardList, allowedRoles: ['Admin', 'Lab Manager', 'Technician', 'Researcher']},
  { href: '/bookings', label: 'Bookings', icon: CalendarDays, allowedRoles: ['Admin', 'Lab Manager', 'Technician', 'Researcher']},
  { href: '/notifications', label: 'Notifications', icon: Bell, allowedRoles: ['Admin', 'Lab Manager', 'Technician', 'Researcher']},
  { href: '/profile', label: 'My Profile', icon: UserCog, allowedRoles: ['Admin', 'Lab Manager', 'Technician', 'Researcher'] },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench, allowedRoles: ['Admin', 'Lab Manager', 'Technician', 'Researcher']},
  {
    href: '/admin/booking-requests',
    label: 'Booking Requests',
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
    if (!currentUser) {
      // For unauthenticated users, only show items without specific allowedRoles
      // or items explicitly for non-logged-in states if we had them.
      // For now, this likely means an empty list or specific public nav items if any were defined.
      return navItems.filter(item => !item.allowedRoles || item.allowedRoles.length === 0);
    }
    return navItems.filter(item => {
      if (!item.allowedRoles || item.allowedRoles.length === 0) {
        return true;
      }
      return item.allowedRoles.includes(currentUser.role);
    });
  }, [currentUser]);

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

  // If not authenticated but on a public route (e.g., /login page itself),
  // render only the children (the page content) without the main app layout.
  if (!currentUser && PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  // If not authenticated and not on a public route, the useEffect above should have redirected.
  // If for some reason redirection is pending or currentUser is null when not expected,
  // showing a loader or minimal message might be better than rendering a broken layout.
  if (!currentUser && !PUBLIC_ROUTES.includes(pathname)) {
     return (
      <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg">Redirecting to login...</p>
      </div>
    );
  }

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
                    isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/')}
                    tooltip={item.label}
                    className={cn(
                      (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/')) && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
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

      <SidebarInset className="flex flex-col relative">
        <MobileSidebarToggle />
        <div className="p-4 md:p-6 lg:p-8 flex-grow">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
