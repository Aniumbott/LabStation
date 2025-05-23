
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
    // Primarily expect ISO strings, parseISO is robust for them
    dateToFormat = parseISO(dateInput);
    // If parseISO results in an invalid date, new Date(dateInput) might catch other formats,
    // but it's less reliable for arbitrary strings. isValid will catch it.
    if (!isValid(dateToFormat)) {
        try {
            // Fallback for non-ISO strings that new Date might understand
            dateToFormat = new Date(dateInput);
        } catch (e) {
             // If new Date also fails, return original string if it's not a known emptyVal
            return dateInput.toUpperCase() !== 'N/A' ? dateInput : emptyVal;
        }
    }
  } else if (dateInput instanceof Date) {
    dateToFormat = dateInput;
  } else {
    // Handle cases where it might be a Firestore Timestamp-like object (if not converted earlier)
    // This check might be needed if Timestamps are passed directly before conversion
    // @ts-ignore
    if (typeof dateInput.toDate === 'function') {
      // @ts-ignore
      dateToFormat = dateInput.toDate();
    } else {
      // If not a string, Date, or object with toDate, try to convert to string.
      // This is a last resort and might not produce a valid date.
      const S = String(dateInput);
      dateToFormat = parseISO(S);
      if (!isValid(dateToFormat)) {
          return S; // Return the string conversion if parsing fails
      }
    }
  }

  if (isValid(dateToFormat)) {
    return format(dateToFormat, dateFormat);
  } else {
    // If after all attempts, the date is invalid, return emptyVal or original string
    return typeof dateInput === 'string' && dateInput !== '' && dateInput.toUpperCase() !== 'N/A'
      ? dateInput
      : emptyVal;
  }
}
