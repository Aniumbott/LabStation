
import { PageHeader } from '@/components/layout/page-header';
import { Users as UsersIcon, ShieldAlert, UserCheck, UserCog as UserCogIcon, Edit, Trash2, PlusCircle, Eye } from 'lucide-react';
import type { User } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const mockUsers: User[] = [
  { id: 'u1', name: 'Dr. Admin First', email: 'admin.first@labstation.com', role: 'Admin', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u2', name: 'Dr. Manager Second', email: 'manager.second@labstation.com', role: 'Lab Manager', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u3', name: 'Tech Third', email: 'tech.third@labstation.com', role: 'Technician', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u4', name: 'Researcher Fourth', email: 'researcher.fourth@labstation.com', role: 'Researcher', avatarUrl: 'https://placehold.co/100x100.png', avatarDataAiHint: 'avatar person' },
  { id: 'u5', name: 'Admin Alpha', email: 'admin.alpha@labstation.com', role: 'Admin', avatarDataAiHint: 'avatar person' }, // Avatar will use fallback
];

const roleIcons: Record<User['role'], React.ElementType> = {
  'Admin': ShieldAlert,
  'Lab Manager': UserCogIcon,
  'Technician': UserCheck,
  'Researcher': UserCheck,
};

const roleBadgeVariant: Record<User['role'], "default" | "secondary" | "destructive" | "outline"> = {
    'Admin': 'destructive',
    'Lab Manager': 'default',
    'Technician': 'secondary',
    'Researcher': 'outline',
};


export default function UserManagementPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="User Management"
        description="View, add, and manage user accounts and their roles."
        icon={UsersIcon}
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Link>
          </Button>
        }
      />

      {mockUsers.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockUsers.map((user) => {
                const RoleIcon = roleIcons[user.role] || UsersIcon;
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.name} data-ai-hint={user.avatarDataAiHint} />
                        <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleBadgeVariant[user.role]} className="capitalize">
                         <RoleIcon className="mr-1 h-3.5 w-3.5" />
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" asChild className="h-8 w-8">
                            <Link href={`/admin/users/edit/${user.id}`}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit User</span>
                            </Link>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit User</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete User</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>Delete User</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      ) : (
        <div className="text-center py-10 text-muted-foreground bg-card rounded-lg border shadow-sm">
          <UsersIcon className="mx-auto h-12 w-12 mb-4" />
          <p className="text-lg font-medium">No Users Found</p>
          <p className="text-sm mb-4">There are currently no users in the system.</p>
          <Button asChild>
            <Link href="/admin/users/new">
             <PlusCircle className="mr-2 h-4 w-4" /> Add First User
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

