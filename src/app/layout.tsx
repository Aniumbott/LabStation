import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProviderWrapper } from '@/components/layout/auth-provider-wrapper'; // Updated import

export const metadata: Metadata = {
  title: 'LabStation',
  description: 'Advanced Lab Resource Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProviderWrapper> {/* Use the new wrapper component */}
          <AppLayout>{children}</AppLayout>
        </AuthProviderWrapper>
        <Toaster />
      </body>
    </html>
  );
}
