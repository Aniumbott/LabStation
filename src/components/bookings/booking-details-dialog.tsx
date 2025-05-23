
'use client';

import { useState, useEffect } from 'react';
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
import type { Booking, BookingUsageDetails } from '@/types';
import { format, isValid, parseISO, isPast } from 'date-fns';
import { Calendar, Clock, User, Info, Tag, StickyNote, Activity, CheckCircle, AlertCircle, XCircle, FileText, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';
import { LogUsageFormDialog } from './log-usage-form-dialog';
import { initialBookings } from '@/lib/mock-data'; 

interface BookingDetailsDialogProps {
  booking: Booking | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onBookingUpdate: (updatedBooking: Booking) => void;
}

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => {
  if (!value && value !== '') return null;
  return (
    <div className="flex items-start">
      <Icon className="mr-3 h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
      <div>
        <span className="font-medium text-muted-foreground">{label}:</span>
        <p className="text-foreground whitespace-pre-wrap">{value || 'N/A'}</p>
      </div>
    </div>
  );
};


export function BookingDetailsDialog({ booking: bookingProp, isOpen, onOpenChange, onBookingUpdate }: BookingDetailsDialogProps) {
  const [isLogUsageFormOpen, setIsLogUsageFormOpen] = useState(false);
  const [currentBookingDetails, setCurrentBookingDetails] = useState<Booking | null>(bookingProp);

  useEffect(() => {
    setCurrentBookingDetails(bookingProp);
  }, [bookingProp]);


  if (!currentBookingDetails) {
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
      case 'Waitlisted':
         return 'bg-purple-500 text-white hover:bg-purple-600';
      default:
        return 'bg-slate-500 text-white hover:bg-slate-600';
    }
  };
  
  const getOutcomeIcon = (outcome?: BookingUsageDetails['outcome']) => {
    switch (outcome) {
      case 'Success': return <CheckCircle className="mr-2 h-4 w-4 text-green-500" />;
      case 'Failure': return <XCircle className="mr-2 h-4 w-4 text-red-500" />;
      case 'Interrupted': return <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />;
      default: return <Info className="mr-2 h-4 w-4 text-muted-foreground" />;
    }
  };

  const isPastBooking = currentBookingDetails.startTime && isPast(new Date(currentBookingDetails.startTime));
  const canLogUsage = isPastBooking && currentBookingDetails.status === 'Confirmed';
  
  // Note: getWaitlistPosition relies on allBookings which is not available here directly.
  // If waitlist position display is crucial in this dialog, allBookings needs to be passed down,
  // or the booking object itself should be augmented with this info before being passed.
  // For now, we'll omit position from this dialog for simplicity, as it's on the main table.


  const handleSaveUsage = (usageData: BookingUsageDetails) => {
    if (currentBookingDetails) {
      const updatedBooking = { ...currentBookingDetails, usageDetails: usageData };
      
      const globalIndex = initialBookings.findIndex(b => b.id === currentBookingDetails.id);
      if (globalIndex !== -1) {
        initialBookings[globalIndex] = updatedBooking;
      }
      
      setCurrentBookingDetails(updatedBooking); 
      onBookingUpdate(updatedBooking); 
      setIsLogUsageFormOpen(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center text-xl">
              <Tag className="mr-2 h-6 w-6 text-primary" />
              Booking Details
            </DialogTitle>
            <DialogDescription>
              Full information for your booking of {currentBookingDetails.resourceName}.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          <div className="grid gap-3 py-3 text-sm">
            <div className="flex items-center">
              <Info className="mr-3 h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground w-28">Resource:</span>
              <span className="text-foreground font-semibold">{currentBookingDetails.resourceName}</span>
            </div>
            <div className="flex items-center">
              <User className="mr-3 h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground w-28">Booked By:</span>
              <span className="text-foreground">{currentBookingDetails.userName}</span>
            </div>
            <div className="flex items-center">
              <Calendar className="mr-3 h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground w-28">Date:</span>
              <span className="text-foreground">{format(new Date(currentBookingDetails.startTime), 'PPP')}</span>
            </div>
            <div className="flex items-center">
              <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground w-28">Time:</span>
              <span className="text-foreground">
                {format(new Date(currentBookingDetails.startTime), 'p')} - {format(new Date(currentBookingDetails.endTime), 'p')}
              </span>
            </div>
             <div className="flex items-center">
              <Clock className="mr-3 h-5 w-5 text-muted-foreground" />
              <span className="font-medium text-muted-foreground w-28">Created:</span>
              <span className="text-foreground">{currentBookingDetails.createdAt ? format(new Date(currentBookingDetails.createdAt), 'PPP, p') : 'N/A'}</span>
            </div>
            <div className="flex items-center">
              <Info className="mr-3 h-5 w-5 text-muted-foreground" /> 
              <span className="font-medium text-muted-foreground w-28">Status:</span>
              <Badge className={cn("whitespace-nowrap text-xs px-2 py-0.5 border-transparent", getStatusBadgeClass(currentBookingDetails.status))}>
                {currentBookingDetails.status}
              </Badge>
            </div>
            {currentBookingDetails.notes && (
              <DetailItem icon={StickyNote} label="Booking Notes" value={currentBookingDetails.notes} />
            )}
          </div>

          {currentBookingDetails.usageDetails && (
            <>
              <Separator />
              <div className="py-3">
                <h3 className="text-md font-semibold mb-2 flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-primary" /> Usage Details
                </h3>
                <div className="grid gap-3 text-sm pl-2">
                  <DetailItem icon={Clock} label="Actual Start" value={currentBookingDetails.usageDetails.actualStartTime ? format(parseISO(currentBookingDetails.usageDetails.actualStartTime), 'PPP, p') : 'N/A'} />
                  <DetailItem icon={Clock} label="Actual End" value={currentBookingDetails.usageDetails.actualEndTime ? format(parseISO(currentBookingDetails.usageDetails.actualEndTime), 'PPP, p') : 'N/A'} />
                  {currentBookingDetails.usageDetails.outcome && (
                     <div className="flex items-center">
                      <div className="mr-3 h-5 w-5 flex items-center justify-center">{getOutcomeIcon(currentBookingDetails.usageDetails.outcome)}</div>
                        <div>
                          <span className="font-medium text-muted-foreground">Outcome:</span>
                          <p className="text-foreground">{currentBookingDetails.usageDetails.outcome}</p>
                        </div>
                    </div>
                  )}
                  <DetailItem icon={FileText} label="Data Location" value={currentBookingDetails.usageDetails.dataStorageLocation} />
                  <DetailItem icon={StickyNote} label="Usage Comments" value={currentBookingDetails.usageDetails.usageComments} />
                </div>
              </div>
            </>
          )}
          <Separator />
          <DialogFooter className="pt-4">
            {canLogUsage && (
              <Button variant="secondary" onClick={() => setIsLogUsageFormOpen(true)}>
                <Edit2 className="mr-2 h-4 w-4" /> {currentBookingDetails.usageDetails ? 'Edit Usage Log' : 'Log Usage'}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {currentBookingDetails && (
        <LogUsageFormDialog
          booking={currentBookingDetails}
          open={isLogUsageFormOpen}
          onOpenChange={setIsLogUsageFormOpen}
          onSaveUsage={handleSaveUsage}
        />
      )}
    </>
  );
}
