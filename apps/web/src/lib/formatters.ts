/**
 * Centralized Currency & Timezone Formatting Utilities for NexusFlow
 * Uses standard Intl.NumberFormat and Intl.DateTimeFormat APIs.
 */

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
}

export interface TimezoneOption {
  id: string;
  label: string;
  region: string;
}

export interface LocaleOption {
  code: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'SG$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
];

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { id: 'Asia/Kolkata', label: 'Asia/Kolkata (IST, UTC+05:30)', region: 'Asia' },
  { id: 'UTC', label: 'UTC (Coordinated Universal Time)', region: 'Global' },
  { id: 'America/New_York', label: 'America/New_York (Eastern, UTC-05:00 / -04:00)', region: 'Americas' },
  { id: 'America/Chicago', label: 'America/Chicago (Central, UTC-06:00 / -05:00)', region: 'Americas' },
  { id: 'America/Denver', label: 'America/Denver (Mountain, UTC-07:00 / -06:00)', region: 'Americas' },
  { id: 'America/Los_Angeles', label: 'America/Los_Angeles (Pacific, UTC-08:00 / -07:00)', region: 'Americas' },
  { id: 'Europe/London', label: 'Europe/London (GMT/BST, UTC+00:00 / +01:00)', region: 'Europe' },
  { id: 'Europe/Paris', label: 'Europe/Paris (CET/CEST, UTC+01:00 / +02:00)', region: 'Europe' },
  { id: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST, UTC+01:00 / +02:00)', region: 'Europe' },
  { id: 'Asia/Dubai', label: 'Asia/Dubai (GST, UTC+04:00)', region: 'Middle East' },
  { id: 'Asia/Singapore', label: 'Asia/Singapore (SGT, UTC+08:00)', region: 'Asia' },
  { id: 'Asia/Tokyo', label: 'Asia/Tokyo (JST, UTC+09:00)', region: 'Asia' },
  { id: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT, UTC+10:00 / +11:00)', region: 'Australia' },
];

export const SUPPORTED_LOCALES: LocaleOption[] = [
  { code: 'en-IN', label: 'English (India) - en-IN' },
  { code: 'en-US', label: 'English (United States) - en-US' },
  { code: 'en-GB', label: 'English (United Kingdom) - en-GB' },
  { code: 'en-AU', label: 'English (Australia) - en-AU' },
  { code: 'en-CA', label: 'English (Canada) - en-CA' },
  { code: 'fr-FR', label: 'French (France) - fr-FR' },
  { code: 'de-DE', label: 'German (Germany) - de-DE' },
  { code: 'ja-JP', label: 'Japanese (Japan) - ja-JP' },
];

// Currencies that do not use fractional cent units
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'CLP', 'VND', 'PYG', 'BIF']);

/**
 * Maps a currency code to a sensible default locale if none provided.
 */
export function getDefaultLocaleForCurrency(currency: string): string {
  const upper = currency.toUpperCase();
  switch (upper) {
    case 'INR':
      return 'en-IN';
    case 'GBP':
      return 'en-GB';
    case 'EUR':
      return 'de-DE';
    case 'CAD':
      return 'en-CA';
    case 'AUD':
      return 'en-AU';
    case 'JPY':
      return 'ja-JP';
    default:
      return 'en-US';
  }
}

/**
 * Formats a monetary amount in cents into localized currency string (e.g. ₹885.95, $49.99).
 * Never prefixes an arbitrary currency with a literal dollar sign.
 */
export function formatCurrency(
  amountCents: number,
  currency: string = 'USD',
  locale?: string,
): string {
  if (typeof amountCents !== 'number' || isNaN(amountCents)) {
    return '—';
  }

  const cleanCurrency = (currency || 'USD').trim().toUpperCase();
  const effectiveLocale = locale || getDefaultLocaleForCurrency(cleanCurrency);
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cleanCurrency);
  const value = isZeroDecimal ? amountCents : amountCents / 100;

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: cleanCurrency,
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(value);
  } catch {
    // Graceful fallback if Intl fails with unusual currency code
    const opt = SUPPORTED_CURRENCIES.find((c) => c.code === cleanCurrency);
    const symbol = opt ? opt.symbol : cleanCurrency;
    return `${symbol} ${value.toFixed(isZeroDecimal ? 0 : 2)}`;
  }
}

/**
 * Formats a timestamp into localized date & time in the specified timezone.
 */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  timezone: string = 'UTC',
  locale: string = 'en-US',
  style: 'full' | 'medium' | 'short' | 'date' | 'dateOnly' | 'time' | 'timeOnly' = 'short',
): string {
  if (!date) return '—';

  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';

  const validTimezone = isValidTimezone(timezone) ? timezone : 'UTC';

  try {
    switch (style) {
      case 'date':
      case 'dateOnly':
        return new Intl.DateTimeFormat(locale, {
          timeZone: validTimezone,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(d);

      case 'time':
      case 'timeOnly':
        return new Intl.DateTimeFormat(locale, {
          timeZone: validTimezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(d);

      case 'full':
        return new Intl.DateTimeFormat(locale, {
          timeZone: validTimezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        }).format(d);

      case 'medium':
        return new Intl.DateTimeFormat(locale, {
          timeZone: validTimezone,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);

      case 'short':
      default:
        return new Intl.DateTimeFormat(locale, {
          timeZone: validTimezone,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
    }
  } catch {
    return d.toLocaleString();
  }
}

/**
 * Checks if a timezone string is valid in the JavaScript Intl runtime.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detects the user's browser IANA timezone (e.g. 'Asia/Kolkata').
 */
export function getBrowserTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (isValidTimezone(tz)) return tz;
  } catch {
    // ignore
  }
  return 'UTC';
}
