
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
import { Loader2, X, CheckCircle, Ban, PlusCircle, ShieldCheck, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase'; // Client-side Firestore
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-context';
import { manageLabMembership_SA } from '@/lib/firestore-helpers'; // Server action

interface ManageUserLabAccessDialogProps {
  targetUser: User | null;
  allLabs: Lab[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMembershipUpdate: () => void; // Callback to refresh user list or data
}

type MembershipDisplayInfo = {
  labId: string;
  labName: string;
  status: LabMembershipStatus | 'not_member';
  membershipDocId?: string;
};

export function ManageUserLabAccessDialog({ targetUser, allLabs, open, onOpenChange, onMembershipUpdate }: ManageUserLabAccessDialogProps) {
  const [membershipsInfo, setMembershipsInfo] = useState<MembershipDisplayInfo[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({}); // labId -> boolean
  const { toast } = useToast();
  const { currentUser: adminUser } = useAuth();

  const fetchUserMemberships = useCallback(async () => {
    if (!targetUser || !open) {
      setMembershipsInfo([]);
      return;
    }
    setIsLoadingMemberships(true);
    try {
      const q = query(collection(db, 'labMemberships'), where('userId', '==', targetUser.id));
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
      setMembershipsInfo(displayInfos);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to load lab memberships: ${error.message}`, variant: "destructive" });
      setMembershipsInfo(allLabs.map(lab => ({ labId: lab.id, labName: lab.name, status: 'not_member' })));
    }
    setIsLoadingMemberships(false);
  }, [targetUser, allLabs, open, toast]);

  useEffect(() => {
    if (open && targetUser) {
      fetchUserMemberships();
    }
  }, [open, targetUser, fetchUserMemberships]);

  const handleMembershipAction = async (labId: string, labName: string, currentStatus: MembershipDisplayInfo['status']) => {
    if (!adminUser || !targetUser) {
      toast({ title: "Error", description: "Admin or target user not defined.", variant: "destructive" });
      return;
    }

    setIsUpdating(prev => ({ ...prev, [labId]: true }));
    const action = (currentStatus === 'active' || currentStatus === 'pending_approval' || currentStatus === 'revoked') ? 'revoke' : 'grant';
    
    try {
      const result = await manageLabMembership_SA(
        adminUser.id,
        adminUser.name,
        targetUser.id,
        targetUser.name,
        labId,
        labName,
        action
      );

      if (result.success) {
        toast({ title: "Success", description: result.message });
        await fetchUserMemberships(); // Refresh the list
        onMembershipUpdate(); // Notify parent to refresh users list potentially
      } else {
        toast({ title: "Failed", description: result.message || "Could not update membership.", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Operation failed: ${error.message}`, variant: "destructive" });
    } finally {
      setIsUpdating(prev => ({ ...prev, [labId]: false }));
    }
  };

  const getStatusBadge = (status: MembershipDisplayInfo['status']) => {
    switch (status) {
      case 'active': return <Badge variant="default" className="bg-green-500 text-white"><ShieldCheck className="mr-1 h-3 w-3"/>Member</Badge>;
      case 'pending_approval': return <Badge variant="secondary">Pending</Badge>;
      case 'rejected':
      case 'revoked':
        return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3"/>{status === 'rejected' ? 'Rejected' : 'Revoked'}</Badge>;
      case 'not_member': return <Badge variant="outline">Not Member</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Lab Access for {targetUser.name}</DialogTitle>
          <DialogDescription>Grant or revoke access to labs for this user.</DialogDescription>
        </DialogHeader>
        {isLoadingMemberships ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading lab memberships...</div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lab Name</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {membershipsInfo.map(info => (
                  <TableRow key={info.labId}>
                    <TableCell className="font-medium">{info.labName}</TableCell>
                    <TableCell>{getStatusBadge(info.status)}</TableCell>
                    <TableCell className="text-right">
                      {info.status === 'active' || info.status === 'pending_approval' || info.status === 'revoked' ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleMembershipAction(info.labId, info.labName, info.status)}
                          disabled={isUpdating[info.labId]}
                        >
                          {isUpdating[info.labId] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                          Revoke
                        </Button>
                      ) : ( // 'not_member' or 'rejected'
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleMembershipAction(info.labId, info.labName, info.status)}
                          disabled={isUpdating[info.labId]}
                        >
                          {isUpdating[info.labId] ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                          Grant Access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             {membershipsInfo.length === 0 && <p className="text-center text-muted-foreground py-4">No labs configured in the system.</p>}
          </ScrollArea>
        )}
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

