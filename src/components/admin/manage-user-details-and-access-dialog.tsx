
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import type { User, Lab, LabMembership, LabMembershipStatus, RoleName } from '@/types';
import { Loader2, CheckCircle, Ban, PlusCircle, ShieldCheck, ShieldOff, Save, User as UserIcon, Shield, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth-context';
import { cn } from '@/lib/utils';
import { manageLabMembership_SA, addAuditLog } from '@/lib/firestore-helpers';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userRolesList } from '@/lib/app-constants';

const userProfileFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100, "Name cannot exceed 100 characters."),
  email: z.string().email(), // Will be readonly
  role: z.enum(userRolesList as [string, ...string[]], { required_error: 'Please select a role.' }),
});
type UserProfileFormValues = z.infer<typeof userProfileFormSchema>;

interface ManageUserDetailsAndAccessDialogProps {
  targetUser: User | null;
  allLabs: Lab[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void; // Callback to refresh parent data
}

type MembershipDisplayInfo = {
  labId: string;
  labName: string;
  status: LabMembershipStatus | 'not_member';
  membershipDocId?: string;
};

const getStatusBadgeClasses = (status: LabMembershipStatus | 'not_member'): string => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white hover:bg-green-600 border-transparent';
      case 'pending_approval': return 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent';
      case 'rejected':
      case 'revoked':
        return 'bg-red-500 text-white hover:bg-red-600 border-transparent';
      case 'not_member':
      default: return 'bg-gray-500 text-white hover:bg-gray-600 border-transparent';
    }
};


export function ManageUserDetailsAndAccessDialog({
  targetUser,
  allLabs,
  open,
  onOpenChange,
  onUpdate,
}: ManageUserDetailsAndAccessDialogProps) {
  const [activeTab, setActiveTab] = useState('profile');
  const [currentMembershipsInfo, setCurrentMembershipsInfo] = useState<MembershipDisplayInfo[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(false);
  const [isProcessingLabRowAction, setIsProcessingLabRowAction] = useState<Record<string, boolean>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const { toast } = useToast();
  const { currentUser: adminUser } = useAuth();

  const profileForm = useForm<UserProfileFormValues>({
    resolver: zodResolver(userProfileFormSchema),
    defaultValues: { name: '', email: '', role: 'Researcher' },
  });

  const fetchLabMemberships = useCallback(async () => {
    if (!targetUser || activeTab !== 'labs') return;
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
      setCurrentMembershipsInfo(displayInfos);
    } catch (error: any) {
      toast({ title: "Error Loading Memberships", description: `Failed to load lab memberships: ${error.message}`, variant: "destructive" });
      setCurrentMembershipsInfo(allLabs.map(lab => ({ labId: lab.id, labName: lab.name, status: 'not_member' })));
    }
    setIsLoadingMemberships(false);
  }, [targetUser, allLabs, toast, activeTab]);

  useEffect(() => {
    if (open && targetUser) {
      profileForm.reset({
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      });
      if (activeTab === 'labs') {
        fetchLabMemberships();
      } else {
        setCurrentMembershipsInfo([]); // Clear lab memberships if not on labs tab
      }
    }
  }, [open, targetUser, profileForm, activeTab, fetchLabMemberships]);

  const handleProfileSave = async (data: UserProfileFormValues) => {
    if (!adminUser || !targetUser) {
      toast({ title: "Error", description: "User context not available.", variant: "destructive" });
      return;
    }
    setIsSavingProfile(true);
    try {
      const userDocRef = doc(db, "users", targetUser.id);
      await updateDoc(userDocRef, {
        name: data.name,
        role: data.role,
      });
      addAuditLog(adminUser.id, adminUser.name || 'Admin', 'USER_UPDATED', { entityType: 'User', entityId: targetUser.id, details: `User ${data.name} (ID: ${targetUser.id}) profile updated by admin. Role set to ${data.role}.` });
      toast({ title: 'User Profile Updated', description: `Profile for ${data.name} has been updated.` });
      onUpdate(); // Refresh parent list
    } catch (error: any) {
      toast({ title: "Profile Save Error", description: `Could not save profile: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLabAccessAction = async (
    labId: string,
    labName: string,
    currentStatus: MembershipDisplayInfo['status'],
    membershipDocId?: string
  ) => {
    if (!adminUser || !adminUser.id || !adminUser.name || !targetUser) {
      toast({ title: "Error", description: "Admin or target user not defined.", variant: "destructive" });
      return;
    }
    const actionKey = `${labId}-${targetUser.id}`;
    setIsProcessingLabRowAction(prev => ({ ...prev, [actionKey]: true }));
    const actionType = (currentStatus === 'active' || currentStatus === 'pending_approval' || currentStatus === 'revoked') ? 'revoke' : 'grant';
    try {
      const result = await manageLabMembership_SA(
        adminUser.id, adminUser.name,
        targetUser.id, targetUser.name,
        labId, labName, actionType, membershipDocId
      );
      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchLabMemberships(); // Refresh lab memberships within dialog
        onUpdate(); // Refresh parent list
      } else {
        toast({ title: "Action Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Operation failed: ${error.message}`, variant: "destructive" });
    } finally {
      setIsProcessingLabRowAction(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const getStatusBadgeElement = (status: MembershipDisplayInfo['status']) => {
    switch (status) {
      case 'active': return <Badge className={cn(getStatusBadgeClasses(status))}><ShieldCheck className="mr-1 h-3 w-3"/>Member</Badge>;
      case 'pending_approval': return <Badge className={cn(getStatusBadgeClasses(status))}>Pending</Badge>;
      case 'rejected':
      case 'revoked':
        return <Badge className={cn(getStatusBadgeClasses(status))}><Ban className="mr-1 h-3 w-3"/>{status === 'rejected' ? 'Rejected' : 'Revoked'}</Badge>;
      case 'not_member':
      default: return <Badge className={cn(getStatusBadgeClasses(status))}>Not Member</Badge>;
    }
  };

  if (!targetUser) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Settings2 className="mr-2 h-6 w-6 text-primary"/>Manage User: {targetUser.name}</DialogTitle>
          <DialogDescription>Edit user profile details and manage their lab access permissions.</DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Details</TabsTrigger>
            <TabsTrigger value="labs">Lab Access</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="mt-6">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(handleProfileSave)} className="space-y-4">
                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input {...field} disabled={isSavingProfile} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl><Input {...field} readOnly disabled /></FormControl>
                      <FormMessage className="text-xs text-muted-foreground !mt-0.5">Email cannot be changed.</FormMessage>
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={isSavingProfile || targetUser.id === adminUser?.id}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {userRolesList.map((role) => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {targetUser.id === adminUser?.id && <FormMessage className="text-xs text-muted-foreground !mt-0.5">Admin cannot change their own role.</FormMessage>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={isSavingProfile || !profileForm.formState.isDirty}>
                    {isSavingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="labs" className="mt-6">
            {isLoadingMemberships ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading lab access information...</div>
            ) : currentMembershipsInfo.length > 0 ? (
              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader><TableRow><TableHead>Lab Name</TableHead><TableHead>Current Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {currentMembershipsInfo.map(info => (
                      <TableRow key={info.labId}>
                        <TableCell className="font-medium">{info.labName}</TableCell>
                        <TableCell>{getStatusBadgeElement(info.status)}</TableCell>
                        <TableCell className="text-right">
                          {info.status === 'active' || info.status === 'pending_approval' || info.status === 'revoked' ? (
                            <Button variant="destructive" size="sm" className="h-8" onClick={() => handleLabAccessAction(info.labId, info.labName, info.status, info.membershipDocId)} disabled={isProcessingLabRowAction[`${info.labId}-${targetUser.id}`]}>
                              {isProcessingLabRowAction[`${info.labId}-${targetUser.id}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldOff className="mr-2 h-4 w-4"/>}Revoke
                            </Button>
                          ) : (
                            <Button variant="default" size="sm" className="h-8" onClick={() => handleLabAccessAction(info.labId, info.labName, info.status, info.membershipDocId)} disabled={isProcessingLabRowAction[`${info.labId}-${targetUser.id}`]}>
                              {isProcessingLabRowAction[`${info.labId}-${targetUser.id}`] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}Grant
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            ) : (
              <p className="text-center text-muted-foreground py-4">No labs configured in the system.</p>
            )}
          </TabsContent>
        </Tabs>
        {/* Common dialog footer if needed, or handled by individual tabs */}
      </DialogContent>
    </Dialog>
  );
}

    