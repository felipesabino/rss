import { DateTime } from 'luxon';

// Array of locales to try when parsing dates
// Add new locales here as needed for different feed sources
export const DATE_PARSING_LOCALES = [
  'en', // English (default)
  'pt-BR', // Portuguese (Brazil)
  'es', // Spanish
  'fr', // French
  'de', // German
  'it', // Italian
  // Add more locales as needed
];

// Common date formats to try
export const DATE_FORMATS = [
  'EEE, dd LLL yyyy HH:mm:ss ZZZ', // Standard RSS format with localized day/month names
  'EEE, dd LLL yyyy HH:mm:ss z', // Alternative timezone format
  'yyyy-MM-dd\'T\'HH:mm:ssZZZ', // ISO format
  'yyyy-MM-dd HH:mm:ss', // Simple format
  // Add more formats as needed
];

/**
 * Helper function to parse dates with Luxon supporting multiple locales
 * 
 * @param dateStr The date string to parse
 * @returns A JavaScript Date object
 */
export function parseDate(dateStr: string): Date {
  try {
    // Try standard date parsing first
    const jsDate = new Date(dateStr);
    if (!isNaN(jsDate.getTime())) {
      return jsDate;
    }
    
    // Try each locale with each format
    for (const locale of DATE_PARSING_LOCALES) {
      for (const format of DATE_FORMATS) {
        const dt = DateTime.fromFormat(dateStr, format, { locale });
        if (dt.isValid) {
          // console.log(`Successfully parsed date "${dateStr}" with locale "${locale}" and format "${format}"`);
          return dt.toJSDate();
        }
      }
    }
    
    // If all parsing fails, log warning and return current date
    console.warn(`Could not parse date: ${dateStr}, using current date instead`);
    return new Date();
  } catch (error) {
    console.warn(`Error parsing date: ${dateStr}`, error);
    return new Date();
  }
}
