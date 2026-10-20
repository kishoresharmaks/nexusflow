export interface ParsedProductRow {
  sku?: string | undefined;
  title: string;
  description?: string | undefined;
  priceCents: number;
  currency: string;
  inventoryCount: number;
  url?: string | undefined;
  images: string[];
  tags: string[];
}

export interface RowError {
  rowNumber: number;
  sku?: string | undefined;
  title?: string | undefined;
  errors: string[];
  raw: Record<string, string>;
}

export interface CsvParseResult {
  totalRows: number;
  validRows: ParsedProductRow[];
  errors: RowError[];
}

/**
 * RFC 4180 compliant CSV line tokenizer.
 * Handles quoted fields, escaped quotes (""), and multiple line break styles.
 */
export function parseCsvRecords(csvText: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const char = csvText[i];

    if (inQuotes) {
      if (char === '"') {
        // Look ahead for escaped quote ""
        if (i + 1 < len && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRecord.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        // Carriage return: check if next is \n
        if (i + 1 < len && csvText[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRecord.push(currentField);
        currentField = '';
        if (currentRecord.some((f) => f.trim().length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        continue;
      } else if (char === '\n') {
        i++;
        currentRecord.push(currentField);
        currentField = '';
        if (currentRecord.some((f) => f.trim().length > 0)) {
          records.push(currentRecord);
        }
        currentRecord = [];
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field and record
  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    if (currentRecord.some((f) => f.trim().length > 0)) {
      records.push(currentRecord);
    }
  }

  return records;
}

/**
 * Normalize column names to known schema fields.
 */
function normalizeHeaderName(header: string): string {
  const clean = header
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '');
  if (['sku', 'productsku', 'itemsku', 'code', 'barcode', 'itemnumber'].includes(clean)) {
    return 'sku';
  }
  if (['title', 'productname', 'name', 'itemname', 'headline'].includes(clean)) {
    return 'title';
  }
  if (['description', 'desc', 'details', 'body', 'summary'].includes(clean)) {
    return 'description';
  }
  if (['price', 'pricecents', 'priceusd', 'amount', 'mrp', 'cost', 'saleprice'].includes(clean)) {
    return 'price';
  }
  if (['currency'].includes(clean)) {
    return 'currency';
  }
  if (['inventory', 'inventorycount', 'quantity', 'stock', 'qty', 'count'].includes(clean)) {
    return 'inventory';
  }
  if (['url', 'link', 'producturl', 'pageurl', 'productlink'].includes(clean)) {
    return 'url';
  }
  if (['image', 'images', 'imageurl', 'imageurls', 'photos', 'photo'].includes(clean)) {
    return 'images';
  }
  if (['tag', 'tags', 'category', 'categories', 'labels'].includes(clean)) {
    return 'tags';
  }
  return clean;
}

function isValidHttpUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parse price string (e.g. "19.99", "$24.50", "1500") into integer cents.
 */
export function parsePriceToCents(rawPrice: string): { cents?: number; error?: string } {
  if (!rawPrice || rawPrice.trim().length === 0) {
    return { error: 'Price is required.' };
  }

  const cleaned = rawPrice
    .trim()
    .replace(/^[$€£₹\s]+/, '')
    .replace(/,/g, '');
  const num = Number(cleaned);

  if (isNaN(num)) {
    return { error: `Invalid price "${rawPrice}". Must be a valid numeric amount.` };
  }

  if (num < 0) {
    return { error: `Invalid price "${rawPrice}". Price cannot be negative.` };
  }

  if (num > 1_000_000) {
    return { error: `Invalid price "${rawPrice}". Price exceeds maximum allowed threshold.` };
  }

  // Convert to cents with math rounding to avoid floating point precision issues
  const cents = Math.round(num * 100);
  return { cents };
}

/**
 * Parses raw CSV string and validates each row according to product requirements.
 */
export function parseProductCsv(csvText: string, defaultCurrency = 'USD'): CsvParseResult {
  const records = parseCsvRecords(csvText);

  if (records.length === 0) {
    return { totalRows: 0, validRows: [], errors: [] };
  }

  const headerRow = records[0] ?? [];
  const headers = headerRow.map(normalizeHeaderName);
  const dataRows = records.slice(1);

  const validRows: ParsedProductRow[] = [];
  const errors: RowError[] = [];
  const seenSkusInCsv = new Map<string, number>();

  for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
    const row = dataRows[rowIndex];
    if (!row) continue;

    const rowNumber = rowIndex + 2; // Line 1 is header, 1-indexed line number
    const rowErrors: string[] = [];
    const rowData: Record<string, string> = {};

    headers.forEach((h, idx) => {
      rowData[h] = (row[idx] ?? '').trim();
    });

    const rawSku = rowData['sku'];
    const rawTitle = rowData['title'];
    const rawDesc = rowData['description'];
    const rawPrice = rowData['price'];
    const rawCurrency = rowData['currency'] || defaultCurrency;
    const rawInventory = rowData['inventory'];
    const rawUrl = rowData['url'];
    const rawImages = rowData['images'];
    const rawTags = rowData['tags'];

    // 1. Validate Title
    if (!rawTitle || rawTitle.trim().length === 0) {
      rowErrors.push('Product title is required and cannot be empty.');
    } else if (rawTitle.length > 250) {
      rowErrors.push('Product title cannot exceed 250 characters.');
    }

    // 2. Validate Price
    let priceCents = 0;
    if (!rawPrice) {
      rowErrors.push('Price is required.');
    } else {
      const priceResult = parsePriceToCents(rawPrice);
      if (priceResult.error) {
        rowErrors.push(priceResult.error);
      } else if (priceResult.cents !== undefined) {
        priceCents = priceResult.cents;
      }
    }

    // 3. Validate Currency
    let currency = rawCurrency.toUpperCase();
    if (currency.length !== 3) {
      currency = defaultCurrency;
    }

    // 4. Validate Inventory
    let inventoryCount = 0;
    if (rawInventory && rawInventory.trim().length > 0) {
      const parsedInv = Number(rawInventory.trim());
      if (isNaN(parsedInv) || !Number.isInteger(parsedInv) || parsedInv < 0) {
        rowErrors.push(`Inventory count "${rawInventory}" must be a non-negative integer.`);
      } else {
        inventoryCount = parsedInv;
      }
    }

    // 5. Validate URL
    let productUrl: string | undefined = undefined;
    if (rawUrl && rawUrl.trim().length > 0) {
      if (!isValidHttpUrl(rawUrl)) {
        rowErrors.push(`Product URL "${rawUrl}" must be a valid HTTP or HTTPS URL.`);
      } else {
        productUrl = rawUrl.trim();
      }
    }

    // 6. Validate Images
    const images: string[] = [];
    if (rawImages && rawImages.trim().length > 0) {
      const splitImages = rawImages
        .split(/[;,|]+/)
        .map((img) => img.trim())
        .filter(Boolean);
      for (const imgUrl of splitImages) {
        if (!isValidHttpUrl(imgUrl)) {
          rowErrors.push(`Image URL "${imgUrl}" is not a valid HTTP or HTTPS URL.`);
        } else {
          images.push(imgUrl);
        }
      }
    }

    // 7. Parse Tags
    const tags: string[] = [];
    if (rawTags && rawTags.trim().length > 0) {
      tags.push(
        ...rawTags
          .split(/[,;|]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      );
    }

    // 8. Validate SKU & Detect In-file Duplicates
    let sku: string | undefined = undefined;
    if (rawSku && rawSku.trim().length > 0) {
      sku = rawSku.trim();
      if (seenSkusInCsv.has(sku)) {
        const firstLine = seenSkusInCsv.get(sku);
        rowErrors.push(`Duplicate SKU "${sku}" detected in CSV (first seen on row ${firstLine}).`);
      } else {
        seenSkusInCsv.set(sku, rowNumber);
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber,
        sku,
        title: rawTitle,
        errors: rowErrors,
        raw: rowData,
      });
    } else {
      validRows.push({
        sku,
        title: rawTitle!,
        description: rawDesc ? rawDesc.trim() : undefined,
        priceCents,
        currency,
        inventoryCount,
        url: productUrl,
        images,
        tags,
      });
    }
  }

  return {
    totalRows: dataRows.length,
    validRows,
    errors,
  };
}
