import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatDateTime,
  isValidTimezone,
  getDefaultLocaleForCurrency,
  getBrowserTimezone,
} from '../src/lib/formatters';

describe('Formatters (Currency & Timezone Management)', () => {
  describe('formatCurrency', () => {
    it('correctly formats INR without dollar signs', () => {
      const formatted = formatCurrency(88595, 'INR');
      // Must contain Rupee symbol ₹ or INR and NOT start with $
      expect(formatted).not.toContain('$');
      expect(formatted).toMatch(/₹|INR/);
      expect(formatted).toContain('885.95');
    });

    it('correctly formats USD with dollar symbol', () => {
      const formatted = formatCurrency(4999, 'USD', 'en-US');
      expect(formatted).toBe('$49.99');
    });

    it('correctly formats EUR', () => {
      const formatted = formatCurrency(12950, 'EUR', 'en-US');
      expect(formatted).toContain('129.50');
      expect(formatted).toMatch(/€|EUR/);
    });

    it('correctly formats GBP with pound symbol', () => {
      const formatted = formatCurrency(2500, 'GBP', 'en-GB');
      expect(formatted).toBe('£25.00');
    });

    it('handles zero decimal currencies like JPY', () => {
      const formatted = formatCurrency(500, 'JPY', 'ja-JP');
      expect(formatted).not.toContain('.00');
      expect(formatted).toContain('500');
    });

    it('gracefully handles missing or NaN amounts', () => {
      expect(formatCurrency(NaN)).toBe('—');
    });
  });

  describe('formatDateTime & Timezones', () => {
    const testDate = new Date('2026-10-21T05:30:00Z'); // 11:00 AM IST (+05:30)

    it('formats UTC time accurately', () => {
      const formatted = formatDateTime(testDate, 'UTC', 'en-US', 'full');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('UTC');
    });

    it('formats Asia/Kolkata timezone accurately (+05:30)', () => {
      const formatted = formatDateTime(testDate, 'Asia/Kolkata', 'en-IN', 'short');
      // 05:30 UTC + 5:30 = 11:00 AM
      expect(formatted).toContain('11:00');
    });

    it('validates IANA timezones correctly', () => {
      expect(isValidTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Invalid/Fake_Zone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
    });

    it('falls back gracefully on invalid timezone', () => {
      const formatted = formatDateTime(testDate, 'Invalid/Fake_Zone', 'en-US');
      expect(formatted).toBeDefined();
      expect(formatted).not.toBe('—');
    });

    it('detects browser timezone', () => {
      const tz = getBrowserTimezone();
      expect(typeof tz).toBe('string');
      expect(isValidTimezone(tz)).toBe(true);
    });
  });

  describe('getDefaultLocaleForCurrency', () => {
    it('returns appropriate locales for major currencies', () => {
      expect(getDefaultLocaleForCurrency('INR')).toBe('en-IN');
      expect(getDefaultLocaleForCurrency('GBP')).toBe('en-GB');
      expect(getDefaultLocaleForCurrency('USD')).toBe('en-US');
    });
  });
});
