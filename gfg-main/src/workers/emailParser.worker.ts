// Web Worker for parsing emails from large files
const extractEmailsFromText = (text: string): string[] => {
    if (!text) return [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map(email => email.trim().toLowerCase())));
};

self.onmessage = (e: MessageEvent<{ text: string }>) => {
    try {
        const { text } = e.data;

        // Extract emails
        const emails = extractEmailsFromText(text);

        // Send results back to main thread
        self.postMessage({
            type: 'success',
            emails,
            count: emails.length
        });
    } catch (error) {
        // Send error back to main thread
        self.postMessage({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

export { };
