
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { UserCog, Shield, KeyRound, Image as ImageIcon, Save, Info, LogOut, Loader2, Edit3, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import type { User } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from '@/components/auth-context';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { changePassword_SA } from '@/lib/actions/auth.actions';

export default function ProfilePage() {
  const { currentUser, updateUserProfile, isLoading: authIsLoading, logout } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [editableName, setEditableName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState<string | null>(null);
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);


  useEffect(() => {
    if (currentUser) {
      setEditableName(currentUser.name);
    }
  }, [currentUser]);

  const handleSaveNameChanges = async () => {
    if (!currentUser || !editableName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingName(true);
    try {
      const result = await updateUserProfile({ name: editableName.trim() });
      if (result.success) {
        toast({
          title: "Profile Updated",
          description: "Your name has been successfully updated.",
        });
      } else {
        toast({
          title: "Update Failed",
          description: result.message || "Could not update your profile.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred while updating your profile.",
        variant: "destructive",
      });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordChangeError(null);
    setPasswordChangeSuccess(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordChangeError("All password fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }

    if (!currentUser) return;
    setIsSavingPassword(true);
    try {
      const result = await changePassword_SA({
        callerUserId: currentUser.id,
        currentPassword,
        newPassword,
      });

      if (result.success) {
        setPasswordChangeSuccess("Password changed successfully. Please use your new password next time you log in.");
        toast({ title: "Password Changed", description: "Your password has been updated successfully." });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        setPasswordChangeError(result.message);
      }
    } catch {
      setPasswordChangeError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSavingPassword(false);
    }
  };


  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
    router.push('/login');
  };

  if (authIsLoading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="rounded-lg border border-border p-6 flex items-center gap-4">
          <Skeleton className="h-20 w-20 rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="rounded-lg border border-border p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!currentUser && !authIsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" description="Please log in to view your profile." icon={UserCog} />
        <EmptyState
          icon={Info}
          title="Login Required"
          description="You need to be logged in to view your profile information."
          action={<Button onClick={() => router.push('/login')}>Go to Login</Button>}
        />
      </div>
    );
  }

  if (!currentUser) return null;

  const userInitials = currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information and settings."
        icon={UserCog}
      />
      <TooltipProvider>
        <div className="w-full max-w-2xl mx-auto space-y-4">
          {/* Avatar header section */}
          <div className="rounded-lg border border-border bg-card p-6 flex items-center gap-5">
            <div className="relative group flex-shrink-0">
              <Avatar className="w-20 h-20 border-2 border-border">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback className="text-2xl font-semibold bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold truncate">{currentUser.name}</h2>
              <p className="text-sm text-muted-foreground truncate">{currentUser.email}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />{currentUser.role}
                </Badge>
                <Badge variant={currentUser.status === 'active' ? 'outline' : 'destructive'} className="capitalize text-xs">
                  {currentUser.status}
                </Badge>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>

          {/* Account Information */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-base font-semibold">Account Information</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="profileName">Full Name</Label>
                <Input
                  id="profileName"
                  value={editableName}
                  onChange={(e) => setEditableName(e.target.value)}
                  className="mt-1"
                  disabled={isSavingName}
                />
              </div>
              <div>
                <Label htmlFor="profileEmail">Email Address</Label>
                <Input id="profileEmail" type="email" value={currentUser.email} readOnly disabled className="mt-1 bg-muted/30" />
              </div>
              <Button
                onClick={handleSaveNameChanges}
                disabled={isSavingName || editableName.trim() === currentUser.name || !editableName.trim()}
                size="sm"
              >
                {isSavingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSavingName ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>

          {/* Security */}
          <div className="rounded-lg border border-border bg-card p-6 space-y-4">
            <h3 className="text-base font-semibold">Security</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    disabled={isSavingPassword}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)} disabled={isSavingPassword}>
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    disabled={isSavingPassword}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)} disabled={isSavingPassword}>
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmNewPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Confirm new password"
                    disabled={isSavingPassword}
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} disabled={isSavingPassword}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {passwordChangeError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{passwordChangeError}</AlertDescription>
                </Alert>
              )}
              {passwordChangeSuccess && (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-700 dark:text-green-400">{passwordChangeSuccess}</AlertDescription>
                </Alert>
              )}
              <Button
                onClick={handleChangePassword}
                disabled={isSavingPassword || !currentPassword || !newPassword || !confirmNewPassword}
                size="sm"
              >
                {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                {isSavingPassword ? 'Changing Password...' : 'Change Password'}
              </Button>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
