
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { User, Lab, LabMembership, LabMembershipStatus } from '@/types';
import { Loader2, X, CheckCircle, Ban, PlusCircle, ShieldCheck, ShieldOff, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useAuth } from '@/components/auth-context';
import { manageLabMembership_SA } from '@/lib/firestore-helpers';
import { Input } from '@/components/ui/input'; // For user search

interface ManageUserLabAccessDialogProps {
  targetUser: User | null; // Null when in "Add Member Manually" mode
  allLabs: Lab[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembershipUpdate: () => void;
  preselectedLabId?: string; // Used in "Add Member Manually" mode
}

type MembershipDisplayInfo = {
  labId: string;
  labName: string;
  status: LabMembershipStatus | 'not_member';
  membershipDocId?: string;
};

export function ManageUserLabAccessDialog({ targetUser: initialTargetUser, allLabs, open, onOpenChange, onMembershipUpdate, preselectedLabId }: ManageUserLabAccessDialogProps) {
  const [currentMembershipsInfo, setCurrentMembershipsInfo] = useState<MembershipDisplayInfo[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { currentUser: adminUser } = useAuth();

  // For "Add Member Manually" mode
  const [isAddManuallyMode, setIsAddManuallyMode] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [allUsersForSearch, setAllUsersForSearch] = useState<User[]>([]);
  const [filteredUsersForSearch, setFilteredUsersForSearch] = useState<User[]>([]);
  const [selectedUserForManualAdd, setSelectedUserForManualAdd] = useState<User | null>(null);


  const fetchInitialData = useCallback(async () => {
    if (!open) return;

    setIsAddManuallyMode(!initialTargetUser && !!preselectedLabId);
    setSelectedUserForManualAdd(null); // Reset selected user if mode changes
    setUserSearchTerm(''); // Reset search term

    if (initialTargetUser) { // Existing user management mode
      setIsLoadingMemberships(true);
      try {
        const q = query(collection(db, 'labMemberships'), where('userId', '==', initialTargetUser.id));
        const querySnapshot = await getDocs(q);
        const userMemberships = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabMembership));

        const displayInfos = allLabs.map(lab => {
          const membership = userMemberships.find(m => m.labId === lab.id);
          return {
            labId: lab.id,
            labName: lab.name,
            status: membership ? membership.status : 'not_member',
            membershipDocId: membership?.id,
          };
        });
        setCurrentMembershipsInfo(displayInfos);
      } catch (error: any) {
        toast({ title: "Error", description: `Failed to load memberships: ${error.message}`, variant: "destructive" });
        setCurrentMembershipsInfo(allLabs.map(lab => ({ labId: lab.id, labName: lab.name, status: 'not_member' })));
      }
      setIsLoadingMemberships(false);
    } else if (preselectedLabId) { // "Add Member Manually" mode
        // Fetch all users for search dropdown
        setIsLoadingMemberships(true); // Re-use loading state for fetching users
        try {
            const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("name")));
            const users = usersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as User))
                                         .filter(u => u.status === 'active'); // Only show active users
            setAllUsersForSearch(users);
            setFilteredUsersForSearch(users); // Initially show all active users
        } catch (error: any) {
            toast({ title: "Error", description: `Failed to load users for search: ${error.message}`, variant: "destructive" });
            setAllUsersForSearch([]);
            setFilteredUsersForSearch([]);
        }
        setIsLoadingMemberships(false);
    }
  }, [initialTargetUser, allLabs, open, toast, preselectedLabId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  
  useEffect(() => {
    if (isAddManuallyMode) {
      if (userSearchTerm.trim() === '') {
        setFilteredUsersForSearch(allUsersForSearch);
      } else {
        setFilteredUsersForSearch(
          allUsersForSearch.filter(user =>
            user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(userSearchTerm.toLowerCase())
          )
        );
      }
    }
  }, [userSearchTerm, allUsersForSearch, isAddManuallyMode]);


  const handleMembershipAction = async (
    labId: string,
    labName: string,
    currentStatus: MembershipDisplayInfo['status'],
    targetUserForAction: User // Can be initialTargetUser or selectedUserForManualAdd
  ) => {
    if (!adminUser || !targetUserForAction) {
      toast({ title: "Error", description: "Admin or target user not defined.", variant: "destructive" });
      return;
    }

    const actionKey = `${labId}-${targetUserForAction.id}`;
    setIsProcessingAction(prev => ({ ...prev, [actionKey]: true }));
    
    const actionType = (currentStatus === 'active' || currentStatus === 'pending_approval' || currentStatus === 'revoked') ? 'revoke' : 'grant';
    
    try {
      const result = await manageLabMembership_SA(
        adminUser.id, adminUser.name,
        targetUserForAction.id, targetUserForAction.name,
        labId, labName, actionType,
        currentMembershipsInfo.find(info => info.labId === labId && info.status !== 'not_member')?.membershipDocId
      );

      if (result.success) {
        toast({ title: "Success", description: result.message });
        if (!isAddManuallyMode) { // If managing existing user, refresh their specific memberships
            await fetchInitialData(); 
        }
        onMembershipUpdate();
        if (isAddManuallyMode) { // If successfully added manually, close dialog
            onOpenChange(false);
        }
      } else {
        toast({ title: "Failed", description: result.message || "Could not update membership.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Operation failed: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingAction(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleGrantAccessToSelectedUser = () => {
    if (selectedUserForManualAdd && preselectedLabId) {
        const lab = allLabs.find(l => l.id === preselectedLabId);
        if (lab) {
            handleMembershipAction(preselectedLabId, lab.name, 'not_member', selectedUserForManualAdd);
        } else {
            toast({title: "Error", description: "Target lab not found.", variant: "destructive"});
        }
    } else {
        toast({title: "Error", description: "No user selected or lab context missing.", variant: "destructive"});
    }
  };


  const getStatusBadge = (status: MembershipDisplayInfo['status']) => {
    switch (status) {
      case 'active': return <Badge variant="default" className="bg-green-500 text-white"><ShieldCheck className="mr-1 h-3 w-3"/>Member</Badge>;
      case 'pending_approval': return <Badge variant="secondary">Pending</Badge>;
      case 'rejected': case 'revoked': return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3"/>{status === 'rejected' ? 'Rejected' : 'Revoked'}</Badge>;
      case 'not_member': return <Badge variant="outline">Not Member</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  const dialogTitle = isAddManuallyMode
    ? `Add Member to ${allLabs.find(l => l.id === preselectedLabId)?.name || 'Lab'}`
    : `Manage Lab Access for ${initialTargetUser?.name || ''}`;
  
  const dialogDescription = isAddManuallyMode
    ? "Search for a user and grant them access to the selected lab."
    : "Grant or revoke access to labs for this user.";


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", isAddManuallyMode && "sm:max-w-xl")}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {isLoadingMemberships ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading data...</div>
        ) : isAddManuallyMode ? (
            <div className="space-y-4">
                <div className="relative">
                     <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input 
                        placeholder="Search users by name or email..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="pl-8 h-9"
                    />
                </div>
                {filteredUsersForSearch.length > 0 ? (
                     <ScrollArea className="max-h-[40vh] border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {filteredUsersForSearch.map(user => (
                                    <TableRow 
                                        key={user.id} 
                                        onClick={() => setSelectedUserForManualAdd(user)}
                                        className={cn("cursor-pointer", selectedUserForManualAdd?.id === user.id && "bg-muted/50")}
                                    >
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell className="text-right">
                                            <Button 
                                                size="sm" 
                                                variant={selectedUserForManualAdd?.id === user.id ? "default" : "outline"}
                                                onClick={(e) => { e.stopPropagation(); setSelectedUserForManualAdd(user); }}
                                                className="h-8"
                                            >
                                                {selectedUserForManualAdd?.id === user.id ? <CheckCircle className="mr-2 h-4 w-4"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                                                {selectedUserForManualAdd?.id === user.id ? "Selected" : "Select"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                ) : (
                    <p className="text-center text-muted-foreground py-4">No users found matching "{userSearchTerm}".</p>
                )}
            </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <Table>
              <TableHeader><TableRow><TableHead>Lab Name</TableHead><TableHead>Current Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
              <TableBody>
                {currentMembershipsInfo.map(info => (
                  <TableRow key={info.labId}>
                    <TableCell className="font-medium">{info.labName}</TableCell>
                    <TableCell>{getStatusBadge(info.status)}</TableCell>
                    <TableCell className="text-right">
                      {info.status === 'active' || info.status === 'pending_approval' || info.status === 'revoked' ? (
                        <Button variant="destructive" size="sm" className="h-8" onClick={() => handleMembershipAction(info.labId, info.labName, info.status, initialTargetUser!)} disabled={isProcessingAction[`${info.labId}-${initialTargetUser!.id}`]}>
                          {isProcessingAction[`${info.labId}-${initialTargetUser!.id}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldOff className="mr-2 h-4 w-4"/>}Revoke
                        </Button>
                      ) : (
                        <Button variant="default" size="sm" className="h-8" onClick={() => handleMembershipAction(info.labId, info.labName, info.status, initialTargetUser!)} disabled={isProcessingAction[`${info.labId}-${initialTargetUser!.id}`]}>
                          {isProcessingAction[`${info.labId}-${initialTargetUser!.id}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}Grant Access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {currentMembershipsInfo.length === 0 && <p className="text-center text-muted-foreground py-4">No labs configured in the system.</p>}
          </ScrollArea>
        )}
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
          {isAddManuallyMode && (
            <Button 
                onClick={handleGrantAccessToSelectedUser}
                disabled={!selectedUserForManualAdd || isProcessingAction[`${preselectedLabId}-${selectedUserForManualAdd?.id}`]}
            >
                {isProcessingAction[`${preselectedLabId}-${selectedUserForManualAdd?.id}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                Grant Access to Selected User
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
