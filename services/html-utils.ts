/**
 * HTML utility functions for decoding entities and cleaning text
 */

/**
 * Decode HTML entities in text
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#039;': "'",  // Common apostrophe entity
    '&apos;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&laquo;': '«',
    '&raquo;': '»',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™'
  };

  let decoded = text;
  
  // Replace named entities
  Object.entries(entities).forEach(([entity, replacement]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), replacement);
  });
  
  // Replace numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, num) => {
    return String.fromCharCode(parseInt(num, 10));
  });
  
  // Replace hex entities
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  return decoded;
}

/**
 * Clean and decode title text for display
 */
export function cleanDisplayTitle(title: string | undefined | null): string {
  if (!title) return '';
  
  // First decode HTML entities
  let cleaned = decodeHtmlEntities(title);
  
  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Clean and decode description/content text for display
 */
export function cleanDisplayText(text: string | undefined | null): string {
  if (!text) return '';
  
  // First decode HTML entities
  let cleaned = decodeHtmlEntities(text);
  
  // Clean up extra whitespace but preserve line breaks
  cleaned = cleaned.replace(/[ \t]+/g, ' ').trim();
  
  return cleaned;
}
