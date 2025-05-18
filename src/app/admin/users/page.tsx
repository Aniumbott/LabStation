
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIcon, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, Search as SearchIcon, Filter as FilterIcon, FilterX } from 'lucide-react';
import type { User, RoleName } from '@/types';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { UserFormDialog, UserFormValues } from '@/components/admin/user-form-dialog';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const initialMockUsers: User[] = [
  { id: 'u1', name: 'Dr. Admin First', email: 'admin.first@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u2', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u3', name: 'Tech Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u4', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u5', name: 'Admin Alpha', email: 'admin.alpha@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
];

const roleIcons: Record<User['role'], React.ElementType> = {
  'Admin': ShieldAlert,
  'Lab Manager': UserCogIcon,
  'Technician': UserCheck,
  'Researcher': UserCheck,
};

const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];

const getRoleBadgeVariant = (role: RoleName): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'Admin': return 'destructive';
      case 'Lab Manager': return 'default';
      case 'Technician': return 'secondary';
      case 'Researcher': return 'outline';
      default: return 'outline';
    }
};

export default function UserManagementPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(initialMockUsers);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Active filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<RoleName | 'all'>('all');

  // Temporary filters for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterRole, setTempFilterRole] = useState<RoleName | 'all'>('all');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(searchTerm);
      setTempFilterRole(filterRole);
    }
  }, [isFilterDialogOpen, searchTerm, filterRole]);

  const filteredUsers = useMemo(() => {
    let currentUsers = [...users];
    if (searchTerm) {
      currentUsers = currentUsers.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterRole !== 'all') {
      currentUsers = currentUsers.filter(user => user.role === filterRole);
    }
    return currentUsers;
  }, [users, searchTerm, filterRole]);

  const handleApplyFilters = () => {
    setSearchTerm(tempSearchTerm);
    setFilterRole(tempFilterRole);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setTempSearchTerm('');
    setTempFilterRole('all');
    // setIsFilterDialogOpen(false); // Optionally close dialog on reset
  };

  const handleOpenNewUserDialog = () => {
    setEditingUser(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditUserDialog = (user: User) => {
    setEditingUser(user);
    setIsFormDialogOpen(true);
  };

  const handleSaveUser = (data: UserFormValues) => {
    if (editingUser) {
      setUsers(users.map(u => u.id === editingUser.id ? { ...editingUser, ...data, avatarUrl: u.avatarUrl || 'https://placehold.co/100x100.png', avatarDataAiHint: u.avatarDataAiHint || 'avatar person' } : u));
      toast({
        title: 'User Updated',
        description: `User ${data.name} has been updated.`,
      });
    } else {
      const newUser: User = {
        id: `u${users.length + 1 + Date.now()}`,
        ...data,
        avatarUrl: 'https://placehold.co/100x100.png',
        avatarDataAiHint: 'avatar person',
      };
      setUsers([...users, newUser]);
      toast({
        title: 'User Created',
        description: `User ${data.name} with role ${data.role} has been created.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const deletedUser = users.find(u => u.id === userId);
    setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
    toast({
      title: "User Deleted",
      description: `User "${deletedUser?.name}" has been removed.`,
      variant: "destructive"
    });
    setUserToDelete(null);
  };

  const activeFilterCount = [searchTerm !== '', filterRole !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="View, add, and manage user accounts and their roles."
        icon={UsersIcon}
        actions={
          <div className="flex items-center gap-2">
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Users</DialogTitle>
                  <DialogDescription>
                    Refine the list of users.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-3" />
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="userSearchDialog" className="text-right col-span-1">Search</Label>
                    <Input
                      id="userSearchDialog"
                      type="search"
                      placeholder="Name or email..."
                      value={tempSearchTerm}
                      onChange={(e) => setTempSearchTerm(e.target.value)}
                      className="col-span-3 h-9"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="userRoleDialog" className="text-right col-span-1">Role</Label>
                    <Select value={tempFilterRole} onValueChange={(value) => setTempFilterRole(value as RoleName | 'all')} >
                      <SelectTrigger id="userRoleDialog" className="col-span-3 h-9">
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        {userRolesList.map(role => (
                          <SelectItem key={role} value={role}>{role}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Separator className="mt-3 mb-1" />
                <DialogFooter className="pt-2">
                  <Button variant="ghost" onClick={resetFilters} className="text-sm mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters} className="text-sm">Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleOpenNewUserDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
          </div>
        }
      />

      {filteredUsers.length > 0 ? (
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
              {filteredUsers.map((user) => {
                const RoleIcon = roleIcons[user.role] || UsersIcon;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint={user.avatarDataAiHint || 'avatar person'} />
                        <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">
                         <RoleIcon className="mr-1 h-3.5 w-3.5" />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditUserDialog(user)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit User</span>
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
        <Card className="text-center py-10 text-muted-foreground bg-card rounded-lg border shadow-sm">
          <UsersIcon className="mx-auto h-12 w-12 mb-4" />
           <p className="text-lg font-medium">
            {searchTerm || filterRole !== 'all' ? "No Users Match Filters" : "No Users Found"}
          </p>
          <p className="text-sm mb-4">
            {searchTerm || filterRole !== 'all' 
                ? "Try adjusting your search or filter criteria." 
                : "There are currently no users in the system. Add one to get started!"
            }
          </p>
          {searchTerm || filterRole !== 'all' ? (
             <Button variant="outline" onClick={resetFilters}>
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
            </Button>
          ) : (
            <Button onClick={handleOpenNewUserDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First User
            </Button>
          )}
        </Card>
      )}
      <UserFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialUser={editingUser}
        onSave={handleSaveUser}
      />
    </div>
  );
}

