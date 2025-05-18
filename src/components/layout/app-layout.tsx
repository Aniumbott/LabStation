
// This component was modified by the AI to add User Management and Profile links.
'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Search,
  CalendarDays,
  Users, // Added for User Management
  UserCog, // Added for Profile
  FlaskConical,
  PanelLeft,
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
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/icons/logo';

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

function Header() {
  const { isMobile: sidebarIsMobile } = useSidebar(); 
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 shadow-sm">
      {isClient && sidebarIsMobile && <SidebarTrigger className="md:hidden -ml-2" />}
      <div className="flex-1">
        {/* This space can be used for future right-aligned header elements like user profile, notifications */}
      </div>
      {/* User/Auth section can be added here */}
    </header>
  );
}


export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const mainContentLayout = (
    <>
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-background">
        {children}
      </main>
    </>
  );

  if (!isMounted) {
    return (
      <SidebarProvider defaultOpen>
        <div className="flex flex-col min-h-svh bg-background">
         {mainContentLayout}
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Logo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} passHref legacyBehavior>
                  <SidebarMenuButton
                    isActive={pathname.startsWith(item.href)} // Active state based on starting path
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
      <SidebarInset className="flex flex-col">
        {mainContentLayout}
      </SidebarInset>
    </SidebarProvider>
  );
}

