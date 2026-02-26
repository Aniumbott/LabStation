
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
  History,
  Cog,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useMemo, useCallback } from 'react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons/logo';
import type { RoleName } from '@/types';
import { useAuth } from '@/components/auth-context';
import { useTheme } from 'next-themes';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  technicianOrAdmin?: boolean;
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
  {
    href: '/admin/audit-log',
    label: 'Audit Log',
    icon: History,
    adminOnly: true,
  },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const { currentUser, isLoading: authIsLoading, logout } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const handleLogout = useCallback(async () => {
    await logout();
    router.refresh();
  }, [logout, router]);

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

  const initials = currentUser ? getInitials(currentUser.name) : '?';

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

        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage src={currentUser?.avatarUrl ?? undefined} alt={currentUser?.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="overflow-hidden flex-1 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium truncate leading-tight">{currentUser?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{currentUser?.role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 group-data-[collapsible=icon]:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 group-data-[collapsible=icon]:hidden text-muted-foreground hover:text-foreground"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="flex flex-col">
        {/* Mobile-only trigger strip — sidebar handles its own toggle on desktop */}
        <div className="md:hidden flex h-12 items-center border-b border-border px-4 flex-shrink-0 bg-background">
          <SidebarTrigger />
        </div>

        <div className="p-4 md:p-6 lg:p-8 flex-grow bg-background">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
