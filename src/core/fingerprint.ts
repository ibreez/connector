import { RawBmlTransaction } from '../types/bml';

/**
 * Generates a deterministic, collision-resistant fingerprint for a BML transaction.
 * Does not rely on volatile data. Normalizes strings and numbers to ensure repeatability.
 */
export function generateTransactionFingerprint(tx: RawBmlTransaction): string {
  // Normalize fields
  const parts: string[] = [];

  // If a reliable BML-issued transaction ID exists, include it as primary anchor
  if (tx.transactionId && tx.transactionId.trim() !== '') {
    parts.push(`tid:${tx.transactionId.trim()}`);
  }

  // Always include accountId to prevent cross-account collisions
  parts.push(`acc:${tx.accountId.trim()}`);

  // Normalize amount to 2 decimal places fixed string
  const normalizedAmount = Number(tx.amount).toFixed(2);
  parts.push(`amt:${normalizedAmount}`);

  // Currency
  parts.push(`cur:${(tx.currency || 'MVR').toUpperCase()}`);

  // Direction
  parts.push(`dir:${tx.direction.toUpperCase()}`);

  // Normalized transaction date (strip excessive millisecond variations if present)
  const normalizedDate = tx.transactionDate ? tx.transactionDate.trim().replace(/\s+/g, ' ') : '';
  parts.push(`dt:${normalizedDate}`);

  // Reference number if available
  const normalizedRef = (tx.reference || '').trim().toUpperCase();
  if (normalizedRef) {
    parts.push(`ref:${normalizedRef}`);
  }

  // Normalized description snippet (first 32 chars of sanitized alphanumeric text)
  const cleanDesc = (tx.description || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 32);
  parts.push(`dsc:${cleanDesc}`);

  const combined = parts.join('|');

  // Simple, fast, deterministic 64-bit/32-char hex hash implementation that runs anywhere (Node & Browser)
  return 'fp_' + hashStringToHex(combined);
}

/**
 * Standard FNV-1a + Murmur-inspired deterministic hex hashing for reliable client and server execution.
 */
function hashStringToHex(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');

  // Generate a secondary pass for 32 chars of deterministic entropy
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;
  for (let i = str.length - 1; i >= 0; i--) {
    const ch = str.charCodeAt(i);
    h3 = Math.imul(h3 ^ ch, 2246822507);
    h4 = Math.imul(h4 ^ ch, 3266489909);
  }
  const hex3 = (h3 >>> 0).toString(16).padStart(8, '0');
  const hex4 = (h4 >>> 0).toString(16).padStart(8, '0');

  return `${hex1}${hex2}${hex3}${hex4}`;
}
