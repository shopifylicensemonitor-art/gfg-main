/**
 * Anti-spam Mailto Randomizer Utility
 * Generates unique, non-deterministic mailto links to bypass spam tracking.
 */

function getDeviceEntropy(): number {
  let entropy = 0;
  if (typeof window !== 'undefined') {
    entropy += window.screen.width * 13 + window.screen.height * 7;
    entropy += window.screen.colorDepth || 24;
    entropy += (window.navigator.hardwareConcurrency || 4) * 31;
    entropy += (window.navigator.language || 'en').charCodeAt(0) * 17;
    entropy += (window.navigator.userAgent || '').length * 3;
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      for (let i = 0; i < tz.length; i++) {
        entropy += tz.charCodeAt(i) * (i + 1);
      }
    } catch (e) {
      // Ignore timezone resolution errors
    }
  }
  return entropy;
}

class SeededRandom {
  private state: number;

  constructor() {
    const deviceSeed = getDeviceEntropy();
    const timeSeed = Date.now() + Math.floor(performance.now() * 1000);
    let cryptoSeed = 0;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      cryptoSeed = arr[0];
    } else {
      cryptoSeed = Math.floor(Math.random() * 1000000);
    }
    this.state = (deviceSeed ^ timeSeed ^ cryptoSeed) >>> 0;
  }

  // Returns a random float between 0 and 1
  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0xffffffff;
  }

  // Returns a random integer in range [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Shuffle an array in-place
  shuffle<T>(arr: T[]): T[] {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = newArr[i];
      newArr[i] = newArr[j];
      newArr[j] = temp;
    }
    return newArr;
  }
}

/**
 * Custom URL Encoder that encodes spaces strictly as %20 (avoiding client-breaking '+') and randomizes formatting sequences
 */
function encodeValue(val: string, rand: SeededRandom): string {
  // Split into lines to allow line-break customization
  const lines = val.split('\n');
  const encodedLines = lines.map(line => {
    // Process character-by-character for space encoding variations
    let result = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === ' ' || char === '\u00A0') {
        // Space must be encoded strictly as %20 in mailto URLs per RFC 6068. Using '+' breaks rendering in many 
        // major email clients (like Gmail or Outlook), showing up literally as '+' in the subject and body. 
        // We also normalize non-breaking spaces (\u00A0) here.
        result += '%20';
      } else {
        result += encodeURIComponent(char);
      }
    }
    return result;
  });

  // Randomize newline character sequences: %0A, %0D%0A, or with an occasional zero-width space
  const newlineSeq = rand.next() > 0.5 ? '%0D%0A' : '%0A';
  return encodedLines.join(newlineSeq);
}

interface BuildMailtoParams {
  recipient: string;
  subject: string;
  body: string;
  cc: string;
  bcc: string;
  myInboxTo: string;
  ccRoutingMode: 'reroute' | 'normal';
  enableRandom: boolean;
}

export function buildMailtoLink({
  recipient,
  subject,
  body,
  cc,
  bcc,
  myInboxTo,
  ccRoutingMode,
  enableRandom,
}: BuildMailtoParams): string {
  const rand = new SeededRandom();

  // 1. Resolve CC Routing Mode
  let finalCc = typeof cc === 'string' ? cc.trim() : '';
  let finalBcc = typeof bcc === 'string' ? bcc.trim() : '';

  if (finalCc && ccRoutingMode === 'reroute') {
    // Append CC recipient to BCC list instead
    if (finalBcc) {
      finalBcc = `${finalBcc},${finalCc}`;
    } else {
      finalBcc = finalCc;
    }
    finalCc = '';
  }

  // 2. Resolve To (My Inbox) Rerouting
  let finalRecipient = typeof recipient === 'string' ? recipient.trim() : '';
  const myInbox = typeof myInboxTo === 'string' ? myInboxTo.trim() : '';

  if (myInbox) {
    // Target recipient goes to BCC
    if (finalBcc) {
      finalBcc = `${finalBcc},${finalRecipient}`;
    } else {
      finalBcc = finalRecipient;
    }
    // Main recipient becomes My Inbox
    finalRecipient = myInbox;
  }

  // 3. Process subject and body content variations (if randomization enabled)
  let processedSubject = subject;
  let processedBody = body;

  if (enableRandom) {
    // Add varying trailing whitespaces/zero-width space to subject
    const subjectTrail = rand.next() > 0.5 ? '\u200B' : '';
    const subjectSpaces = ' '.repeat(rand.nextInt(0, 2));
    processedSubject = subject + subjectSpaces + subjectTrail;

    // Add varying trailing whitespaces/zero-width space to body
    const bodyTrail = rand.next() > 0.5 ? '\u200B' : '';
    const bodySpaces = ' '.repeat(rand.nextInt(0, 3));
    const bodyNewlines = '\n'.repeat(rand.nextInt(0, 1));
    processedBody = body + bodyNewlines + bodySpaces + bodyTrail;
  }

  // 4. Build query params list
  interface Param {
    key: string;
    value: string;
  }

  let params: Param[] = [];
  if (processedSubject) params.push({ key: 'subject', value: processedSubject });
  if (processedBody) params.push({ key: 'body', value: processedBody });
  if (finalCc) params.push({ key: 'cc', value: finalCc });
  if (finalBcc) params.push({ key: 'bcc', value: finalBcc });

  // 5. Shuffle parameters if randomization enabled
  if (enableRandom) {
    params = rand.shuffle(params);
  }

  const cleanRecipient = finalRecipient.replace(/\s+/g, '');

  // 6. Encode and construct the query string
  if (params.length === 0) {
    return `mailto:${cleanRecipient}`;
  }

  const queryString = params
    .map(p => {
      // Capitalize keys randomly if desired, but mail clients can be strict.
      // We vary encoding style and param order instead.
      const valEncoded = enableRandom ? encodeValue(p.value, rand) : encodeURIComponent(p.value);
      return `${p.key}=${valEncoded}`;
    })
    .join('&');

  return `mailto:${cleanRecipient}?${queryString}`;
}
