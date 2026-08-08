interface ParsedMatch {
  email: string;
  name: string;
}

function parseSingleEmailLine(line: string, email: string): ParsedMatch | null {
  email = email.toLowerCase().trim();
  let name = '';

  // Format 1: Name <email>
  if (line.includes('<' + email + '>')) {
    const parts = line.split('<' + email + '>');
    name = parts[0].trim();
  }
  // Format 2: Name <mailto:email>
  else if (line.includes('<mailto:' + email + '>')) {
    const parts = line.split('<mailto:' + email + '>');
    name = parts[0].trim();
  }
  // Format 3: email (Name)
  else if (line.includes('(') && line.includes(')')) {
    const startIdx = line.indexOf('(');
    const endIdx = line.indexOf(')');
    if (startIdx < endIdx) {
      name = line.substring(startIdx + 1, endIdx).trim();
    }
  }
  // Format 4: Tab/comma/semicolon separated: "Name[tab/comma/semicolon]email" or "email[tab/comma/semicolon]Name"
  else {
    const delimiters = ['\t', ';', ','];
    let delimiterUsed = '';
    for (const delim of delimiters) {
      if (line.includes(delim)) {
        delimiterUsed = delim;
        break;
      }
    }

    if (delimiterUsed) {
      const parts = line.split(delimiterUsed);
      const emailIndex = parts.findIndex(p => p.toLowerCase().includes(email));
      if (emailIndex >= 0) {
        const namePart = parts.find((_, idx) => idx !== emailIndex && !parts[idx].toLowerCase().includes('@'));
        if (namePart) {
          name = namePart.trim();
        }
      }
    }
  }

  // Clean up name
  if (name) {
    name = name.replace(/^["'\s<>()]+|["'\s<>()]+$/g, '').trim();
    if (name.toLowerCase() === email) {
      name = '';
    }
  }

  return { email, name };
}

function parseLineWithMultipleEmails(line: string): ParsedMatch[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const allEmails = line.match(emailRegex);
  if (!allEmails) return [];

  if (allEmails.length === 1) {
    const parsed = parseSingleEmailLine(line, allEmails[0]);
    return parsed ? [parsed] : [];
  }

  // Multiple emails on the same line: group them into a single comma-separated recipient entry
  const uniqueEmails = Array.from(new Set(allEmails.map(e => e.toLowerCase())));
  let name = '';
  const firstEmailIndex = line.indexOf(allEmails[0]);
  if (firstEmailIndex > 0) {
    const prefix = line.substring(0, firstEmailIndex).trim();
    name = prefix.replace(/^["'\s<>()]+|["'\s<>()]+$/g, '').trim();
  }

  return [{
    email: uniqueEmails.join(', '),
    name
  }];
}

export function parseEmailsText(text: string, isCSV: boolean = false): { email: string; name?: string }[] {
  if (!text) return [];

  const matches: ParsedMatch[] = [];

  // Simple CSV detection: check first line for common delimiters
  const firstLineEnd = text.indexOf('\n');
  const firstLine = text.substring(0, firstLineEnd > -1 ? firstLineEnd : 500);
  const hasDelimiter = firstLine.includes(',') || firstLine.includes(';');

  if (isCSV || hasDelimiter) {
    const delimiter = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.split(delimiter).map((h: string) => h.trim().toLowerCase().replace(/["']/g, ''));
    const emailIndex = headers.findIndex((h: string) =>
      h === 'email' || h === 'e-mail' || h === 'mail' || h === 'email address' || h === 'emailaddress'
    );
    const nameIndex = headers.findIndex((h: string) =>
      h === 'name' || h === 'fullname' || h === 'full name' || h === 'firstname' || h === 'first name' || h === 'displayname' || h === 'display name'
    );

    if (emailIndex >= 0) {
      const lines = text.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const cells = line.split(delimiter);
          const cell = cells[emailIndex];
          if (cell && cell.includes('@')) {
            const email = cell.trim().replace(/["']/g, '');
            let name = '';
            if (nameIndex >= 0 && cells[nameIndex]) {
              name = cells[nameIndex].trim().replace(/["']/g, '');
            }
            matches.push({ email, name });
          }
        }
      }
    }
  }

  // Fallback / General line-by-line parser for unstructured or list text
  if (matches.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      const parsed = parseLineWithMultipleEmails(line);
      if (parsed.length > 0) {
        matches.push(...parsed);
      }
    }
  }

  // Deduplicate by email address, keeping the first occurrence's name if present
  const uniqueMap = new Map<string, string>();
  for (const match of matches) {
    const email = match.email.trim().toLowerCase();
    if (!uniqueMap.has(email) || (!uniqueMap.get(email) && match.name)) {
      uniqueMap.set(email, match.name);
    }
  }

  return Array.from(uniqueMap.entries()).map(([email, name]) => ({
    email,
    name: name || undefined,
  }));
}
