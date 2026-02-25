
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Wrench, XCircle, Clock, Ban, User, AlertTriangle } from "lucide-react";
import type { ResourceStatus, UserStatus, RoleName, Booking } from "@/types";

type BookingStatus = Booking['status'];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateSafe(
  dateInput?: string | Date | null,
  emptyVal: string = 'N/A',
  dateFormat: string = 'PPP'
): string {
  if (!dateInput) return emptyVal;

  let dateToFormat: Date;

  if (typeof dateInput === 'string') {
    if (dateInput === '' || dateInput.toUpperCase() === 'N/A') return emptyVal;
    dateToFormat = parseISO(dateInput);
    if (!isValidDateFn(dateToFormat)) {
      try {
        const potentialDate = new Date(dateInput);
        if (isValidDateFn(potentialDate)) {
          dateToFormat = potentialDate;
        } else {
          return dateInput.toUpperCase() !== 'N/A' ? dateInput : emptyVal;
        }
      } catch (e) {
        return dateInput.toUpperCase() !== 'N/A' ? dateInput : emptyVal;
      }
    }
  } else if (dateInput instanceof Date) {
    dateToFormat = dateInput;
  } else {
    try {
      const S = String(dateInput);
      dateToFormat = parseISO(S);
      if (!isValidDateFn(dateToFormat)) {
        return S !== 'null' && S !== 'undefined' ? S : emptyVal;
      }
    } catch (e) {
      return emptyVal;
    }
  }

  if (isValidDateFn(dateToFormat)) {
    try {
      return format(dateToFormat, dateFormat);
    } catch (e) {
      return emptyVal;
    }
  } else {
    return typeof dateInput === 'string' && dateInput !== '' && dateInput.toUpperCase() !== 'N/A'
      ? dateInput
      : emptyVal;
  }
}

export function getResourceStatusBadge(status: ResourceStatus): JSX.Element {
  switch (status) {
    case 'Working':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100"><Wrench className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Broken':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100"><XCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      const exhaustiveCheck: never = status;
      return <Badge variant="outline">{String(exhaustiveCheck || status || "Unknown")}</Badge>;
  }
}

export function getBookingStatusBadge(status: BookingStatus): JSX.Element {
  switch (status) {
    case 'Confirmed':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Pending':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100"><Clock className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Cancelled':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100"><Ban className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Waitlisted':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100"><User className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getUserStatusBadge(status: UserStatus): JSX.Element {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 capitalize">{status}</Badge>;
    case 'pending_approval':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Pending Approval</Badge>;
    case 'suspended':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 capitalize">{status}</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}

export function getRoleBadge(role: RoleName): JSX.Element {
  switch (role) {
    case 'Admin':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">{role}</Badge>;
    case 'Technician':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">{role}</Badge>;
    case 'Researcher':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">{role}</Badge>;
    default:
      return <Badge variant="outline">{role}</Badge>;
  }
}

export function getMaintenanceStatusBadge(status: string): JSX.Element {
  switch (status) {
    case 'Open':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">{status}</Badge>;
    case 'InProgress':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">In Progress</Badge>;
    case 'Resolved':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">{status}</Badge>;
    case 'Closed':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getMembershipStatusBadge(status: string): JSX.Element {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 capitalize">{status}</Badge>;
    case 'pending_approval':
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Pending</Badge>;
    case 'rejected':
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 capitalize">{status}</Badge>;
    case 'revoked':
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100 capitalize">{status}</Badge>;
    default:
      return <Badge variant="outline" className="capitalize">{status}</Badge>;
  }
}
