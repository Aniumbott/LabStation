
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
  BarChart3,
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
  SidebarSeparator,
} from '@/components/ui/sidebar';
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
  { href: '/admin/resources', label: 'Resources', icon: ClipboardList},
  { href: '/bookings', label: 'Bookings', icon: CalendarDays},
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'My Profile', icon: UserCog },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench},
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
  {
    href: '/admin/reports',
    label: 'Reports',
    icon: BarChart3,
    allowedRoles: ['Admin', 'Lab Manager'],
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

  if (!currentUser && PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

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
        <SidebarSeparator />
        <SidebarContent>
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href}>
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
