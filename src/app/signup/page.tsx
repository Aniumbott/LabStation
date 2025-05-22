
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';
import { UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/icons/logo';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const signupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Invalid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signup, currentUser, isLoading: authLoading } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (!authLoading && currentUser) {
      router.push('/dashboard');
    }
  }, [currentUser, authLoading, router]);

  const onSubmit = async (data: SignupFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    form.control.disabled = true; // Visually disable form
    try {
      const result = await signup(data.name, data.email, data.password);
      if (result.success) {
        setSuccessMessage(result.message || 'Signup successful! Your request is awaiting admin approval.');
        toast({
          title: 'Signup Successful',
          description: result.message || 'Your account request has been submitted for approval.',
          duration: 5000,
        });
        // Optionally redirect after a delay or let user click a link
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setErrorMessage(result.message || 'Signup failed. Please try again.');
      }
    } catch (error) {
      console.error("Signup submission error:", error);
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      if(!successMessage) { // Only re-enable if no success (as success leads to redirect)
         form.control.disabled = false;
      }
    }
  };
  
  if (authLoading) {
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-4">
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl">Create an Account</CardTitle>
          <CardDescription>Join LabStation to manage lab resources.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {errorMessage && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Signup Error</AlertTitle>
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
              )}
              {successMessage && (
                <Alert variant="default" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertTitle className="text-green-700 dark:text-green-300">Success</AlertTitle>
                  <AlertDescription className="text-green-600 dark:text-green-400">{successMessage} Redirecting to login...</AlertDescription>
                </Alert>
              )}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g., Ada Lovelace" {...field} disabled={form.formState.isSubmitting || !!successMessage} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} disabled={form.formState.isSubmitting || !!successMessage}/>
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
                      <Input type="password" placeholder="•••••••• (min. 6 characters)" {...field} disabled={form.formState.isSubmitting || !!successMessage}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting || !!successMessage}>
                {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Account...</> : 'Create Account'}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col items-center text-sm space-y-2 pt-4">
           <p className="text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
