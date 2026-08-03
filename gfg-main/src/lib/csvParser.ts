/**
 * Simple client-side CSV parser that handles:
 * - Delimiter detection (comma, semicolon, tab)
 * - Quoted fields (with escaped quotes e.g. "")
 * - Carriage returns and newlines
 */
export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCSV(text: string): ParsedCSV {
  if (!text || !text.trim()) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter: count occurrences in first line
  const firstLine = text.split(/\r?\n/)[0] || '';
  let delimiter = ',';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  if (semiCount > commaCount && semiCount > tabCount) {
    delimiter = ';';
  } else if (tabCount > commaCount && tabCount > semiCount) {
    delimiter = '\t';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // End of quotes
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\r' || char === '\n') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        // Skip next character if it's part of \r\n
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
      } else {
        currentField += char;
      }
    }
  }

  // Handle final field and row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  // First row is headers
  let rawHeaders = rows[0].map(h => h.trim().replace(/^["']|["']$/g, ''));
  let dataRows = rows.slice(1);

  // If any cell in the first row is a valid email, then the first row is data (headerless CSV).
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isHeaderless = rawHeaders.some(cell => emailRegex.test(cell));

  if (isHeaderless) {
    dataRows = rows; // The first row is also data
    rawHeaders = rows[0].map((cell, idx) => {
      if (emailRegex.test(cell)) {
        return 'Email';
      }
      return `Column_${idx + 1}`;
    });
  }

  // Filter out empty headers and make sure they are unique
  const seenHeaders = new Set<string>();
  const headers = rawHeaders.map((header, idx) => {
    const base = header || `Column_${idx + 1}`;
    let name = base;
    let counter = 1;
    while (seenHeaders.has(name)) {
      name = `${base}_${counter}`;
      counter++;
    }
    seenHeaders.add(name);
    return name;
  });

  const formattedRows = dataRows.map(row => {
    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = row[idx] !== undefined ? row[idx] : '';
    });
    return rowObj;
  });

  return { headers, rows: formattedRows };
}

/**
 * Fuzzy-matches a CSV header against a target field name
 */
export function suggestFieldMapping(header: string): string {
  const norm = header.toLowerCase().trim().replace(/[-_\s]/g, '');
  
  // Target: email
  if (
    norm.includes('email') || 
    norm.includes('e-mail') || 
    norm === 'mail' || 
    norm.endsWith('mail') || 
    norm === 'to' || 
    norm === 'recipient'
  ) {
    return 'email';
  }

  // Target: first_name
  if (
    norm === 'firstname' || 
    norm === 'fname' || 
    norm === 'name' || 
    norm === 'first' || 
    norm === 'contactname' || 
    norm === 'leadname' ||
    norm.startsWith('firstname') ||
    norm.startsWith('name')
  ) {
    return 'first_name';
  }

  // Target: store_name
  if (
    norm === 'storename' || 
    norm === 'store' || 
    norm === 'shop' || 
    norm === 'shopname' || 
    norm === 'brand' || 
    norm === 'brandname' || 
    norm === 'website' || 
    norm === 'domain' || 
    norm === 'company' || 
    norm === 'companyname' ||
    norm.startsWith('store') ||
    norm.startsWith('shop') ||
    norm.startsWith('brand') ||
    norm.startsWith('website') ||
    norm.startsWith('company')
  ) {
    return 'store_name';
  }

  // Target: niche
  if (
    norm === 'niche' || 
    norm === 'industry' || 
    norm === 'category' || 
    norm === 'vertical' || 
    norm === 'tag' ||
    norm.startsWith('niche') ||
    norm.startsWith('industry')
  ) {
    return 'niche';
  }

  // Target: pain_point
  if (
    norm === 'painpoint' || 
    norm === 'pain' || 
    norm === 'problem' || 
    norm === 'issue' || 
    norm === 'offer' ||
    norm.startsWith('painpoint') ||
    norm.startsWith('problem')
  ) {
    return 'pain_point';
  }

  return '';
}

/**
 * Converts an arbitrary CSV header string into a safe, normalized key
 * suitable for use as a template variable: e.g. "Store URL" → "store_url"
 */
export function normalizeHeaderKey(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')   // Replace non-alphanumeric runs with underscore
    .replace(/^_+|_+$/g, '');       // Trim leading/trailing underscores
}

/**
 * Cleanly extracts all emails and any URL/domain name from a cell value.
 */
export function extractEmailsAndUrlsFromCell(cellValue: string): { emails: string[]; url: string } {
  const trimmed = cellValue.trim();
  if (!trimmed) {
    return { emails: [], url: '' };
  }

  // Extract all email addresses from the cell using regex
  const emailMatches = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  let emailCandidates = Array.from(new Set(emailMatches.map(e => e.trim().toLowerCase())));

  // If no valid email formats found, fallback to colon/semicolon split for safety
  if (emailCandidates.length === 0) {
    emailCandidates = trimmed.split(/[:;]/).map(e => e.trim().toLowerCase()).filter(Boolean);
  }

  // Extract any URL or domain-like string (e.g. https://... or www.... or domain.com)
  const urlRegex = /(https?:\/\/[^\s;:]+)/i;
  const wwwRegex = /(www\.[^\s;:]+\.[^\s;:]+)/i;
  const urlMatch = trimmed.match(urlRegex) || trimmed.match(wwwRegex);
  let extractedUrl = urlMatch ? urlMatch[0].trim() : '';

  if (!extractedUrl) {
    // Look for any word that contains a dot, does not contain @, and doesn't end with a dot
    const tokens = trimmed.split(/[\s;:•]+/);
    for (const token of tokens) {
      const t = token.trim();
      if (t.includes('.') && !t.includes('@') && t.length > 4 && !t.endsWith('.')) {
        if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(t)) {
          extractedUrl = t;
          break;
        }
      }
    }
  }

  return { emails: emailCandidates, url: extractedUrl };
}

/**
 * Formats parsed headers and rows back into a standard CSV string
 */
export function convertToCSV(headers: string[], rows: Record<string, string>[]): string {
  const escapeField = (val: any): string => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(';')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  
  const headerLine = headers.map(escapeField).join(',');
  const rowLines = rows.map(row => headers.map(h => escapeField(row[h] || '')).join(','));
  return [headerLine, ...rowLines].join('\n');
}
