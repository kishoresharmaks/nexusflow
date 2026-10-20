import { describe, it, expect } from 'vitest';
import {
  parseProductCsv,
  parsePriceToCents,
  parseCsvRecords,
} from '../src/products/csv/csv-parser';

describe('CSV Parser and Validator', () => {
  describe('parsePriceToCents', () => {
    it('parses decimal dollar amounts correctly', () => {
      expect(parsePriceToCents('19.99')).toEqual({ cents: 1999 });
      expect(parsePriceToCents('$29.50')).toEqual({ cents: 2950 });
      expect(parsePriceToCents('0.99')).toEqual({ cents: 99 });
      expect(parsePriceToCents('0')).toEqual({ cents: 0 });
      expect(parsePriceToCents('$1,250.00')).toEqual({ cents: 125000 });
    });

    it('rejects invalid, negative, or excessive amounts', () => {
      expect(parsePriceToCents('-15.00').error).toBeDefined();
      expect(parsePriceToCents('abc').error).toBeDefined();
      expect(parsePriceToCents('').error).toBeDefined();
      expect(parsePriceToCents('2000000').error).toBeDefined();
    });
  });

  describe('RFC 4180 parsing with quotes and newlines', () => {
    it('handles commas and newlines inside quoted fields', () => {
      const csv = `sku,title,description,price\r\nSKU-1,"Cozy Hoodie, Blue","A warm, cozy hoodie.\nMade from 100% organic cotton.",49.99`;
      const result = parseProductCsv(csv);

      expect(result.totalRows).toBe(1);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0]?.title).toBe('Cozy Hoodie, Blue');
      expect(result.validRows[0]?.description).toContain('Made from 100% organic cotton.');
      expect(result.validRows[0]?.priceCents).toBe(4999);
      expect(result.errors.length).toBe(0);
    });

    it('handles escaped double quotes inside fields', () => {
      const csv = `sku,title,price\r\nSKU-2,"T-Shirt with ""Vintage"" Print",19.99`;
      const result = parseProductCsv(csv);

      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0]?.title).toBe('T-Shirt with "Vintage" Print');
    });
  });

  describe('Header normalization', () => {
    it('maps alternative header names properly', () => {
      const csv = `item_sku,product_name,details,amount,stock,image_url,labels\r\nSKU-A,Wireless Mouse,Ergonomic mouse,25.00,100,https://example.com/mouse.jpg,"tech, accessories"`;
      const result = parseProductCsv(csv);

      expect(result.validRows.length).toBe(1);
      const row = result.validRows[0]!;
      expect(row.sku).toBe('SKU-A');
      expect(row.title).toBe('Wireless Mouse');
      expect(row.description).toBe('Ergonomic mouse');
      expect(row.priceCents).toBe(2500);
      expect(row.inventoryCount).toBe(100);
      expect(row.images).toEqual(['https://example.com/mouse.jpg']);
      expect(row.tags).toEqual(['tech', 'accessories']);
    });
  });

  describe('Row-level error reporting', () => {
    it('catches missing title, negative price, invalid inventory, and malformed URLs', () => {
      const csv =
        `sku,title,price,inventory,url\r\n` +
        `SKU-GOOD,Valid T-Shirt,15.00,10,https://example.com/shirt\r\n` +
        `SKU-BAD1,,20.00,5,https://example.com\r\n` +
        `SKU-BAD2,Negative Price,-5.00,10,\r\n` +
        `SKU-BAD3,Invalid Stock,25.00,-3,\r\n` +
        `SKU-BAD4,Bad URL,10.00,0,not-a-url`;

      const result = parseProductCsv(csv);

      expect(result.totalRows).toBe(5);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0]?.sku).toBe('SKU-GOOD');
      expect(result.errors.length).toBe(4);

      // Check row 3 (SKU-BAD1: missing title)
      const err1 = result.errors.find((e) => e.rowNumber === 3);
      expect(err1?.errors).toContain('Product title is required and cannot be empty.');

      // Check row 4 (SKU-BAD2: negative price)
      const err2 = result.errors.find((e) => e.rowNumber === 4);
      expect(err2?.errors.some((m) => m.includes('Price cannot be negative'))).toBe(true);

      // Check row 5 (SKU-BAD3: invalid stock)
      const err3 = result.errors.find((e) => e.rowNumber === 5);
      expect(err3?.errors.some((m) => m.includes('Inventory count'))).toBe(true);

      // Check row 6 (SKU-BAD4: bad URL)
      const err4 = result.errors.find((e) => e.rowNumber === 6);
      expect(err4?.errors.some((m) => m.includes('Product URL'))).toBe(true);
    });

    it('detects duplicate SKUs within the same CSV', () => {
      const csv =
        `sku,title,price\r\n` + `SKU-DUP,Original Item,10.00\r\n` + `SKU-DUP,Duplicate Item,12.00`;

      const result = parseProductCsv(csv);

      expect(result.totalRows).toBe(2);
      expect(result.validRows.length).toBe(1);
      expect(result.validRows[0]?.title).toBe('Original Item');
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]?.rowNumber).toBe(3);
      expect(result.errors[0]?.errors[0]).toContain('Duplicate SKU "SKU-DUP" detected in CSV');
    });
  });
});
