
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, X } from 'lucide-react';
import type { RoleName } from '@/types';

const userRoles: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];

const newUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.enum(userRoles, { required_error: 'Please select a role.' }),
});

type NewUserFormValues = z.infer<typeof newUserFormSchema>;

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<NewUserFormValues>({
    resolver: zodResolver(newUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
      // role: undefined, // Let zod handle the required error
    },
  });

  function onSubmit(data: NewUserFormValues) {
    console.log('New user data:', data);
    // In a real app, you would send this data to your backend API
    toast({
      title: 'User Created (Mock)',
      description: `User ${data.name} with role ${data.role} has been "created".`,
    });
    // Potentially redirect or clear form
    // router.push('/admin/users'); // Uncomment to redirect after successful submission
    form.reset(); // Reset form after submission
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add New User"
        description="Create a new user account and assign a role."
        icon={UserPlus}
        actions={
            <Button variant="outline" asChild>
                <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" /> View All Users
                </Link>
            </Button>
        }
      />
      <Card className="max-w-2xl mx-auto shadow-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <CardTitle>User Details</CardTitle>
              <CardDescription>Please fill in the information for the new user.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Dr. Ada Lovelace" {...field} />
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
                      <Input type="email" placeholder="e.g., ada.lovelace@labstation.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role for the user" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Creating...' : <> <UserPlus className="mr-2 h-4 w-4" /> Create User</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
