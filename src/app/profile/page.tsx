
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { UserCog, Shield, KeyRound, Image as ImageIcon, Save, Info, LogOut, Loader2, Edit3, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import type { User } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while updating your profile.",
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

    setIsSavingPassword(true);
    await new Promise(resolve => setTimeout(resolve, 1000));


    setIsSavingPassword(false);
    setPasswordChangeSuccess("Password changed successfully (mock). Please use your new password next time you log in.");
    toast({
      title: "Password Changed (Mock)",
      description: "Your password has been 'changed'. This is a mock and does not affect your actual login.",
    });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };


  const handleLogout = async () => {
    await logout();
    toast({ title: "Logged Out", description: "You have been successfully logged out." });
    router.push('/login');
  };

  if (authIsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3">Loading profile...</p>
      </div>
    );
  }

  if (!currentUser && !authIsLoading) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="My Profile"
          description="Please log in to view your profile."
          icon={UserCog}
        />
        <Card className="max-w-2xl mx-auto shadow-lg text-center py-10">
          <CardContent>
            <Info className="mx-auto h-12 w-12 mb-4 text-muted-foreground opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">Login Required</p>
            <p className="text-sm text-muted-foreground mb-4">
              You need to be logged in to view your profile information.
            </p>
            <Button onClick={() => router.push('/login')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information and settings."
        icon={UserCog}
      />
      <TooltipProvider>
        <Card className="w-full max-w-2xl mx-auto shadow-lg">
          <CardHeader className="items-center text-center p-6">
            <div className="relative group mb-4">
              <Avatar className="w-32 h-32 mx-auto border-4 border-primary/20 shadow-md group-hover:opacity-80 transition-opacity">
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />
                <AvatarFallback className="text-4xl">{currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8 cursor-not-allowed" disabled>
                    <ImageIcon className="h-4 w-4" />
                    <span className="sr-only">Change Avatar (Coming Soon)</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Change Avatar (Coming Soon)</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <CardTitle className="text-2xl">{currentUser.name}</CardTitle>
            <CardDescription className="flex items-center justify-center gap-1 text-base">
              <Shield className="h-4 w-4 text-muted-foreground" /> {currentUser.role}
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-6 p-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-primary">Account Information</h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="profileName" className="font-medium">Full Name</Label>
                  <Input
                    id="profileName"
                    value={editableName}
                    onChange={(e) => setEditableName(e.target.value)}
                    className="mt-1"
                    disabled={isSavingName}
                  />
                </div>
                 <Button onClick={handleSaveNameChanges} disabled={isSavingName || (currentUser && editableName.trim() === currentUser.name) || !editableName.trim()} className="w-full sm:w-auto mt-2">
                    {isSavingName ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isSavingName ? 'Saving Name...' : 'Save Name Changes'}
                 </Button>
                <div>
                  <Label htmlFor="profileEmail" className="font-medium">Email Address</Label>
                  <div className="flex items-center mt-1">
                    <Input id="profileEmail" type="email" value={currentUser.email} readOnly className="bg-muted/10 flex-grow" />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-semibold mb-4 text-primary">Security</h3>
              <div className="space-y-4">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      disabled={isSavingPassword}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showCurrentPassword ? "Hide" : "Show"} current password</span>
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
                      placeholder="Enter new password (min. 6 characters)"
                      disabled={isSavingPassword}
                    />
                     <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={isSavingPassword}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showNewPassword ? "Hide" : "Show"} new password</span>
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
                     <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isSavingPassword}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showConfirmPassword ? "Hide" : "Show"} confirm password</span>
                    </Button>
                  </div>
                </div>
                {passwordChangeError && (
                  <Alert variant="destructive" className="mt-2">
                     <AlertCircle className="h-4 w-4" />
                     <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{passwordChangeError}</AlertDescription>
                  </Alert>
                )}
                {passwordChangeSuccess && (
                  <Alert variant="default" className="mt-2 bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertTitle className="text-green-700 dark:text-green-300">Success</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-400">{passwordChangeSuccess}</AlertDescription>
                  </Alert>
                )}
                <Button onClick={handleChangePassword} disabled={isSavingPassword || !currentPassword || !newPassword || !confirmNewPassword} className="w-full sm:w-auto">
                  {isSavingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  {isSavingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="p-6 flex justify-start">
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </CardFooter>
        </Card>
      </TooltipProvider>
    </div>
  );
}
