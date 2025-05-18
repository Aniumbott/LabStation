
import { PageHeader } from '@/components/layout/page-header';
import { UserCog, Shield, Edit3, KeyRound, Image as ImageIcon, Save } from 'lucide-react';
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

// Mock current user data - in a real app, this would come from an auth context
const currentUser: User = {
  id: 'u4',
  name: 'Dr. Researcher Fourth',
  email: 'researcher.fourth@labstation.com',
  role: 'Researcher',
  avatarUrl: 'https://placehold.co/128x128.png',
  avatarDataAiHint: 'avatar person face'
};

export default function ProfilePage() {
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
                <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} data-ai-hint={currentUser.avatarDataAiHint} />
                <AvatarFallback className="text-4xl">{currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
              </Avatar>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-8 w-8">
                      <ImageIcon className="h-4 w-4" />
                      <span className="sr-only">Change Avatar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Change Avatar</p>
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
                  <Input id="profileName" defaultValue={currentUser.name} className="mt-1" />
                </div>
                <div>
                  <Label htmlFor="profileEmail" className="font-medium">Email Address</Label>
                  <div className="flex items-center mt-1">
                    <Input id="profileEmail" type="email" defaultValue={currentUser.email} />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="ml-2 text-muted-foreground hover:text-primary h-8 w-8">
                          <Edit3 className="h-4 w-4" />
                          <span className="sr-only">Edit Email</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Edit Email</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div>
              <h3 className="text-lg font-semibold mb-4 text-primary">Security</h3>
              <Button variant="outline">
                  <KeyRound className="mr-2 h-4 w-4" /> Change Password
              </Button>
            </div>
          </CardContent>
          <Separator />
          <CardFooter className="p-6 justify-end">
            <Button>
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </CardFooter>
        </Card>
      </TooltipProvider>
    </div>
  );
}
