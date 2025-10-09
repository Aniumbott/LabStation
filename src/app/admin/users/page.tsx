
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIconLucide, ShieldAlert, UserCheck, UserCog as UserCogIcon, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, ThumbsUp, ThumbsDown, Loader2, CheckCircle2, Settings2, User, Mail, Shield, Info, Trash2 } from 'lucide-react';
import type { User as UserType, RoleName, UserStatus, Lab } from '@/types'; // Renamed User import
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
import { ManageUserDetailsAndAccessDialog } from '@/components/admin/manage-user-details-and-access-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/components/auth-context';
import { useAdminData } from '@/contexts/AdminDataContext';
import { userRolesList } from '@/lib/app-constants';
import { addNotification, addAuditLog } from '@/lib/firestore-helpers';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, Timestamp, query, orderBy, where, writeBatch as firestoreWriteBatch } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


const userStatusesListForFilter: (UserStatus | 'all')[] = ['all', 'active', 'pending_approval', 'suspended'];

const roleIcons: Record<UserType['role'], React.ElementType> = {
  'Admin': ShieldAlert,
  'Technician': UserCheck,
  'Researcher': UserCheck,
};

const getRoleBadgeVariant = (role: RoleName): "default" | "secondary" | "destructive" | "outline" => {
    switch (role) {
      case 'Admin': return 'destructive';
      case 'Technician': return 'secondary';
      case 'Researcher': return 'outline';
      default: return 'outline';
    }
};

const getStatusBadgeClasses = (status: UserStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white hover:bg-green-600 border-transparent';
      case 'pending_approval': return 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent';
      case 'suspended': return 'bg-red-500 text-white hover:bg-red-600 border-transparent';
      default: return 'bg-gray-500 text-white hover:bg-gray-600 border-transparent';
    }
};


export default function UsersPage() {
  const { toast } = useToast();
  const { currentUser: loggedInUser } = useAuth();
  const { allUsers: users, labs: allLabs, isLoading: isAdminDataLoading, refetch: refetchAdminData } = useAdminData();

  const [userToDelete, setUserToDelete] = useState<UserType | null>(null);
  const [userToReject, setUserToReject] = useState<UserType | null>(null);
  const [isAddUserFormDialogOpen, setIsAddUserFormDialogOpen] = useState(false); // For adding new users
  
  const [isManageUserDetailsAndAccessDialogOpen, setIsManageUserDetailsAndAccessDialogOpen] = useState(false);
  const [selectedUserForManagement, setSelectedUserForManagement] = useState<UserType | null>(null);

  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterRole, setTempFilterRole] = useState<RoleName | 'all'>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<UserStatus | 'all'>('all');

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterRole, setActiveFilterRole] = useState<RoleName | 'all'>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<UserStatus | 'all'>('all');

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterRole(activeFilterRole);
      setTempFilterStatus(activeFilterStatus);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterRole, activeFilterStatus]);

  const filteredUsers = useMemo(() => {
    let sortedUsers = [...users].sort((a,b) => {
        if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
        if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    return sortedUsers.filter(user => {
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
    setIsAddUserFormDialogOpen(true);
  }, []);

  const handleOpenManageUserDetailsAndAccessDialog = useCallback((user: UserType) => {
    setSelectedUserForManagement(user);
    setIsManageUserDetailsAndAccessDialogOpen(true);
  }, []);

  const handleSaveNewUser = useCallback(async (data: UserFormValues) => {
    if (!loggedInUser || loggedInUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    
    setIsProcessingAction(true);
    try {
      const newUserId = `admin_created_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
      const userDocRef = doc(db, "users", newUserId);
      await setDoc(userDocRef, {
        name: data.name,
        email: data.email,
        role: data.role,
        avatarUrl: 'https://placehold.co/100x100.png',
        status: 'active' as UserType['status'],
        createdAt: serverTimestamp(),
      });
      await addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_CREATED', { entityType: 'User', entityId: newUserId, details: `User profile for ${data.name} (${data.email}) created by admin with role ${data.role}. This user cannot log in without a corresponding Auth account.` });
      toast({ title: 'User Profile Created (Admin)', description: `User profile for ${data.name} created. Note: This does not create a Firebase Auth account for login.` });
      
      setIsAddUserFormDialogOpen(false);
      refetchAdminData();
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save user profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  }, [loggedInUser, refetchAdminData, toast]);

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

    setIsProcessingAction(true);
    try {
      const userDocRef = doc(db, "users", userId);
      
      const batch = firestoreWriteBatch(db);
      batch.delete(userDocRef);
      
      const membershipsQuery = query(collection(db, 'labMemberships'), where('userId', '==', userId));
      const membershipsSnapshot = await getDocs(membershipsQuery);
      membershipsSnapshot.forEach(docSnap => batch.delete(docSnap.ref));
      
      await batch.commit();

      await addAuditLog(loggedInUser.id, loggedInUser.name || 'Admin', 'USER_DELETED', { entityType: 'User', entityId: userId, details: `User profile for ${userToDeleteDetails.name} (ID: ${userId}) and all their lab memberships deleted. Associated Firebase Auth user may still exist if one was created via signup.` });
      toast({ title: "User Profile Deleted", description: `User "${userToDeleteDetails.name}" Firestore profile and lab memberships removed. Note: Their Firebase Auth account may still exist.`, variant: "destructive" });
      setUserToDelete(null);
      refetchAdminData();
    } catch (error: any) {
      toast({ title: "Delete Error", description: `Could not delete user profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  }, [loggedInUser, users, refetchAdminData, toast]);

  const handleApproveUser = useCallback(async (userId: string) => {
    if (!loggedInUser || !loggedInUser.id || loggedInUser.role !== 'Admin') {
      toast({ title: "Permission Denied", description: "You are not authorized to approve users.", variant: "destructive" });
      return;
    }
    const userToApproveDetails = users.find(u => u.id === userId);
    if (!userToApproveDetails) {
        toast({ title: "Error", description: "User to approve not found.", variant: "destructive" });
        return;
    }

    setIsProcessingAction(true);
    try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, { status: 'active' });
        
        const approvedUserName = userToApproveDetails.name || 'A user';
        const adminName = loggedInUser.name || 'Admin';

        await addAuditLog(loggedInUser.id, adminName, 'USER_APPROVED', { entityType: 'User', entityId: userId, details: `User ${approvedUserName} (ID: ${userId}) approved by ${adminName}.`});
        toast({ title: 'User Approved', description: `User ${approvedUserName} has been approved and is now active.` });
        
        try {
            await addNotification(
                userId,
                'Account Approved!',
                'Your LabStation account has been approved. You can now log in.',
                'signup_approved',
                '/login'
            );
        } catch (notificationError: any) {
            toast({ title: "Notification Error", description: `Failed to send approval notification: ${notificationError.message}`, variant: "destructive" });
        }
        refetchAdminData();
    } catch (error: any) {
        toast({ title: "Approval Error", description: `Could not approve user: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  }, [loggedInUser, users, refetchAdminData, toast]);

  const handleConfirmRejectUser = useCallback(async () => {
    if (!userToReject || !loggedInUser || !loggedInUser.id || loggedInUser.role !== 'Admin') {
        toast({ title: "Error", description: "No user selected for rejection or permission denied.", variant: "destructive" });
        setUserToReject(null);
        return;
    }
    const userDetails = users.find(u => u.id === userToReject.id);
    if (!userDetails) {
        toast({ title: "Error", description: "User to reject not found in current list.", variant: "destructive" });
        setUserToReject(null);
        return;
    }

    setIsProcessingAction(true);
    try {
      const userDocRef = doc(db, "users", userToReject.id);
      await deleteDoc(userDocRef);

      const rejectedUserName = userDetails.name || 'A user';
      const adminName = loggedInUser.name || 'Admin';

      await addAuditLog(loggedInUser.id, adminName, 'USER_REJECTED', { entityType: 'User', entityId: userToReject.id, details: `Signup request for ${rejectedUserName} (ID: ${userToReject.id}) rejected by ${adminName} and profile removed. Associated Firebase Auth user may still exist.` });
      toast({ title: 'Signup Request Rejected', description: `Signup request for ${rejectedUserName} has been rejected and profile removed. Note: Their Firebase Auth account may still exist.`, variant: 'destructive' });
      setUserToReject(null);
      refetchAdminData();
    } catch (error: any) {
      toast({ title: "Rejection Error", description: `Could not reject signup: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(false);
    }
  }, [userToReject, loggedInUser, users, refetchAdminData, toast]);

  const activeFilterCount = useMemo(() => [activeSearchTerm !== '', activeFilterRole !== 'all', activeFilterStatus !== 'all'].filter(Boolean).length, [activeSearchTerm, activeFilterRole, activeFilterStatus]);
  
  const canAddUsers = loggedInUser?.role === 'Admin';
  const canManageUsersGeneral = loggedInUser?.role === 'Admin';
  const canApproveRejectSignups = loggedInUser?.role === 'Admin';

  if (!loggedInUser || loggedInUser.role !== 'Admin') {
    return (
      <div className="space-y-8">
        <PageHeader title="Users" icon={UsersIconLucide} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent><p>You do not have permission to view this page.</p></CardContent>
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
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Users</DialogTitle>
                  <DialogDescription>
                    Refine the list of users by applying filters below.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                  <div className="space-y-4 px-4 py-2">
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
                </ScrollArea>
                <DialogFooter className="pt-6 border-t">
                  <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
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
      {isAdminDataLoading ? (
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
                <TableHead><div className="flex items-center gap-1"><UsersIconLucide className="h-4 w-4 text-muted-foreground" />Name</div></TableHead>
                <TableHead><div className="flex items-center gap-1"><Mail className="h-4 w-4 text-muted-foreground" />Email</div></TableHead>
                <TableHead><div className="flex items-center gap-1"><Shield className="h-4 w-4 text-muted-foreground" />Role</div></TableHead>
                <TableHead><div className="flex items-center gap-1"><Info className="h-4 w-4 text-muted-foreground" />Status</div></TableHead>
                <TableHead className="text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => {
                const RoleIcon = roleIcons[user.role as Exclude<RoleName, 'Lab Manager'>] || UsersIconLucide;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint="user avatar"/>
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
                      <Badge className={cn("capitalize", getStatusBadgeClasses(user.status))}>
                        {user.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {user.status === 'pending_approval' && canApproveRejectSignups && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveUser(user.id)} disabled={isProcessingAction}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve User</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog open={userToReject?.id === user.id} onOpenChange={(isOpen) => !isOpen && setUserToReject(null)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToReject(user)} disabled={isProcessingAction}>
                                    <ThumbsDown className="h-4 w-4" />
                                    <span className="sr-only">Reject User Signup</span>
                                </Button>
                                </AlertDialogTrigger>
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
                                <AlertDialogFooter className="pt-6 border-t">
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenManageUserDetailsAndAccessDialog(user)} disabled={isProcessingAction}>
                                <Settings2 className="h-4 w-4" />
                                <span className="sr-only">Manage User</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Manage User Details & Lab Access</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog open={userToDelete?.id === user.id} onOpenChange={(isOpen) => !isOpen && setUserToDelete(null)}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setUserToDelete(user)} disabled={isProcessingAction}>
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete User Profile</span>
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Delete User Profile</p></TooltipContent>
                            </Tooltip>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will remove the user
                                    <span className="font-semibold"> {userToDelete?.name}</span>'s profile from Firestore and all their lab memberships.
                                    The Firebase Auth account may need to be deleted separately.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="pt-6 border-t">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}>
                                    Delete User Profile
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                      {((user.status === 'suspended' || (loggedInUser && user.id === loggedInUser.id)) && user.status !== 'pending_approval') && (
                        <span className="text-xs italic text-muted-foreground">No direct actions</span>
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
              !isAdminDataLoading && users.length === 0 && canAddUsers && (
                <Button onClick={handleOpenNewUserDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First User Profile
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}
      {isAddUserFormDialogOpen && (
        <UserFormDialog
            open={isAddUserFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsAddUserFormDialogOpen(isOpen);
            }}
            initialUser={null} // Always for new user
            onSave={handleSaveNewUser}
        />
      )}
      {selectedUserForManagement && allLabs && (
        <ManageUserDetailsAndAccessDialog
          targetUser={selectedUserForManagement}
          allLabs={allLabs}
          open={isManageUserDetailsAndAccessDialogOpen}
          onOpenChange={(isOpen) => {
            setIsManageUserDetailsAndAccessDialogOpen(isOpen);
            if (!isOpen) setSelectedUserForManagement(null);
          }}
          onUpdate={refetchAdminData}
        />
      )}
    </div>
  );
}

    