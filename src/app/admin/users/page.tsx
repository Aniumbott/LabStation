
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIcon, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, AlertTriangle } from 'lucide-react';
import type { User } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

const initialMockUsers: User[] = [
  { id: 'u1', name: 'Dr. Admin First', email: 'admin.first@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u2', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u3', name: 'Tech Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u4', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u5', name: 'Admin Alpha', email: 'admin.alpha@labstation.com', role: 'Admin', avatarDataAiHint: 'avatar person' },
];

const roleIcons: Record<User['role'], React.ElementType> = {
  'Admin': ShieldAlert,
  'Lab Manager': UserCogIcon,
  'Technician': UserCheck,
  'Researcher': UserCheck,
};

const roleBadgeVariant: Record<User['role'], "default" | "secondary" | "destructive" | "outline"> = {
    'Admin': 'destructive', // Using destructive for Admin as it's a high-privilege role, aligns with red primary
    'Lab Manager': 'default', // Using default for Lab Manager, aligns with red primary
    'Technician': 'secondary',
    'Researcher': 'outline', // Using outline for less emphasis or a neutral look
};


export default function UserManagementPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(initialMockUsers); // Manage users in state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleDeleteUser = (userId: string) => {
    const deletedUser = users.find(u => u.id === userId);
    setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
    
    toast({
      title: "User Deleted",
      description: `User "${deletedUser?.name}" has been removed from the list.`,
      variant: "destructive"
    });
    setUserToDelete(null); // Close dialog
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="View, add, and manage user accounts and their roles."
        icon={UsersIcon}
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Link>
          </Button>
        }
      />

      {users.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const RoleIcon = roleIcons[user.role] || UsersIcon;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint={user.avatarDataAiHint} />
                        <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role]} className="capitalize">
                         <RoleIcon className="mr-1 h-3.5 w-3.5" />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" asChild className="h-8 w-8">
                            <Link href={`/admin/users/edit/${user.id}`}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit User</span>
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit User</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToDelete(user)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete User</span>
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                             <p>Delete User</p>
                          </TooltipContent>
                        </Tooltip>
                        {userToDelete && userToDelete.id === user.id && (
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will remove the user 
                                <span className="font-semibold"> {userToDelete.name}</span> from the list.
                                (Note: In this demo, this only affects the current view.)
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => handleDeleteUser(userToDelete.id)}>
                                Delete User
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        )}
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      ) : (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg border shadow-sm">
          <UsersIcon className="mx-auto h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No Users Found</p>
          <p className="text-sm mb-4">There are currently no users in the system. Add one to get started!</p>
          <Button asChild>
            <Link href="/admin/users/new">
             <PlusCircle className="mr-2 h-4 w-4" /> Add First User
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
