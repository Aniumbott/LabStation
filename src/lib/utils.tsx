
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Wrench, XCircle } from "lucide-react"; // Replaced Construction with Wrench, Added XCircle
import type { ResourceStatus } from "@/types";

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
  } else if (dateInput && typeof (dateInput as any).toDate === 'function') {
    dateToFormat = (dateInput as any).toDate();
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
      return <Badge className={cn("bg-green-500 hover:bg-green-600 text-white border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className={cn("bg-orange-500 hover:bg-orange-600 text-white border-transparent")}><Wrench className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Broken':
      return <Badge variant="destructive" className={cn("bg-red-600 hover:bg-red-700 text-white border-transparent")}><XCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      const exhaustiveCheck: never = status;
      return <Badge variant="outline">{String(exhaustiveCheck || status || "Unknown")}</Badge>;
  }
}
