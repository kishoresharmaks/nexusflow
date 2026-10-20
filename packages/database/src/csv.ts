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
        if (i + 1 < len && csvText[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        } else {
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
        if (i + 1 < len && csvText[i + 1] === '\n') {
          i += 2;
        } else {
          i++;
        }
        currentRecord.push(currentField);
        currentField = '';
        records.push(currentRecord);
        currentRecord = [];
        continue;
      } else if (char === '\n') {
        currentRecord.push(currentField);
        currentField = '';
        records.push(currentRecord);
        currentRecord = [];
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  if (currentField.length > 0 || currentRecord.length > 0) {
    currentRecord.push(currentField);
    records.push(currentRecord);
  }

  return records.filter((r) => r.some((field) => field.trim().length > 0));
}

const HEADER_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'product_sku', 'item_sku', 'id', 'product_id'],
  title: ['title', 'name', 'product_name', 'item_name'],
  description: ['description', 'desc', 'body', 'details'],
  price: ['price', 'price_cents', 'price_usd', 'amount', 'unit_price', 'cost'],
  currency: ['currency', 'curr'],
  inventory: ['inventory', 'inventory_count', 'stock', 'qty', 'quantity'],
  url: ['url', 'product_url', 'link'],
  images: ['images', 'image', 'image_url', 'image_urls', 'photos'],
  tags: ['tags', 'categories', 'category', 'keywords'],
};

function normalizeHeader(header: string): string {
  const clean = header
    .trim()
    .toLowerCase()
    .replace(/[\s\-_]+/g, '_');
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(clean)) return canonical;
  }
  return clean;
}

export function parseProductCsv(csvContent: string, defaultCurrency = 'USD'): CsvParseResult {
  const records = parseCsvRecords(csvContent);
  if (records.length === 0) {
    return { totalRows: 0, validRows: [], errors: [] };
  }

  const rawHeaders = records[0]!;
  const canonicalHeaders = rawHeaders.map(normalizeHeader);
  const dataRows = records.slice(1);

  const validRows: ParsedProductRow[] = [];
  const errors: RowError[] = [];

  for (let idx = 0; idx < dataRows.length; idx++) {
    const row = dataRows[idx]!;
    const rowNum = idx + 2;
    const rawMap: Record<string, string> = {};
    const fieldMap: Record<string, string> = {};

    for (let c = 0; c < canonicalHeaders.length; c++) {
      const canonicalKey = canonicalHeaders[c]!;
      const rawKey = rawHeaders[c] ?? `column_${c + 1}`;
      const val = (row[c] ?? '').trim();
      rawMap[rawKey] = val;
      if (!fieldMap[canonicalKey]) {
        fieldMap[canonicalKey] = val;
      }
    }

    const rowErrors: string[] = [];

    // Title validation
    const title = fieldMap['title'];
    if (!title) {
      rowErrors.push('Missing required field: title');
    } else if (title.length > 255) {
      rowErrors.push('Title exceeds maximum length of 255 characters');
    }

    // SKU validation
    const sku = fieldMap['sku'] || undefined;
    if (sku && sku.length > 100) {
      rowErrors.push('SKU exceeds maximum length of 100 characters');
    }

    // Price validation
    const priceStr = fieldMap['price'];
    let priceCents = 0;
    if (!priceStr) {
      rowErrors.push('Missing required field: price');
    } else {
      const sanitized = priceStr.replace(/[^0-9.-]/g, '');
      const parsed = parseFloat(sanitized);
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push(`Invalid price format: "${priceStr}". Must be non-negative number.`);
      } else {
        priceCents = Math.round(parsed * 100);
      }
    }

    // Inventory validation
    const invStr = fieldMap['inventory'];
    let inventoryCount = 0;
    if (invStr) {
      const parsedInv = parseInt(invStr, 10);
      if (isNaN(parsedInv) || parsedInv < 0) {
        rowErrors.push(`Invalid inventory count: "${invStr}". Must be a non-negative integer.`);
      } else {
        inventoryCount = parsedInv;
      }
    }

    // Currency validation
    const currency = (fieldMap['currency'] || defaultCurrency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      rowErrors.push(`Invalid ISO-4217 currency code: "${currency}". Must be 3 uppercase letters.`);
    }

    // URL validation
    const url = fieldMap['url'] || undefined;
    if (url) {
      try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          rowErrors.push(`Invalid URL protocol: "${url}". Must use HTTP or HTTPS.`);
        }
      } catch {
        rowErrors.push(`Malformed URL: "${url}".`);
      }
    }

    // Images
    const imagesRaw = fieldMap['images'];
    const images: string[] = [];
    if (imagesRaw) {
      const parts = imagesRaw
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const imgUrl of parts) {
        try {
          new URL(imgUrl);
          images.push(imgUrl);
        } catch {
          rowErrors.push(`Malformed image URL: "${imgUrl}".`);
        }
      }
    }

    // Tags
    const tagsRaw = fieldMap['tags'];
    const tags: string[] = [];
    if (tagsRaw) {
      const parts = tagsRaw
        .split(/[,;|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      tags.push(...parts);
    }

    const description = fieldMap['description'] || undefined;

    if (rowErrors.length > 0) {
      errors.push({
        rowNumber: rowNum,
        sku,
        title,
        errors: rowErrors,
        raw: rawMap,
      });
    } else {
      validRows.push({
        sku,
        title: title!,
        description,
        priceCents,
        currency,
        inventoryCount,
        url,
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
