
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIconLucide, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { User, RoleName, UserStatus } from '@/types';
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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { initialMockUsers, mockApproveSignup, mockRejectSignup } from '@/lib/mock-data';
import { useAuth } from '@/components/auth-context';

const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
const userStatusesList: (UserStatus | 'all')[] = ['all', 'active', 'pending_approval', 'suspended'];


const roleIcons: Record<User['role'], React.ElementType> = {
  'Admin': ShieldAlert,
  'Lab Manager': UserCogIcon,
  'Technician': UserCheck,
  'Researcher': UserCheck,
};

const getRoleBadgeVariant = (role: RoleName): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'Admin': return 'destructive';
      case 'Lab Manager': return 'default';
      case 'Technician': return 'secondary';
      case 'Researcher': return 'outline';
      default: return 'outline';
    }
};

const getStatusBadgeVariant = (status: UserStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active': return 'default'; // Green in many themes, here primary
      case 'pending_approval': return 'secondary'; // Yellow/Orange
      case 'suspended': return 'destructive';
      default: return 'outline';
    }
};


export default function UsersPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>(() => JSON.parse(JSON.stringify(initialMockUsers)));
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReject, setUserToReject] = useState<User | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Active filters for the page
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterRole, setActiveFilterRole] = useState<RoleName | 'all'>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<UserStatus | 'all'>('all');


  // Temporary filters for the Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterRole, setTempFilterRole] = useState<RoleName | 'all'>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<UserStatus | 'all'>('all');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterRole(activeFilterRole);
      setTempFilterStatus(activeFilterStatus);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const filteredUsers = useMemo(() => {
    let currentUsers = [...users];
    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      currentUsers = currentUsers.filter(user =>
        user.name.toLowerCase().includes(lowerSearchTerm) ||
        user.email.toLowerCase().includes(lowerSearchTerm)
      );
    }
    if (activeFilterRole !== 'all') {
      currentUsers = currentUsers.filter(user => user.role === activeFilterRole);
    }
    if (activeFilterStatus !== 'all') {
      currentUsers = currentUsers.filter(user => user.status === activeFilterStatus);
    }
    return currentUsers.sort((a,b) => {
      if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
      if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterRole(tempFilterRole);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterRole('all');
    setTempFilterStatus('all');
  };
  
  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterRole('all');
    setActiveFilterStatus('all');
    resetDialogFilters(); 
    setIsFilterDialogOpen(false); 
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
    if (editingUser) { // Editing an existing active user
      const updatedUsers = users.map(u => u.id === editingUser.id ? { ...editingUser, ...data, avatarUrl: u.avatarUrl || 'https://placehold.co/100x100.png' } : u);
      setUsers(updatedUsers);
      const globalIndex = initialMockUsers.findIndex(u => u.id === editingUser.id);
      if (globalIndex !== -1) initialMockUsers[globalIndex] = { ...initialMockUsers[globalIndex], ...data, avatarUrl: initialMockUsers[globalIndex].avatarUrl || 'https://placehold.co/100x100.png' };

      toast({
        title: 'User Updated',
        description: `User ${data.name} has been updated.`,
      });
    } else { // Creating a new user (by admin)
      const newUser: User = {
        id: `u${users.length + 1 + Date.now()}`,
        ...data,
        avatarUrl: 'https://placehold.co/100x100.png',
        status: 'active', // New users created by admin are active by default
      };
      setUsers(prevUsers => [...prevUsers, newUser].sort((a, b) => a.name.localeCompare(b.name)));
      initialMockUsers.push(newUser); 
      initialMockUsers.sort((a, b) => a.name.localeCompare(b.name));

      toast({
        title: 'User Created',
        description: `User ${data.name} with role ${data.role} has been created.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteUser = (userId: string) => { // For deleting active users
    const deletedUser = users.find(u => u.id === userId);
    setUsers(currentUsers => currentUsers.filter(user => user.id !== userId));
    
    const globalIndex = initialMockUsers.findIndex(u => u.id === userId);
    if (globalIndex !== -1) initialMockUsers.splice(globalIndex, 1);

    toast({
      title: "User Deleted",
      description: `User "${deletedUser?.name}" has been removed.`,
      variant: "destructive"
    });
    setUserToDelete(null);
  };

  const handleApproveUser = (userId: string) => {
    const user = users.find(u=>u.id === userId);
    if (mockApproveSignup(userId)) { // This function now also handles adding notification
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'active' } : u)
        .sort((a,b) => {
          if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
          if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
          return a.name.localeCompare(b.name);
        })
      );
      toast({
        title: 'User Approved',
        description: `User ${user?.name} has been approved and is now active.`,
      });
    } else {
        toast({
            title: 'Approval Failed',
            description: `Could not approve user ${user?.name}. They might not be pending approval.`,
            variant: 'destructive',
        });
    }
  };

  const handleConfirmRejectUser = () => {
    if (!userToReject) return;
    const userDetails = users.find(u => u.id === userToReject.id);
    if (mockRejectSignup(userToReject.id)) {
      setUsers(prev => prev.filter(u => u.id !== userToReject.id));
      toast({
        title: 'Signup Request Rejected',
        description: `Signup request for ${userDetails?.name} has been rejected and removed.`,
        variant: 'destructive',
      });
    } else {
        toast({
            title: 'Rejection Failed',
            description: `Could not reject user ${userDetails?.name}.`,
            variant: 'destructive',
        });
    }
    setUserToReject(null);
  };


  const activeFilterCount = [activeSearchTerm !== '', activeFilterRole !== 'all', activeFilterStatus !== 'all'].filter(Boolean).length;
  const canAddUsers = currentUser?.role === 'Admin';
  const canManageUsers = currentUser?.role === 'Admin'; 
  const canApproveRejectSignups = currentUser?.role === 'Admin';


  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="View, add, and manage user accounts, roles, and signup requests."
        icon={UsersIconLucide}
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
                    Refine the list of users by applying filters below.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="userSearchDialog" className="text-sm font-medium mb-1 block">Search by Name/Email</Label>
                    <div className="relative">
                       <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="userSearchDialog"
                        type="search"
                        placeholder="Name or email..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
                        className="h-9 pl-8"
                        />
                    </div>
                  </div>
                   <div>
                    <Label htmlFor="userRoleDialog" className="text-sm font-medium mb-1 block">Role</Label>
                    <Select value={tempFilterRole} onValueChange={(value) => setTempFilterRole(value as RoleName | 'all')} >
                      <SelectTrigger id="userRoleDialog" className="h-9">
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
                  <div>
                    <Label htmlFor="userStatusDialog" className="text-sm font-medium mb-1 block">Status</Label>
                    <Select value={tempFilterStatus} onValueChange={(value) => setTempFilterStatus(value as UserStatus | 'all')} >
                      <SelectTrigger id="userStatusDialog" className="h-9">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {userStatusesList.map(status => (
                          <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t">
                  <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {canAddUsers && (
              <Button onClick={handleOpenNewUserDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add
              </Button>
            )}
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
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const RoleIcon = roleIcons[user.role] || UsersIconLucide;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.name} />
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
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(user.status)} className="capitalize">
                        {user.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {user.status === 'pending_approval' && canApproveRejectSignups && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveUser(user.id)}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve User</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToReject(user)}>
                                    <ThumbsDown className="h-4 w-4" />
                                    <span className="sr-only">Reject User</span>
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Reject User</p></TooltipContent>
                            </Tooltip>
                            {userToReject && userToReject.id === user.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure you want to reject this signup?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the signup request for <span className="font-semibold">{userToReject.name}</span>. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUserToReject(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction variant="destructive" onClick={handleConfirmRejectUser}>
                                    Reject Signup
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </>
                      )}
                      {user.status === 'active' && canManageUsers && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditUserDialog(user)}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User</p></TooltipContent>
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
                              <TooltipContent><p>Delete User</p></TooltipContent>
                            </Tooltip>
                            {userToDelete && userToDelete.id === user.id && (
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will remove the user 
                                    <span className="font-semibold"> {userToDelete.name}</span>.
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
                        </>
                      )}
                      {(user.status === 'suspended' || (user.status === 'pending_approval' && !canApproveRejectSignups)) && (
                        <span className="text-xs italic text-muted-foreground">No actions</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      ) : (
        <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
          <CardContent>
            <UsersIconLucide className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeFilterCount > 0 ? "No Users Match Filters" : "No Users Found"}
            </p>
            <p className="text-sm mb-4">
                {activeFilterCount > 0
                    ? "Try adjusting your search or filter criteria." 
                    : "There are currently no users in the system. Add one to get started!"
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActiveFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ) : (
              canAddUsers && (
                <Button onClick={handleOpenNewUserDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First User
                </Button>
              )
            )}
          </CardContent>
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
