
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIconLucide, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
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
import { useAuth } from '@/components/auth-context';
import { userRolesList, addNotification, addAuditLog } from '@/lib/mock-data';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, type Timestamp } from 'firebase/firestore';


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
      case 'active': return 'default';
      case 'pending_approval': return 'secondary';
      case 'suspended': return 'destructive';
      default: return 'outline';
    }
};


export default function UsersPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToReject, setUserToReject] = useState<User | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterRole, setActiveFilterRole] = useState<RoleName | 'all'>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<UserStatus | 'all'>('all');

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterRole, setTempFilterRole] = useState<RoleName | 'all'>(activeFilterRole);
  const [tempFilterStatus, setTempFilterStatus] = useState<UserStatus | 'all'>(activeFilterStatus);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const usersCollectionRef = collection(db, "users");
      const querySnapshot = await getDocs(usersCollectionRef);
      const fetchedUsers: User[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let createdAtStr: string | undefined;
        if (data.createdAt && typeof data.createdAt.toDate === 'function') {
          createdAtStr = (data.createdAt as Timestamp).toDate().toISOString();
        } else if (typeof data.createdAt === 'string') {
          createdAtStr = data.createdAt;
        } else {
           createdAtStr = new Date().toISOString(); // Fallback for older data without createdAt
        }

        fetchedUsers.push({
            id: docSnap.id,
            name: data.name || 'N/A',
            email: data.email || 'N/A',
            role: data.role || 'Researcher',
            status: data.status || 'pending_approval',
            avatarUrl: data.avatarUrl || 'https://placehold.co/100x100.png',
            createdAt: createdAtStr,
        } as User);
      });
      setUsers(fetchedUsers.sort((a,b) => {
        if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
        if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
        return (a.name || '').localeCompare(b.name || '');
      }));
    } catch (error) {
      console.error("Error fetching users: ", error);
      toast({ title: "Error", description: "Failed to fetch users from database.", variant: "destructive" });
    }
    setIsLoadingUsers(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterRole(activeFilterRole);
      setTempFilterStatus(activeFilterStatus);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const filteredUsers = useMemo(() => {
    let currentUsers = [...users];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      currentUsers = currentUsers.filter(user =>
        (user.name && user.name.toLowerCase().includes(lowerSearchTerm)) ||
        (user.email && user.email.toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (activeFilterRole !== 'all') {
      currentUsers = currentUsers.filter(user => user.role === activeFilterRole);
    }
    if (activeFilterStatus !== 'all') {
      currentUsers = currentUsers.filter(user => user.status === activeFilterStatus);
    }
    return currentUsers;
  }, [users, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const handleApplyDialogFilters = () => {
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

  const resetAllActivePageFilters = () => {
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

  const handleSaveUser = async (data: UserFormValues) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    
    setIsLoadingUsers(true); // Indicate loading state
    if (editingUser) { // Editing existing user
      try {
        const userDocRef = doc(db, "users", editingUser.id);
        await updateDoc(userDocRef, {
          name: data.name,
          role: data.role,
          // Email and status are not updated here; status is via Approve/Suspend actions.
        });
        addAuditLog(currentUser.id, currentUser.name || 'Admin', 'USER_UPDATED', { entityType: 'User', entityId: editingUser.id, details: `User ${data.name} (ID: ${editingUser.id}) details updated. Role set to ${data.role}.` });
        toast({ title: 'User Updated', description: `User ${data.name} has been updated.` });
      } catch (error) {
        console.error("Error updating user:", error);
        toast({ title: "Error", description: "Failed to update user.", variant: "destructive" });
      }
    } else { 
      // Admin creating a user profile. This ONLY creates a Firestore profile.
      // It does NOT create a Firebase Auth user. This user won't be able to log in.
      try {
        const newUserId = `admin_created_${Date.now()}`; // Simple unique ID
        const userDocRef = doc(db, "users", newUserId);
        const newUserProfileData = {
          name: data.name,
          email: data.email, // Email must be unique if it's to be used for login later via other means
          role: data.role,
          avatarUrl: 'https://placehold.co/100x100.png',
          status: 'active' as User['status'], // Admin-created users are active by default
          createdAt: serverTimestamp(),
        };
        await setDoc(userDocRef, newUserProfileData);
        addAuditLog(currentUser.id, currentUser.name || 'Admin', 'USER_CREATED', { entityType: 'User', entityId: newUserId, details: `User profile for ${data.name} created by admin with role ${data.role}. This user cannot log in without a corresponding Auth account.` });
        toast({ title: 'User Profile Created', description: `User profile for ${data.name} with role ${data.role} has been created. They cannot log in without a Firebase Auth account.` });
      } catch (error: any) {
        console.error("Error creating user profile by admin:", error);
        let description = "Failed to create user profile.";
        if (error.code === 'permission-denied') description = "Permission denied to create user profile.";
        toast({ title: "Error", description, variant: "destructive" });
      }
    }
    setIsFormDialogOpen(false);
    await fetchUsers(); // Re-fetch users to show changes
  };

 const handleDeleteUser = async (userId: string) => {
    if (!currentUser || currentUser.role !== 'Admin') {
        toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
        return;
    }
    const userToDeleteDetails = users.find(u => u.id === userId);
    setIsLoadingUsers(true);
    try {
      // This only deletes the Firestore profile.
      // Deleting the Firebase Auth user requires Admin SDK or Cloud Function.
      const userDocRef = doc(db, "users", userId);
      await deleteDoc(userDocRef);
      
      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'USER_DELETED', { entityType: 'User', entityId: userId, details: `User profile for ${userToDeleteDetails?.name || userId} (ID: ${userId}) deleted.` });
      toast({ title: "User Profile Deleted", description: `User "${userToDeleteDetails?.name}" Firestore profile has been removed. Firebase Auth user may still exist if one was associated.`, variant: "destructive" });
    } catch (error) {
      console.error("Error deleting user profile:", error);
      toast({ title: "Error", description: "Failed to delete user profile.", variant: "destructive" });
    }
    setUserToDelete(null);
    await fetchUsers(); 
  };


  const handleApproveUser = async (userId: string) => {
    if (!currentUser || currentUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    const userToApproveDetails = users.find(u => u.id === userId);
    if (!userToApproveDetails) {
        toast({ title: "Error", description: "User not found.", variant: "destructive" });
        return;
    }
    setIsLoadingUsers(true);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { status: 'active' });
        
        addAuditLog(currentUser.id, currentUser.name || 'Admin', 'USER_APPROVED', { entityType: 'User', entityId: userId, details: `User ${userToApproveDetails.name} (ID: ${userId}) approved.`});
        toast({ title: 'User Approved', description: `User ${userToApproveDetails.name} has been approved and is now active.` });
        
        // Notify the approved user
        await addNotification(
            userId,
            'Account Approved!',
            'Your LabStation account has been approved. You can now log in.',
            'signup_approved',
            '/login'
        );
    } catch (error) {
        console.error("Error approving user:", error);
        toast({ title: 'Approval Failed', description: `Could not approve user ${userToApproveDetails.name}.`, variant: 'destructive' });
    }
    await fetchUsers(); 
  };

  const handleConfirmRejectUser = async () => {
    if (!userToReject || !currentUser || currentUser.role !== 'Admin') {
        toast({ title: "Permission Denied or No User Selected", variant: "destructive" });
        setUserToReject(null);
        return;
    }
    const userDetails = users.find(u => u.id === userToReject.id);
    setIsLoadingUsers(true);
    try {
      // This deletes the Firestore profile for the pending user.
      // The Firebase Auth user (created during signup attempt) would also need to be deleted via Admin SDK for full cleanup.
      const userDocRef = doc(db, "users", userToReject.id);
      await deleteDoc(userDocRef);

      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'USER_REJECTED', { entityType: 'User', entityId: userToReject.id, details: `Signup request for ${userDetails?.name || userToReject.id} (ID: ${userToReject.id}) rejected and profile removed.` });
      toast({ title: 'Signup Request Rejected', description: `Signup request for ${userDetails?.name} has been rejected and removed. Firebase Auth user may still exist if one was created.`, variant: 'destructive' });
    } catch (error) {
      console.error("Error rejecting user:", error);
      toast({ title: 'Rejection Failed', description: `Could not reject user ${userDetails?.name}.`, variant: 'destructive' });
    }
    setUserToReject(null);
    await fetchUsers(); 
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
                  <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
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
                                    This will remove the signup request for <span className="font-semibold">{userToReject.name}</span>. This action cannot be undone from the UI (Auth user might persist).
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
                      {user.status === 'active' && canManageUsers && user.id !== currentUser?.id && ( 
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
                                      <span className="sr-only">Delete User Profile</span>
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete User Profile</p></TooltipContent>
                            </Tooltip>
                            {userToDelete && userToDelete.id === user.id && (
                                <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will remove the user
                                    <span className="font-semibold"> {userToDelete.name}</span>'s profile from Firestore.
                                    The Firebase Auth account may need to be deleted separately.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => handleDeleteUser(userToDelete.id)}>
                                    Delete User Profile
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                                </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </>
                      )}
                      {((user.status === 'suspended' || user.id === currentUser?.id) && user.status !== 'pending_approval') && (
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
                    ? "Try adjusting your search or filter criteria."
                    : (canAddUsers ? "There are currently no users in the system. Add one to get started!" : "There are currently no users matching this criteria.")
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ) : (
              !filteredUsers.length && canAddUsers && (
                <Button onClick={handleOpenNewUserDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First User Profile
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
