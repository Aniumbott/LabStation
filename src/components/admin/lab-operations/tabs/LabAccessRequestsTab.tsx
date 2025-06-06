
'use client';

import type { FC } from 'react';
import { UsersRound, User as UserIconLucide, Building, CalendarClock, ThumbsUp, ThumbsDown, Loader2, Users } from 'lucide-react';
import type { LabMembership, User } from '@/types';
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateSafe } from '@/lib/utils';

interface LabMembershipRequest extends LabMembership {
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  labName?: string;
}

interface LabAccessRequestsTabProps {
  isLabAccessRequestLoading: boolean;
  allLabAccessRequests: LabMembershipRequest[];
  handleMembershipAction: (
    targetUserId: string, targetUserName: string, labId: string, labName: string,
    action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
    membershipDocIdToUpdate?: string
  ) => void;
  isProcessingLabAccessAction: Record<string, boolean>;
}

export const LabAccessRequestsTab: FC<LabAccessRequestsTabProps> = ({
  isLabAccessRequestLoading, allLabAccessRequests, handleMembershipAction, isProcessingLabAccessAction
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-muted-foreground"/>System-Wide Lab Access Requests</div></CardTitle>
        <CardDescription>Review and manage pending requests for lab access from all users for all labs.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLabAccessRequestLoading ? (
          <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
        ) : allLabAccessRequests.length > 0 ? (
          <div className="overflow-x-auto rounded-b-md border">
            <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><div className="flex items-center gap-1"><UserIconLucide className="h-4 w-4 text-muted-foreground"/>User</div></TableHead>
                  <TableHead><div className="flex items-center gap-1"><Building className="h-4 w-4 text-muted-foreground"/>Lab Requested</div></TableHead>
                  <TableHead><div className="flex items-center gap-1"><CalendarClock className="h-4 w-4 text-muted-foreground"/>Date Requested</div></TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLabAccessRequests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={req.userAvatarUrl} alt={req.userName} data-ai-hint="user avatar"/>
                          <AvatarFallback>{(req.userName || 'U').charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{req.userName}</div>
                          <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{req.labName}</TableCell>
                    <TableCell>{req.requestedAt ? formatDateSafe(req.requestedAt, 'N/A', 'PPP p') : 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'approve_request', req.id)} disabled={isProcessingLabAccessAction[req.id!]}>
                                {isProcessingLabAccessAction[req.id!] ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className="h-4 w-4 text-green-600" />}
                                <span className="sr-only">Approve Request</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Approve Request</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'reject_request', req.id)} disabled={isProcessingLabAccessAction[req.id!]}>
                                {isProcessingLabAccessAction[req.id!] ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className="h-4 w-4" />}
                                <span className="sr-only">Reject Request</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Reject Request</p></TooltipContent>
                        </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </TooltipProvider>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50"/>
            <p className="font-medium">No pending lab access requests system-wide.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
