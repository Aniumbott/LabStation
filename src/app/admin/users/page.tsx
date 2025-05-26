
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIconLucide, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, ThumbsUp, ThumbsDown, Loader2, X, CheckCircle2 } from 'lucide-react';
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
}from "@/components/ui/alert-dialog";
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
import { useAuth } from '@/components/auth-context';
import { userRolesList, addNotification, addAuditLog } from '@/lib/mock-data';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, Timestamp, query, orderBy, where } from 'firebase/firestore';

const userStatusesListForFilter: (UserStatus | 'all')[] = ['all', 'active', 'pending_approval', 'suspended'];

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
      case 'active': return 'default'; // Greenish
      case 'pending_approval': return 'secondary'; // Yellowish/Amber
      case 'suspended': return 'destructive'; // Reddish
      default: return 'outline';
    }
};


export default function UsersPage() {
  const { toast } = useToast();
  const { currentUser: loggedInUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReject, setUserToReject] = useState<User | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterRole, setTempFilterRole] = useState<RoleName | 'all'>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<UserStatus | 'all'>('all');

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterRole, setActiveFilterRole] = useState<RoleName | 'all'>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<UserStatus | 'all'>('all');

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, "users");
      const usersQuery = query(usersCollectionRef, orderBy("name", "asc")); // Basic ordering
      const querySnapshot = await getDocs(usersQuery);
      
      let fetchedUsers: User[] = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name || 'N/A',
            email: data.email || 'N/A',
            role: data.role || 'Researcher',
            status: data.status || 'pending_approval',
            avatarUrl: data.avatarUrl || 'https://placehold.co/100x100.png',
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as User;
      });
      // Client-side sort to put 'pending_approval' first, then by name
      fetchedUsers.sort((a,b) => {
        if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
        if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
        return (a.name || '').localeCompare(b.name || '');
      });
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error("Error fetching users: ", error);
      toast({ title: "Error Fetching Users", description: error.message || "Failed to load users from database.", variant: "destructive" });
      setUsers([]);
    }
    setIsLoadingUsers(false);
  }, [toast]);

  useEffect(() => {
    if (loggedInUser?.role === 'Admin') {
      fetchUsers();
    } else {
      setUsers([]);
      setIsLoadingUsers(false);
    }
  }, [loggedInUser, fetchUsers]);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterRole(activeFilterRole);
      setTempFilterStatus(activeFilterStatus);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      const nameMatch = user.name && user.name.toLowerCase().includes(lowerSearchTerm);
      const emailMatch = user.email && user.email.toLowerCase().includes(lowerSearchTerm);
      const roleMatch = activeFilterRole === 'all' || user.role === activeFilterRole;
      const statusMatch = activeFilterStatus === 'all' || user.status === activeFilterStatus;
      return (nameMatch || emailMatch) && roleMatch && statusMatch;
    });
  }, [users, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterRole(tempFilterRole);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempFilterRole, tempFilterStatus]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterRole('all');
    setTempFilterStatus('all');
  }, []);

  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterRole('all');
    setActiveFilterStatus('all');
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly]);

  const handleOpenNewUserDialog = useCallback(() => {
    setEditingUser(null);
    setIsFormDialogOpen(true);
  }, []);

  const handleOpenEditUserDialog = useCallback((user: User) => {
    setEditingUser(user);
    setIsFormDialogOpen(true);
  }, []);

  const handleSaveUser = useCallback(async (data: UserFormValues) => {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    
    setIsLoadingUsers(true);
    try {
      if (editingUser) { // Editing existing user profile
        const userDocRef = doc(db, "users", editingUser.id);
        await updateDoc(userDocRef, {
          name: data.name,
          role: data.role,
          // Email and status are not edited here directly; status handled by approve/suspend actions
        });
        addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_UPDATED', { entityType: 'User', entityId: editingUser.id, details: `User ${data.name} (ID: ${editingUser.id}) details updated. Role set to ${data.role}.` });
        toast({ title: 'User Updated', description: `User ${data.name} has been updated.` });
      } else { // Admin creating a new user profile (Firestore only, not Auth)
        const newUserId = `admin_created_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
        const userDocRef = doc(db, "users", newUserId);
        await setDoc(userDocRef, {
          name: data.name,
          email: data.email, // Email provided in form for admin add
          role: data.role,
          avatarUrl: 'https://placehold.co/100x100.png',
          status: 'active' as User['status'], // Admin created users are active by default
          createdAt: serverTimestamp(),
        });
        addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_CREATED', { entityType: 'User', entityId: newUserId, details: `User profile for ${data.name} (${data.email}) created by admin with role ${data.role}. This user cannot log in without a corresponding Auth account.` });
        toast({ title: 'User Profile Created (Admin)', description: `User profile for ${data.name} created. Note: This does not create a Firebase Auth account for login.` });
      }
      setIsFormDialogOpen(false);
      setEditingUser(null);
      await fetchUsers();
    } catch (error: any) {
      console.error(`Error ${editingUser ? 'updating' : 'creating'} user profile:`, error);
      toast({ title: "Operation Failed", description: `Could not ${editingUser ? 'update' : 'create'} user profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingUsers(false); 
    }
  }, [loggedInUser, editingUser, fetchUsers, toast]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
        toast({ title: "Permission Denied", description: "You are not authorized to delete users.", variant: "destructive" });
        return;
    }
    const userToDeleteDetails = users.find(u => u.id === userId);
    if (!userToDeleteDetails) {
        toast({ title: "Error", description: "User to delete not found.", variant: "destructive" });
        return;
    }

    setIsLoadingUsers(true);
    try {
      const userDocRef = doc(db, "users", userId);
      await deleteDoc(userDocRef); // Deletes Firestore profile
      addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_DELETED', { entityType: 'User', entityId: userId, details: `User profile for ${userToDeleteDetails.name} (ID: ${userId}) deleted. Associated Firebase Auth user may still exist if one was created via signup.` });
      toast({ title: "User Profile Deleted", description: `User "${userToDeleteDetails.name}" Firestore profile has been removed. Note: Their Firebase Auth account may still exist.`, variant: "destructive" });
      setUserToDelete(null);
      await fetchUsers();
    } catch (error: any) {
      console.error("Error deleting user profile:", error);
      toast({ title: "Delete Failed", description: `Could not delete user profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [loggedInUser, users, fetchUsers, toast]);

  const handleApproveUser = useCallback(async (userId: string) => {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to approve users.", variant: "destructive" });
      return;
    }
    const userToApproveDetails = users.find(u => u.id === userId);
    if (!userToApproveDetails) {
        toast({ title: "Error", description: "User to approve not found.", variant: "destructive" });
        return;
    }

    setIsLoadingUsers(true);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { status: 'active' });
        
        addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_APPROVED', { entityType: 'User', entityId: userId, details: `User ${userToApproveDetails.name} (ID: ${userId}) approved by ${loggedInUser.name}.`});
        toast({ title: 'User Approved', description: `User ${userToApproveDetails.name} has been approved and is now active.` });
        
        addNotification(
            userId,
            'Account Approved!',
            'Your LabStation account has been approved. You can now log in.',
            'signup_approved',
            '/login'
        );
        await fetchUsers(); // Refresh list
    } catch (error: any) {
        console.error("Error approving user:", error);
        toast({ title: 'Approval Failed', description: `Could not approve user ${userToApproveDetails.name}: ${error.message}`, variant: 'destructive' });
    } finally {
        setIsLoadingUsers(false);
    }
  }, [loggedInUser, users, fetchUsers, toast]);

  const handleConfirmRejectUser = useCallback(async () => {
    if (!userToReject || !loggedInUser || loggedInUser.role !== 'Admin') {
        toast({ title: "Error", description: "No user selected for rejection or permission denied.", variant: "destructive" });
        setUserToReject(null);
        return;
    }
    const userDetails = users.find(u => u.id === userToReject.id); // Find from current state for name
    if (!userDetails) {
        toast({ title: "Error", description: "User to reject not found in current list.", variant: "destructive" });
        setUserToReject(null);
        return;
    }

    setIsLoadingUsers(true);
    try {
      const userDocRef = doc(db, "users", userToReject.id);
      await deleteDoc(userDocRef); // Deletes Firestore profile for the pending user

      addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_REJECTED', { entityType: 'User', entityId: userToReject.id, details: `Signup request for ${userDetails.name} (ID: ${userToReject.id}) rejected by ${loggedInUser.name} and profile removed. Associated Firebase Auth user may still exist.` });
      toast({ title: 'Signup Request Rejected', description: `Signup request for ${userDetails.name} has been rejected and profile removed. Note: Their Firebase Auth account may still exist.`, variant: 'destructive' });
      setUserToReject(null);
      await fetchUsers(); // Refresh list
    } catch (error: any) {
      console.error("Error rejecting user:", error);
      toast({ title: 'Rejection Failed', description: `Could not reject user ${userDetails.name}: ${error.message}`, variant: 'destructive' });
    } finally {
      setIsLoadingUsers(false);
    }
  }, [userToReject, loggedInUser, users, fetchUsers, toast]);

  const activeFilterCount = useMemo(() => [activeSearchTerm !== '', activeFilterRole !== 'all', activeFilterStatus !== 'all'].filter(Boolean).length, [activeSearchTerm, activeFilterRole, activeFilterStatus]);
  
  const canAddUsers = loggedInUser?.role === 'Admin';
  const canManageUsersGeneral = loggedInUser?.role === 'Admin';
  const canApproveRejectSignups = loggedInUser?.role === 'Admin';

  if (!loggedInUser || loggedInUser.role !== 'Admin') {
    return (
      <div className="space-y-8">
        <PageHeader title="Users" icon={UsersIconLucide} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        description="View, add, and manage user accounts, roles, and signup requests."
        icon={UsersIconLucide}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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
              <DialogContent className="w-full max-w-xs sm:max-w-sm md:max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Users</DialogTitle>
                  <DialogDescription>
                    Refine the list of users by applying filters below.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="flex flex-col gap-4"> {/* Explicit vertical stacking */}
                  <div>
                    <Label htmlFor="userSearchDialog">Search (Name/Email)</Label>
                    <div className="relative mt-1">
                       <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="userSearchDialog"
                        type="search"
                        placeholder="Name or email..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value)}
                        className="h-9 pl-8"
                        />
                    </div>
                  </div>
                   <div>
                    <Label htmlFor="userRoleDialog">Role</Label>
                    <Select value={tempFilterRole} onValueChange={(value) => setTempFilterRole(value as RoleName | 'all')} >
                      <SelectTrigger id="userRoleDialog" className="h-9 mt-1">
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
                    <Label htmlFor="userStatusDialog">Status</Label>
                    <Select value={tempFilterStatus} onValueChange={(value) => setTempFilterStatus(value as UserStatus | 'all')} >
                      <SelectTrigger id="userStatusDialog" className="h-9 mt-1">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {userStatusesListForFilter.map(status => (
                          <SelectItem key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t mt-4">
                  <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
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
      {isLoadingUsers ? (
         <div className="flex justify-center items-center py-10 text-muted-foreground">
           <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
           Loading users...
         </div>
      ) : filteredUsers.length > 0 ? (
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
                        <AvatarFallback>{user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name || 'N/A'}</TableCell>
                    <TableCell>{user.email || 'N/A'}</TableCell>
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
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveUser(user.id)} disabled={isLoadingUsers}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve User</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog open={userToReject?.id === user.id} onOpenChange={(isOpen) => !isOpen && setUserToReject(null)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToReject(user)} disabled={isLoadingUsers}>
                                    <ThumbsDown className="h-4 w-4" />
                                    <span className="sr-only">Reject User</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Reject User Signup</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure you want to reject this signup?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will remove the signup request for <span className="font-semibold">{userToReject?.name}</span>. This action cannot be undone from the UI (Auth user might persist if they completed Firebase Auth part).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUserToReject(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction variant="destructive" onClick={handleConfirmRejectUser}>
                                    Reject Signup
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {user.status === 'active' && canManageUsersGeneral && loggedInUser && user.id !== loggedInUser.id && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditUserDialog(user)} disabled={isLoadingUsers}>
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Edit User</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog open={userToDelete?.id === user.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToDelete(user)} disabled={isLoadingUsers}>
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete User Profile</span>
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete User Profile</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will remove the user
                                    <span className="font-semibold"> {userToDelete?.name}</span>'s profile from Firestore.
                                    The Firebase Auth account may need to be deleted separately.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}>
                                    Delete User Profile
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {((user.status === 'suspended' || (loggedInUser && user.id === loggedInUser.id)) && user.status !== 'pending_approval') && (
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
        <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
          <CardContent>
            <UsersIconLucide className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeFilterCount > 0 ? "No Users Match Filters" : "No Users Found"}
            </p>
            <p className="text-sm mb-4">
                {activeFilterCount > 0
                    ? "Try adjusting your filter or search criteria."
                    : (canAddUsers ? "There are currently no user profiles in the system. Add one to get started or new users can sign up." : "There are currently no users matching this criteria.")
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ) : (
              !isLoadingUsers && users.length === 0 && canAddUsers && (
                <Button onClick={handleOpenNewUserDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First User Profile
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}
      {isFormDialogOpen && (
        <UserFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
                if (!isOpen) setEditingUser(null);
            }}
            initialUser={editingUser}
            onSave={handleSaveUser}
        />
      )}
    </div>
  );
}
