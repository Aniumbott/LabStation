
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';
import { AlertCircle, Loader2, Microwave } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(1, { message: 'Password is required.' }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, currentUser, isLoading: authIsLoading } = useAuth();
  const [pageErrorMessage, setPageErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!authIsLoading && currentUser) {
      router.push('/dashboard');
    }
  }, [currentUser, authIsLoading, router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedMessage = localStorage.getItem('login_message');
      if (storedMessage) {
        setPageErrorMessage(storedMessage);
      }
    }
  }, [authIsLoading]);

  const onSubmit = async (data: LoginFormValues) => {
    setPageErrorMessage(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('login_message');
    }
    setIsSubmitting(true);

    const result = await login(data.email, data.password);

    if (result.success) {
      // Hard navigation ensures the entire React tree remounts with fresh state
      // and the Next.js Router Cache is fully cleared — prevents stale cached
      // layouts/redirects from a previous session affecting the new user.
      window.location.href = '/dashboard';
      return;
    }

    const finalMessage = result.message || (typeof window !== 'undefined' ? localStorage.getItem('login_message') : null) || "Login failed. An unknown error occurred.";
    setPageErrorMessage(finalMessage);
    setIsSubmitting(false);
  };

  if (authIsLoading && !currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden md:flex w-1/2 bg-foreground flex-col items-center justify-center p-12 gap-6">
        <div className="flex items-center justify-center rounded-2xl bg-primary p-5">
          <Microwave className="h-14 w-14 text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-white text-4xl font-bold mb-3">LabStation</h2>
          <p className="text-primary-foreground/75 text-base max-w-xs leading-relaxed">
            Manage lab resources, bookings, and team access — all in one place.
          </p>
        </div>
        <div className="flex gap-8 mt-4">
          <div className="text-center">
            <p className="text-white text-2xl font-bold">∞</p>
            <p className="text-primary-foreground/60 text-xs mt-1">Resources</p>
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-bold">24/7</p>
            <p className="text-primary-foreground/60 text-xs mt-1">Access</p>
          </div>
          <div className="text-center">
            <p className="text-white text-2xl font-bold">100%</p>
            <p className="text-primary-foreground/60 text-xs mt-1">Controlled</p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full md:w-1/2 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 md:hidden">
            <Microwave className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">LabStation</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground text-sm mt-1">Sign in to your account to continue.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {pageErrorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{pageErrorMessage}</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign in'}
              </Button>
            </form>
          </Form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
