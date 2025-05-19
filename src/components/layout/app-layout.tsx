
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarDays,
  Users as UsersIconLucide,
  UserCog,
  Loader2,
  ListChecks,
  ClipboardList,
  CheckSquare,
  Wrench,
  Bell,
  Building, // Kept for consistency, though Lab Management was removed
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react'; // Added useMemo

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
import { mockCurrentUser } from '@/lib/mock-data';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allowedRoles?: RoleName[]; // Roles allowed to see this item. If undefined, all roles can see.
}

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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const visibleNavItems = useMemo(() => {
    return ALL_NAV_ITEMS.filter(item => {
      if (!item.allowedRoles) {
        return true; // Accessible to all if no specific roles are defined
      }
      return item.allowedRoles.includes(mockCurrentUser.role);
    });
  }, [mockCurrentUser.role]); // Re-calculate if user role changes

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-3 text-lg">Loading LabStation...</p>
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

      <SidebarInset className="flex flex-col relative p-4 md:p-6 lg:p-8">
        <MobileSidebarToggle />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
