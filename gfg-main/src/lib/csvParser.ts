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
  const rawHeaders = rows[0].map(h => h.trim().replace(/^["']|["']$/g, ''));
  const dataRows = rows.slice(1);

  // Filter out empty headers and make sure they are unique
  const headers = rawHeaders.map((header, idx) => header || `Column_${idx + 1}`);

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
    norm === 'email' || 
    norm === 'emailaddress' || 
    norm === 'contactemail' || 
    norm === 'mail' || 
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
    norm === 'leadname'
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
    norm === 'companyname'
  ) {
    return 'store_name';
  }

  // Target: niche
  if (
    norm === 'niche' || 
    norm === 'industry' || 
    norm === 'category' || 
    norm === 'vertical' || 
    norm === 'tag'
  ) {
    return 'niche';
  }

  // Target: pain_point
  if (
    norm === 'painpoint' || 
    norm === 'pain' || 
    norm === 'problem' || 
    norm === 'issue' || 
    norm === 'offer'
  ) {
    return 'pain_point';
  }

  return '';
}
