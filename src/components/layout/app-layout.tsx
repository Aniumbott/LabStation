
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  UserCog,
  Users as UsersIconLucide,
  CheckSquare,
  Bell,
  Loader2,
  // BarChart3, // Removed as per deprecation of global reports page
  History,
  Cog,
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
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons/logo';
import { MobileSidebarToggle } from './MobileSidebarToggle';
import type { RoleName } from '@/types';
import { useAuth } from '@/components/auth-context';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  technicianOrAdmin?: boolean; // New property
}

const PUBLIC_ROUTES = ['/login', '/signup'];

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  {
    href: '/admin/booking-requests',
    label: 'Booking Requests',
    icon: CheckSquare,
    adminOnly: true,
  },
  { href: '/admin/resources', label: 'Resources', icon: Package },
  {
    href: '/admin/lab-operations',
    label: 'Lab Operations',
    icon: Cog,
    adminOnly: true,
  },
  {
    href: '/admin/users',
    label: 'Users',
    icon: UsersIconLucide,
    adminOnly: true,
  },
  { href: '/profile', label: 'My Profile', icon: UserCog },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  // { // Reports link removed
  //   href: '/admin/reports',
  //   label: 'Reports',
  //   icon: BarChart3,
  //   adminOnly: true,
  // },
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    icon: History,
    adminOnly: true,
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
      return [];
    }
    return navItems.filter(item => {
      if (item.adminOnly) return currentUser.role === 'Admin';
      if (item.technicianOrAdmin) return currentUser.role === 'Admin' || currentUser.role === 'Technician';
      // Ensure regular users can see the /admin/resources path as per previous logic
      if (item.href === '/admin/resources') return true; 
      return true;
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
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <Link href="/dashboard">
            <span className="inline-flex items-center justify-center gap-2 group-data-[collapsible=icon]:justify-center">
                <Logo />
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            {visibleNavItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} passHref>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/')}
                    tooltip={item.label}
                    className={cn(
                      (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href !== '/')) &&
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90'
                    )}
                  >
                    <span className="inline-flex w-full items-center gap-2 overflow-hidden">
                      <item.icon />
                      <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className="flex flex-col relative">
        <MobileSidebarToggle />
        <div className="p-4 md:p-6 lg:p-8 flex-grow bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
