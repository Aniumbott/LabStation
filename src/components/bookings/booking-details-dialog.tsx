
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Booking } from '@/types';
import { format, isValid, parseISO, isPast } from 'date-fns';
import { Calendar, Clock, User, Info, Tag, StickyNote, Activity, CheckCircle, AlertCircle, XCircle, FileText, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

interface BookingDetailsDialogProps {
  booking: Booking | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <span className="font-medium text-muted-foreground">{label}:</span>
        <p className="text-foreground whitespace-pre-wrap">{value}</p>
      </div>
    </div>
  );
};


export function BookingDetailsDialog({ booking, isOpen, onOpenChange }: BookingDetailsDialogProps) {
  if (!booking) {
    return null;
  }

  const getStatusBadgeClass = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return 'bg-green-500 text-white hover:bg-green-600';
      case 'Pending':
        return 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600';
      case 'Cancelled':
        return 'bg-gray-400 text-white hover:bg-gray-500';
      default:
        return 'bg-slate-500 text-white hover:bg-slate-600';
    }
  };
  
  const getOutcomeIcon = (outcome?: Booking['usageDetails']['outcome']) => {
    switch (outcome) {
      case 'Success': return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />;
      case 'Failure': return <XCircle className="mr-2 h-4 w-4 text-red-500" />;
      case 'Interrupted': return <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />;
      default: return <Info className="mr-2 h-4 w-4 text-muted-foreground" />;
    }
  };

  const isPastBooking = booking.startTime && isPast(new Date(booking.startTime));
  const canLogUsage = isPastBooking && booking.status === 'Confirmed';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Tag className="mr-2 h-6 w-6 text-primary" />
            Booking Details
          </DialogTitle>
          <DialogDescription>
            Full information for your booking of {booking.resourceName}.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="grid gap-3 py-3 text-sm">
          <div className="flex items-center">
            <Info className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground w-28">Resource:</span>
            <span className="text-foreground font-semibold">{booking.resourceName}</span>
          </div>
          <div className="flex items-center">
            <User className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground w-28">Booked By:</span>
            <span className="text-foreground">{booking.userName}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground w-28">Date:</span>
            <span className="text-foreground">{format(new Date(booking.startTime), 'PPP')}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground w-28">Time:</span>
            <span className="text-foreground">
              {format(new Date(booking.startTime), 'p')} - {format(new Date(booking.endTime), 'p')}
            </span>
          </div>
          <div className="flex items-center">
            <Info className="mr-3 h-5 w-5 text-muted-foreground" /> 
            <span className="font-medium text-muted-foreground w-28">Status:</span>
            <Badge className={cn("whitespace-nowrap text-xs px-2 py-0.5 border-transparent", getStatusBadgeClass(booking.status))}>
              {booking.status}
            </Badge>
          </div>
          {booking.notes && (
            <DetailItem icon={StickyNote} label="Notes" value={booking.notes} />
          )}
        </div>

        {booking.usageDetails && (
          <>
            <Separator />
            <div className="py-3">
              <h3 className="text-md font-semibold mb-2 flex items-center">
                <Activity className="mr-2 h-5 w-5 text-primary" /> Usage Details
              </h3>
              <div className="grid gap-3 text-sm pl-2">
                {booking.usageDetails.actualStartTime && (
                  <DetailItem icon={Clock} label="Actual Start" value={format(parseISO(booking.usageDetails.actualStartTime), 'PPP, p')} />
                )}
                {booking.usageDetails.actualEndTime && (
                  <DetailItem icon={Clock} label="Actual End" value={format(parseISO(booking.usageDetails.actualEndTime), 'PPP, p')} />
                )}
                {booking.usageDetails.outcome && (
                   <div className="flex items-center">
                    <div className="mr-3 h-5 w-5 flex items-center justify-center">{getOutcomeIcon(booking.usageDetails.outcome)}</div>
                      <div>
                        <span className="font-medium text-muted-foreground">Outcome:</span>
                        <p className="text-foreground">{booking.usageDetails.outcome}</p>
                      </div>
                  </div>
                )}
                {booking.usageDetails.dataStorageLocation && (
                  <DetailItem icon={FileText} label="Data Location" value={booking.usageDetails.dataStorageLocation} />
                )}
                {booking.usageDetails.usageComments && (
                  <DetailItem icon={StickyNote} label="Usage Comments" value={booking.usageDetails.usageComments} />
                )}
              </div>
            </div>
          </>
        )}
        <Separator />
        <DialogFooter className="pt-4">
          {canLogUsage && (
            <Button variant="secondary" onClick={() => console.log('Log Usage button clicked for booking:', booking.id)}>
              <Edit2 className="mr-2 h-4 w-4" /> Log Usage
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
