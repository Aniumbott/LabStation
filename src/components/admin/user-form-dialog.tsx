
'use client';

import { useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { UserPlus, Save, X, Loader2 } from 'lucide-react';
import type { User, RoleName } from '@/types';
import { userRolesList } from '@/lib/app-constants'; // Will now use the updated list

const userFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100, "Name cannot exceed 100 characters."),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.enum(userRolesList as [string, ...string[]], { required_error: 'Please select a role.' }),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUser: User | null;
  onSave: (data: UserFormValues) => Promise<void>;
}

export function UserFormDialog({ open, onOpenChange, initialUser, onSave }: UserFormDialogProps) {
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      email: '',
      role: 'Researcher',
    },
  });

  const resetForm = useCallback(() => {
    if (initialUser) {
      form.reset({
        name: initialUser.name,
        email: initialUser.email,
        role: userRolesList.includes(initialUser.role) ? initialUser.role : 'Researcher', // Fallback if old role was 'Lab Manager'
      });
    } else {
      form.reset({
        name: '',
        email: '',
        role: 'Researcher',
      });
    }
  }, [initialUser, form.reset]);


  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open, initialUser, form.reset, resetForm]);

  async function onSubmit(data: UserFormValues) {
    await onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs sm:max-w-sm md:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialUser ? 'Edit User Profile' : 'Add New User Profile (Admin)'}</DialogTitle>
          <DialogDescription>
            {initialUser ? `Modify the Firestore profile for ${initialUser.name}. Email cannot be changed here.` : 'Fill in the information for the new user profile. This does not create a Firebase Auth account.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Dr. Ada Lovelace" {...field} disabled={form.formState.isSubmitting} />
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
                    <Input
                        type="email"
                        placeholder="e.g., ada.lovelace@labstation.com"
                        {...field}
                        disabled={!!initialUser || form.formState.isSubmitting}
                    />
                  </FormControl>
                  {!!initialUser && <FormMessage className="text-xs text-muted-foreground !mt-0.5">Email cannot be changed for existing user profiles.</FormMessage>}
                  {!initialUser && <FormMessage />}
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={form.formState.isSubmitting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {userRolesList.map((role) => ( // userRolesList is now updated
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
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={form.formState.isSubmitting}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialUser ? <Save className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />)
                }
                {form.formState.isSubmitting
                  ? (initialUser ? 'Saving...' : 'Creating Profile...')
                  : (initialUser ? 'Save Changes' : 'Create Profile')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
