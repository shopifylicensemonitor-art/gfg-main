// Web Worker for processing email extraction in background
self.onmessage = (e: MessageEvent) => {
    const { text, nextSequenceId, sentStatus } = e.data;

    if (!text) {
        self.postMessage({ emails: [], nextSequenceId });
        return;
    }

    let matches: string[] = [];

    // Simple CSV detection: check first line for common delimiters
    const firstLineEnd = text.indexOf('\n');
    const firstLine = text.substring(0, firstLineEnd > -1 ? firstLineEnd : 500);
    const hasDelimiter = firstLine.includes(',') || firstLine.includes(';');

    if (e.data.isCSV || hasDelimiter) {
        const delimiter = firstLine.includes(';') ? ';' : ',';
        const headers = firstLine.split(delimiter).map((h: string) => h.trim().toLowerCase().replace(/["']/g, ''));
        const emailIndex = headers.findIndex((h: string) =>
            h === 'email' || h === 'e-mail' || h === 'mail' || h === 'email address' || h === 'emailaddress'
        );

        if (emailIndex >= 0) {
            const lines = text.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const cells = line.split(delimiter);
                    const cell = cells[emailIndex];
                    if (cell && cell.includes('@')) {
                        matches.push(cell.trim().replace(/["']/g, ''));
                    }
                }
            }
        }
    }

    // Fallback: regex scan for unstructured text
    if (matches.length === 0) {
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        matches = text.match(emailRegex) || [];
    }

    // Unique emails (case-insensitive)
    const uniqueEmails = Array.from(new Set(matches.map((email: string) => email.trim().toLowerCase())));

    let seqId = nextSequenceId || 1;
    const now = Date.now();

    const emails = uniqueEmails.map((email: string) => ({
        id: `${email}-${now}-${Math.random()}`,
        sequenceId: seqId++,
        email,
        isValid: true,
    }));

    self.postMessage({ emails, nextSequenceId: seqId });
};

export { };
