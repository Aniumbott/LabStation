import { PageHeader } from '@/components/layout/page-header';
import { UserCog, Mail, Shield, Edit3, KeyRound, Image as ImageIcon } from 'lucide-react';
import type { User } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

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

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader className="text-center">
          <Avatar className="w-32 h-32 mx-auto mb-4 border-4 border-primary/20 shadow-md">
            <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} data-ai-hint={currentUser.avatarDataAiHint} />
            <AvatarFallback className="text-4xl">{currentUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
          </Avatar>
          <Button variant="outline" size="sm" className="mx-auto">
            <ImageIcon className="mr-2 h-4 w-4" /> Change Avatar
          </Button>
          <CardTitle className="text-2xl mt-4">{currentUser.name}</CardTitle>
          <CardDescription className="flex items-center justify-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" /> {currentUser.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div>
            <h3 className="text-lg font-semibold mb-3">Account Information</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="profileName" className="text-muted-foreground">Full Name</Label>
                <Input id="profileName" defaultValue={currentUser.name} readOnly className="mt-1 bg-muted/30"/>
              </div>
              <div>
                <Label htmlFor="profileEmail" className="text-muted-foreground">Email Address</Label>
                <div className="flex items-center mt-1">
                  <Input id="profileEmail" type="email" defaultValue={currentUser.email} readOnly className="bg-muted/30"/>
                  <Button variant="ghost" size="sm" className="ml-2">
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <Separator />
           <div>
            <h3 className="text-lg font-semibold mb-3">Security</h3>
             <Button variant="outline">
                <KeyRound className="mr-2 h-4 w-4" /> Change Password
             </Button>
           </div>
        </CardContent>
        <CardFooter className="p-6 border-t">
          <Button className="w-full sm:w-auto ml-auto">Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
