
'use client';

import { PageHeader } from '@/components/layout/page-header';
import { UserCog, Shield, Edit3, KeyRound, Image as ImageIcon, Save, Info, LogOut, Loader2 } from 'lucide-react'; // Added LogOut, Loader2
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

export default function ProfilePage() {
  const { currentUser, updateUserProfile, isLoading: authIsLoading, logout } = useAuth(); // Added logout
  const router = useRouter();
  const { toast } = useToast();

  const [editableName, setEditableName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setEditableName(currentUser.name);
    }
  }, [currentUser]);

  const handleSaveChanges = async () => {
    if (!currentUser || !editableName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
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
    setIsSaving(false);
  };

  const handleLogout = () => {
    logout();
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
  
  if (!currentUser) return null; // Should be caught by above, but good for type safety

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Profile"
        description="View and manage your personal information and settings."
        icon={UserCog}
      />
      <TooltipProvider>
        <Card className="max-w-2xl mx-auto shadow-lg">
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
                  />
                </div>
                <div>
                  <Label htmlFor="profileEmail" className="font-medium">Email Address</Label>
                  <div className="flex items-center mt-1">
                    <Input id="profileEmail" type="email" value={currentUser.email} readOnly className="bg-muted/10" />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-primary h-8 w-8 cursor-not-allowed opacity-50" disabled>
                          <Edit3 className="h-4 w-4" />
                          <span className="sr-only">Edit Email (Coming Soon)</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit Email (Coming Soon)</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                   <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed currently.</p>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-4 text-primary">Security</h3>
              <Button variant="outline" disabled>
                  <KeyRound className="mr-2 h-4 w-4" /> Change Password (Coming Soon)
              </Button>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="p-6 flex justify-between items-center"> {/* Changed to flex justify-between */}
            <Button variant="destructive" onClick={handleLogout}> {/* Added Logout Button */}
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
            <Button onClick={handleSaveChanges} disabled={isSaving || editableName.trim() === currentUser.name}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardFooter>
        </Card>
      </TooltipProvider>
    </div>
  );
}
