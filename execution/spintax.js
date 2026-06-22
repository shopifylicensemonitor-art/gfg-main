/**
 * Deterministic spintax parser.
 * Handles nested spintax blocks: e.g. "{Hi|Hello {there|friend}}"
 */
function parseSpintax(text) {
  if (!text) return '';

  // Match the innermost spintax blocks first: curly braces containing a pipe |
  const regex = /\{([^{}]*\|[^{}]*)\}/;
  let match;
  let result = text;

  while ((match = result.match(regex))) {
    const options = match[1].split('|');
    const chosen = options[Math.floor(Math.random() * options.length)];
    result = result.substring(0, match.index) + chosen + result.substring(match.index + match[0].length);
  }

  return result;
}

module.exports = { parseSpintax };
