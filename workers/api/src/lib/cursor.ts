import { InvalidCursorError } from '../db/errors';

const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Base64URL string encoder (RFC 4648 §5)
 */
function toBase64Url(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL string decoder (RFC 4648 §5)
 */
function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return atob(base64);
}

export interface DecodedCursor {
  createdAt: string;
  id: string;
}

/**
 * Encodes a versioned (v1) cursor using RFC3339 timestamp and entity ID.
 */
export function encodeCursor(createdAt: string, id: string): string {
  if (!createdAt || !id) {
    throw new InvalidCursorError('Cannot encode cursor with empty createdAt or id');
  }
  const payload = `v1:${createdAt}:${id}`;
  return toBase64Url(payload);
}

/**
 * Decodes and strictly validates a versioned (v1) cursor.
 * Throws InvalidCursorError on any validation, decoding or format failure.
 */
export function decodeCursor(cursor: string): DecodedCursor {
  if (typeof cursor !== 'string' || cursor.trim().length === 0) {
    throw new InvalidCursorError('Cursor must be a non-empty string');
  }

  if (cursor.length > 512) {
    throw new InvalidCursorError('Cursor exceeds maximum allowed length');
  }

  let decodedText: string;
  try {
    decodedText = fromBase64Url(cursor.trim());
  } catch {
    throw new InvalidCursorError('Cursor is not valid Base64URL');
  }

  const parts = decodedText.split(':');
  if (parts.length < 3) {
    throw new InvalidCursorError('Cursor structure is invalid or missing required segments');
  }

  const version = parts[0];
  if (version !== 'v1') {
    throw new InvalidCursorError(`Unsupported cursor version: ${version}`);
  }

  // Handle ISO strings that might have colons (e.g. 2026-08-30T10:00:00.000Z or timezones)
  // v1:<createdAt>:<id>
  const id = parts[parts.length - 1];
  const createdAt = parts.slice(1, parts.length - 1).join(':');

  if (!id || id.trim().length === 0 || id.length > 128) {
    throw new InvalidCursorError('Cursor ID is invalid or empty');
  }

  if (!createdAt || !RFC3339_REGEX.test(createdAt) || isNaN(Date.parse(createdAt))) {
    throw new InvalidCursorError('Cursor createdAt is not a valid RFC3339 timestamp');
  }

  return {
    createdAt,
    id,
  };
}
