
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { UserCheck2, CheckCircle, XCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { User } from '@/types';
import { pendingSignups, mockApproveSignup, mockRejectSignup } from '@/lib/mock-data';
import { useAuth } from '@/components/auth-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation'; // For redirecting if not admin

export default function SignupRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const router = useRouter();

  const [currentPendingSignups, setCurrentPendingSignups] = useState<User[]>([]);
  const [userToReject, setUserToReject] = useState<User | null>(null);

  useEffect(() => {
    // In a real app, fetch pending signups. For now, use a copy of the mock data.
    setCurrentPendingSignups(JSON.parse(JSON.stringify(pendingSignups)));
  }, []);

  // Redirect if not admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'Admin') {
      router.push('/dashboard'); // Or a dedicated "Access Denied" page
    }
  }, [currentUser, router]);

  if (!currentUser || currentUser.role !== 'Admin') {
    // You can return a loader or null while redirecting or if auth is still loading
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading or checking permissions...</p>
      </div>
    );
  }


  const handleApproveSignupRequest = (userId: string) => {
    const userToApprove = currentPendingSignups.find(u => u.id === userId);
    if (mockApproveSignup(userId)) {
      setCurrentPendingSignups(prev => prev.filter(u => u.id !== userId));
      toast({
        title: 'Signup Approved',
        description: `User ${userToApprove?.name || 'Unknown'} has been approved and can now log in.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to approve signup request.',
        variant: 'destructive',
      });
    }
  };

  const handleConfirmRejectSignup = (userId: string) => {
    const userToRejectDetails = currentPendingSignups.find(u => u.id === userId);
    if (mockRejectSignup(userId)) {
      setCurrentPendingSignups(prev => prev.filter(u => u.id !== userId));
      toast({
        title: 'Signup Rejected',
        description: `Signup request for ${userToRejectDetails?.name || 'Unknown'} has been rejected.`,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to reject signup request.',
        variant: 'destructive',
      });
    }
    setUserToReject(null);
  };

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Signup Requests"
          description="Review and manage pending user signup requests."
          icon={UserCheck2}
        />

        {currentPendingSignups.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending Signups ({currentPendingSignups.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-right w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPendingSignups.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => handleApproveSignupRequest(user.id)}
                              >
                                <ThumbsUp className="mr-1.5 h-3.5 w-3.5 text-green-600" /> Approve
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve Signup</p></TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" className="h-8" onClick={() => setUserToReject(user)}>
                                    <ThumbsDown className="mr-1.5 h-3.5 w-3.5" /> Reject
                                  </Button>
                                </AlertDialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent><p>Reject Signup</p></TooltipContent>
                            </Tooltip>
                            {userToReject && userToReject.id === user.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure you want to reject this signup?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will reject the signup request for
                                    <span className="font-semibold"> {userToReject.name} ({userToReject.email})</span>.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setUserToReject(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction variant="destructive" onClick={() => handleConfirmRejectSignup(userToReject.id)}>
                                    Confirm Reject
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
            <CardContent>
              <UserCheck2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No Pending Signup Requests</p>
              <p className="text-sm">There are currently no new users awaiting approval.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
