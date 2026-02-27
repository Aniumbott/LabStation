
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIconLucide, ShieldAlert, UserCheck, UserCog as UserCogIcon, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, ThumbsUp, ThumbsDown, CheckCircle2, Settings2, User, Mail, Shield, Info, Trash2 } from 'lucide-react';
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
import { createUserProfile_SA, approveUser_SA, rejectUser_SA, deleteUser_SA } from '@/lib/actions/user.actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';


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
      const result = await createUserProfile_SA({
        callerUserId: loggedInUser.id,
        name: data.name,
        email: data.email,
        role: data.role,
      });

      if (!result.success) {
        toast({ title: "Save Error", description: result.message || 'Could not save user profile.', variant: "destructive" });
        return;
      }

      toast({ title: 'User Profile Created (Admin)', description: `User profile for ${data.name} created. A temporary password has been set.` });
      setIsAddUserFormDialogOpen(false);
      refetchAdminData();
    } catch (error: unknown) {
      toast({ title: "Save Error", description: `Could not save user profile: ${(error as Error).message}`, variant: "destructive" });
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
      const result = await deleteUser_SA({
        callerUserId: loggedInUser.id,
        targetUserId: userId,
      });

      if (!result.success) {
        toast({ title: "Delete Error", description: result.message || 'Could not delete user profile.', variant: "destructive" });
        return;
      }

      toast({ title: "User Profile Deleted", description: `User "${userToDeleteDetails.name}" profile and lab memberships removed.`, variant: "destructive" });
      setUserToDelete(null);
      refetchAdminData();
    } catch (error: unknown) {
      toast({ title: "Delete Error", description: `Could not delete user profile: ${(error as Error).message}`, variant: "destructive" });
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
        const result = await approveUser_SA({
          callerUserId: loggedInUser.id,
          targetUserId: userId,
        });

        if (!result.success) {
          toast({ title: "Approval Error", description: result.message || 'Could not approve user.', variant: "destructive" });
          return;
        }

        const approvedUserName = userToApproveDetails.name || 'A user';
        toast({ title: 'User Approved', description: `User ${approvedUserName} has been approved and is now active.` });
        refetchAdminData();
    } catch (error: unknown) {
        toast({ title: "Approval Error", description: `Could not approve user: ${(error as Error).message}`, variant: "destructive" });
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
      const result = await rejectUser_SA({
        callerUserId: loggedInUser.id,
        targetUserId: userToReject.id,
      });

      if (!result.success) {
        toast({ title: "Rejection Error", description: result.message || 'Could not reject signup.', variant: "destructive" });
        return;
      }

      const rejectedUserName = userDetails.name || 'A user';
      toast({ title: 'Signup Request Rejected', description: `Signup request for ${rejectedUserName} has been rejected and profile removed.`, variant: 'destructive' });
      setUserToReject(null);
      refetchAdminData();
    } catch (error: unknown) {
      toast({ title: "Rejection Error", description: `Could not reject signup: ${(error as Error).message}`, variant: "destructive" });
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
      <div className="space-y-6">
        <PageHeader title="Users" icon={UsersIconLucide} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent><p>You do not have permission to view this page.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      <TooltipProvider>
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground w-[80px]">Avatar</TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1"><UsersIconLucide className="h-4 w-4 text-muted-foreground" />Name</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1"><Mail className="h-4 w-4 text-muted-foreground" />Email</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1"><Shield className="h-4 w-4 text-muted-foreground" />Role</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1"><Info className="h-4 w-4 text-muted-foreground" />Status</div></TableHead>
                <TableHead className="font-semibold text-foreground text-right w-[160px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isAdminDataLoading ? (
                <TableSkeleton rows={5} cols={6} />
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => {
                  const RoleIcon = roleIcons[user.role as Exclude<RoleName, 'Lab Manager'>] || UsersIconLucide;
                  return (
                    <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
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
                                      This will remove the signup request for <span className="font-semibold">{userToReject?.name}</span>. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="pt-6 border-t">
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmRejectUser}>
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
                                      <span className="font-semibold"> {userToDelete?.name}</span>&apos;s profile and all their lab memberships.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter className="pt-6 border-t">
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => userToDelete && handleDeleteUser(userToDelete.id)}>
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
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={UsersIconLucide}
                      title={activeFilterCount > 0 ? "No Users Match Filters" : "No Users Found"}
                      description={activeFilterCount > 0
                        ? "Try adjusting your filter or search criteria."
                        : (canAddUsers ? "There are currently no user profiles in the system. Add one to get started or new users can sign up." : "There are currently no users matching this criteria.")
                      }
                      action={activeFilterCount > 0 ? (
                        <Button variant="outline" onClick={resetAllActivePageFilters}>
                          <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                        </Button>
                      ) : (
                        !isAdminDataLoading && users.length === 0 && canAddUsers ? (
                          <Button onClick={handleOpenNewUserDialog}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add First User Profile
                          </Button>
                        ) : undefined
                      )}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
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
