
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { AuditLogEntry } from '@/types';
import { formatDateSafe } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { User, Tag, Info, CalendarDays, Hash, Database, Fingerprint } from "lucide-react";
import { Button } from "../ui/button";
import { X } from "lucide-react";

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
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="space-y-2 pr-1">
            <DetailItem icon={CalendarDays} label="Timestamp" value={formatDateSafe(logEntry.timestamp, 'N/A', 'PPP, p')} />
            <DetailItem icon={User} label="User Name" value={logEntry.userName} />
            <DetailItem icon={Fingerprint} label="User ID" value={logEntry.userId} />
            <DetailItem icon={Tag} label="Action" value={logEntry.action} isBadge={true} />
            <DetailItem icon={Database} label="Entity Type" value={logEntry.entityType || 'N/A'} />
            <DetailItem icon={Hash} label="Entity ID" value={logEntry.entityId || 'N/A'} />
            
            <div className="pt-2"> {/* Added padding top for the separator effect */}
                <div className="flex items-start py-1.5 border-t pt-3 mt-1"> {/* Added border-t for separator */}
                    <Info className="mr-3 h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                    <div className="flex-1">
                        <span className="font-medium text-muted-foreground block text-xs">Full Details</span>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words bg-muted/50 p-2 rounded-md mt-0.5">{logEntry.details}</p>
                    </div>
                </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" /> Close
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

