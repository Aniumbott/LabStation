
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
import { format } from 'date-fns';
import { Calendar, Clock, User, Info, Tag, Edit3, X, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BookingDetailsDialogProps {
  booking: Booking | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Info className="mr-2 h-6 w-6 text-primary" />
            Booking Details
          </DialogTitle>
          <DialogDescription>
            Full information for your booking of {booking.resourceName}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 text-sm">
          <div className="flex items-center">
            <Tag className="mr-3 h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-muted-foreground w-28">Resource:</span>
            <span className="text-foreground">{booking.resourceName}</span>
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
            <Info className="mr-3 h-5 w-5 text-muted-foreground" /> {/* Re-using Info for status icon consistency */}
            <span className="font-medium text-muted-foreground w-28">Status:</span>
            <Badge className={cn("whitespace-nowrap text-xs px-2 py-0.5 border-transparent", getStatusBadgeClass(booking.status))}>
              {booking.status}
            </Badge>
          </div>
          {booking.notes && (
            <div className="flex items-start">
              <StickyNote className="mr-3 h-5 w-5 text-muted-foreground mt-0.5" />
              <span className="font-medium text-muted-foreground w-28">Notes:</span>
              <p className="text-foreground whitespace-pre-wrap flex-1">{booking.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
