
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AuditLogEntry } from '@/types';
import { formatDateSafe } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, Tag, Info, CalendarDays, Hash, Database, Fingerprint, X } from "lucide-react";

interface AuditLogDetailsDialogProps {
  logEntry: AuditLogEntry | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DetailItem = ({ icon: Icon, label, value, isBadge = false, badgeVariant = "outline" }: { icon: React.ElementType, label: string, value?: string | null, isBadge?: boolean, badgeVariant?: any }) => {
  if (value === undefined || value === null || value.trim() === '') return null;
  return (
    <div className="flex items-start py-1.5">
      <Icon className="mr-3 h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
      <div className="flex-1">
        <span className="font-medium text-muted-foreground block text-xs">{label}</span>
        {isBadge ? (
          <Badge variant={badgeVariant} className="mt-0.5 text-sm">{value.replace(/_/g, ' ')}</Badge>
        ) : (
          <p className="text-sm text-foreground break-words">{value}</p>
        )}
      </div>
    </div>
  );
};

export function AuditLogDetailsDialog({ logEntry, isOpen, onOpenChange }: AuditLogDetailsDialogProps) {
  if (!logEntry) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Info className="mr-2 h-6 w-6 text-primary" />
            Audit Log Details
          </DialogTitle>
          <DialogDescription>
            Detailed information for the selected log entry.
          </DialogDescription>
        </DialogHeader>
        <Separator className="my-3"/>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="grid gap-2 text-sm py-2">
            <DetailItem icon={CalendarDays} label="Timestamp" value={formatDateSafe(logEntry.timestamp, 'N/A', 'PPP, p')} />
            <DetailItem icon={User} label="User Name" value={logEntry.userName} />
            <DetailItem icon={Fingerprint} label="User ID" value={logEntry.userId} />
            <DetailItem icon={Tag} label="Action" value={logEntry.action} isBadge={true} />
            <DetailItem icon={Database} label="Entity Type" value={logEntry.entityType || 'N/A'} />
            <DetailItem icon={Hash} label="Entity ID" value={logEntry.entityId || 'N/A'} />
            <Separator className="my-2" />
            <div className="flex items-start py-1.5">
                <Info className="mr-3 h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                <div className="flex-1">
                    <span className="font-medium text-muted-foreground block text-xs">Full Details</span>
                    <p className="text-sm text-foreground whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md mt-0.5">{logEntry.details}</p>
                </div>
            </div>
          </div>
        </ScrollArea>
        <Separator className="my-3"/>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
