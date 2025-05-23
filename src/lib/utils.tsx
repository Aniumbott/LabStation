
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import React from "react"; // CRUCIAL for JSX
import { Badge } from "@/components/ui/badge"; // CRUCIAL for Badge component
import { CheckCircle, AlertTriangle, Construction } from "lucide-react"; // CRUCIAL for icons
import type { ResourceStatus } from "@/types"; // CRUCIAL for type safety

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely formats a date string or Date object.
 * Handles ISO strings, Date objects, and attempts to parse other string formats.
 * Returns a fallback string ('N/A' by default) if the date is invalid or input is null/undefined.
 * @param dateInput The date to format (string, Date, null, or undefined).
 * @param emptyVal The string to return if dateInput is null, undefined, or invalid. Defaults to 'N/A'.
 * @param dateFormat The date-fns format string. Defaults to 'PPP'.
 * @returns The formatted date string or the emptyVal.
 */
export function formatDateSafe(
  dateInput?: string | Date | null,
  emptyVal: string = 'N/A',
  dateFormat: string = 'PPP'
): string {
  if (!dateInput) return emptyVal;

  let dateToFormat: Date;

  if (typeof dateInput === 'string') {
    if (dateInput === '' || dateInput.toUpperCase() === 'N/A') return emptyVal;
    // Try parsing as ISO string first
    dateToFormat = parseISO(dateInput);
    if (!isValidDateFn(dateToFormat)) {
      // If ISO parsing fails, try new Date() as a fallback for other formats
      try {
        const potentialDate = new Date(dateInput);
        if (isValidDateFn(potentialDate)) {
          dateToFormat = potentialDate;
        } else {
          // If new Date() also results in invalid, return original string if it's not "N/A"
          return dateInput.toUpperCase() !== 'N/A' ? dateInput : emptyVal;
        }
      } catch (e) {
         // Catch potential errors from `new Date()` with very malformed strings
        return dateInput.toUpperCase() !== 'N/A' ? dateInput : emptyVal;
      }
    }
  // @ts-ignore - Handling potential Firebase Timestamp if not already converted by fetch logic
  } else if (dateInput && typeof (dateInput as any).toDate === 'function') {
    // @ts-ignore
    dateToFormat = (dateInput as any).toDate();
  } else if (dateInput instanceof Date) {
    dateToFormat = dateInput;
  } else {
    // Fallback for other unexpected types, try to stringify and parse
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
        // Catch error from format() if dateToFormat is somehow still problematic (e.g. Infinity Date)
        return emptyVal;
    }
  } else {
    // Final fallback if dateToFormat is invalid
    return typeof dateInput === 'string' && dateInput !== '' && dateInput.toUpperCase() !== 'N/A'
      ? dateInput
      : emptyVal;
  }
}

export function getResourceStatusBadge(status: ResourceStatus): JSX.Element {
  switch (status) {
    case 'Available':
      return <Badge className={cn("bg-green-500 hover:bg-green-600 text-white border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Booked':
      return <Badge className={cn("bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent")}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className={cn("bg-orange-500 hover:bg-orange-600 text-white border-transparent")}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      // This ensures exhaustiveness if new statuses are added to ResourceStatus type
      const exhaustiveCheck: never = status;
      return <Badge variant="outline">{String(exhaustiveCheck || status || "Unknown")}</Badge>;
  }
}
