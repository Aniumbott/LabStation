
'use client';

import type { FC } from 'react';
import { User as UserIconLucide, Info as InfoIcon, ActivitySquare, UserPlus2, ThumbsUp, ThumbsDown, ShieldOff, PlusCircle, Loader2, Users2 } from 'lucide-react';
import type { Lab, User, LabMembership, LabMembershipStatus } from '@/types';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from '@/components/ui/badge';
import { formatDateSafe, cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

interface LabMembershipDisplay extends LabMembership {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
}

const getLabMembershipStatusBadgeClasses = (status: LabMembershipStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white hover:bg-green-600 border-transparent';
      case 'pending_approval': return 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent';
      case 'rejected':
      case 'revoked':
        return 'bg-red-500 text-white hover:bg-red-600 border-transparent';
      default: return 'bg-gray-500 text-white hover:bg-gray-600 border-transparent';
    }
};

interface LabSpecificMembersTabProps {
  selectedLabDetails: Lab;
  isLoadingData: boolean;
  labSpecificMembershipsDisplay: LabMembershipDisplay[];
  canManageAny: boolean;
  setIsLabSpecificMemberAddDialogOpen: (isOpen: boolean) => void;
  handleMembershipAction: (
    targetUserId: string, targetUserName: string, labId: string, labName: string,
    action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
    membershipDocIdToUpdate?: string
  ) => void;
  isProcessingLabAccessAction: Record<string, boolean>;
}

export const LabSpecificMembersTab: FC<LabSpecificMembersTabProps> = ({
  selectedLabDetails, isLoadingData, labSpecificMembershipsDisplay, canManageAny,
  setIsLabSpecificMemberAddDialogOpen, handleMembershipAction, isProcessingLabAccessAction
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle>{selectedLabDetails.name} - Members & Access</CardTitle>
          <CardDescription>Manage user access and view members of this lab.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setIsLabSpecificMemberAddDialogOpen(true)} disabled={!canManageAny}>
          <UserPlus2 className="mr-2 h-4 w-4"/> Add
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoadingData && labSpecificMembershipsDisplay.length === 0 ? (
            <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Loading lab members...</div>
        ) : labSpecificMembershipsDisplay.length > 0 ? (
            <div className="overflow-x-auto border rounded-b-md">
                <TooltipProvider>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead><div className="flex items-center gap-1"><UserIconLucide className="h-4 w-4 text-muted-foreground"/>User</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><InfoIcon className="h-4 w-4 text-muted-foreground"/>Status in Lab</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><ActivitySquare className="h-4 w-4 text-muted-foreground"/>Last Activity</div></TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {labSpecificMembershipsDisplay.map(member => (
                            <TableRow key={member.id || member.userId}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={member.userAvatarUrl} alt={member.userName} data-ai-hint="user avatar"/>
                                            <AvatarFallback>{member.userName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <div className="font-medium">{member.userName}</div>
                                            <div className="text-xs text-muted-foreground">{member.userEmail}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge className={cn("capitalize", getLabMembershipStatusBadgeClasses(member.status))}>
                                        {member.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell>{formatDateSafe(member.updatedAt ? (member.updatedAt as Timestamp).toDate() : (member.requestedAt as Timestamp)?.toDate(), 'N/A', 'PPP p')}</TableCell>
                                <TableCell className="text-right space-x-1">
                                    {member.status === 'pending_approval' && (
                                        <>
                                            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'approve_request', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ThumbsUp className="h-4 w-4 text-green-600"/></Button></TooltipTrigger><TooltipContent>Approve Request</TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'reject_request', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ThumbsDown className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Reject Request</TooltipContent></Tooltip>
                                        </>
                                    )}
                                    {member.status === 'active' && (
                                        <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'revoke', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ShieldOff className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Revoke Access</TooltipContent></Tooltip>
                                    )}
                                    {(member.status === 'rejected' || member.status === 'revoked') && (
                                            <Tooltip><TooltipTrigger asChild><Button variant="default" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'grant', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><PlusCircle className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Re-Grant Access</TooltipContent></Tooltip>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                </TooltipProvider>
            </div>
        ) : (
                <div className="text-center py-10 text-muted-foreground">
                <Users2 className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                <p className="font-medium">No members or pending requests for {selectedLabDetails.name}.</p>
            </div>
        )}
        </CardContent>
    </Card>
  );
};
