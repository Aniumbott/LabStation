
'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { UserCog, Users, X, Save, AlertTriangle } from 'lucide-react';
import type { User, RoleName } from '@/types';

// Mock data - in a real app, this would come from a service or API
const mockUsers: User[] = [
  { id: 'u1', name: 'Dr. Admin First', email: 'admin.first@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u2', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u3', name: 'Tech Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u4', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png' },
  { id: 'u5', name: 'Admin Alpha', email: 'admin.alpha@labstation.com', role: 'Admin' },
];

const userRoles: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];

const editUserFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.enum(userRoles, { required_error: 'Please select a role.' }),
});

type EditUserFormValues = z.infer<typeof editUserFormSchema>;

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const userId = params.userId as string;

  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<EditUserFormValues>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      name: '',
      email: '',
    },
  });

  useEffect(() => {
    if (userId) {
      // Simulate fetching user data
      const foundUser = mockUsers.find(u => u.id === userId);
      if (foundUser) {
        setUser(foundUser);
        form.reset({
          name: foundUser.name,
          email: foundUser.email,
          role: foundUser.role,
        });
      } else {
        setUser(null); // User not found
      }
      setIsLoading(false);
    }
  }, [userId, form]);

  function onSubmit(data: EditUserFormValues) {
    console.log('Updated user data:', { id: userId, ...data });
    // In a real app, you would send this data to your backend API
    toast({
      title: 'User Updated (Mock)',
      description: `User ${data.name} has been "updated".`,
    });
    // router.push('/admin/users'); // Optionally redirect
  }

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <UserCog className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading user data...</p>
        </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-8">
        <PageHeader
            title="Edit User"
            description="Modify an existing user account."
            icon={UserCog}
             actions={
                <Button variant="outline" asChild>
                    <Link href="/admin/users">
                        <Users className="mr-2 h-4 w-4" /> View All Users
                    </Link>
                </Button>
            }
        />
        <Card className="max-w-2xl mx-auto shadow-lg border-destructive">
            <CardHeader className="items-center">
                <AlertTriangle className="h-12 w-12 text-destructive mb-2" />
                <CardTitle className="text-destructive">User Not Found</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
                <p className="text-muted-foreground">The user with ID "{userId}" could not be found.</p>
                <p className="text-muted-foreground mt-1">Please check the ID or select a user from the list.</p>
            </CardContent>
            <CardFooter className="justify-center">
                <Button asChild>
                    <Link href="/admin/users">
                        <Users className="mr-2 h-4 w-4" /> Go to User List
                    </Link>
                </Button>
            </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Edit User"
        description={`Editing details for ${user.name}.`}
        icon={UserCog}
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
              <CardTitle>Edit User Details</CardTitle>
              <CardDescription>Modify the information for {user.name}.</CardDescription>
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
                {form.formState.isSubmitting ? 'Saving...' : <> <Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
