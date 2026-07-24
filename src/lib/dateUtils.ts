import { Timestamp } from './db';

/**
 * Safely converts supported time representations to a JavaScript Date.
 * Accepts Firestore Timestamp, Date, ISO/string values, or nullish.
 */
export const safeToDate = (
  value: Timestamp | Date | string | number | null | undefined
): Date | undefined => {
  if (!value) return undefined;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? undefined : value;
  }

  if (value instanceof Timestamp) {
    try {
      const date = value.toDate();
      return isNaN(date.getTime()) ? undefined : date;
    } catch (error) {
      console.warn('[dateUtils] Failed to convert Timestamp to Date', error);
      return undefined;
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
};

/**
 * Safely formats a Firestore Timestamp to a localized date string
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @param locale - Locale string (default: 'fr-FR')
 * @param options - Intl.DateTimeFormatOptions (default: French date format)
 * @returns Formatted date string or '-' if timestamp is invalid
 */
export const formatTimestamp = (
  timestamp: Timestamp | null | undefined,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit'
  }
): string => {
  const date = safeToDate(timestamp);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(locale, options);
};

/**
 * Safely formats a Firestore Timestamp to a localized date and time string
 * @param timestamp - Firestore Timestamp, null, or undefined
 * @param locale - Locale string (default: 'fr-FR')
 * @param options - Intl.DateTimeFormatOptions (default: French date and time format)
 * @returns Formatted date and time string or '-' if timestamp is invalid
 */
export const formatTimestampWithTime = (
  timestamp: Timestamp | null | undefined,
  locale: string = 'fr-FR',
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string => {
  const date = safeToDate(timestamp);
  if (!date) {
    return '-';
  }
  return date.toLocaleDateString(locale, options);
};
