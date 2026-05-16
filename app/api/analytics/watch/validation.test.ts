import { describe, expect, it } from 'vitest';
import {
  isOriginAllowed,
  isValidCellId,
  isValidSessionId,
  isWatchEvent,
  sanitizeString,
  VALID_CELL_IDS,
} from './validation';

describe('isWatchEvent', () => {
  it('accepts the three known events', () => {
    expect(isWatchEvent('start')).toBe(true);
    expect(isWatchEvent('ping')).toBe(true);
    expect(isWatchEvent('end')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isWatchEvent('')).toBe(false);
    expect(isWatchEvent('Start')).toBe(false); // case-sensitive
    expect(isWatchEvent('startup')).toBe(false);
    expect(isWatchEvent(null)).toBe(false);
    expect(isWatchEvent(undefined)).toBe(false);
    expect(isWatchEvent(0)).toBe(false);
    expect(isWatchEvent({})).toBe(false);
  });
});

describe('isValidSessionId', () => {
  it('accepts URL-safe ids 8-64 chars', () => {
    expect(isValidSessionId('abcdef12')).toBe(true);
    expect(isValidSessionId('a'.repeat(64))).toBe(true);
    expect(isValidSessionId('A_b-1234')).toBe(true);
    expect(isValidSessionId('cf7e6d8e9a4b4f3aa1b2c3d4e5f60718')).toBe(true); // typical hex uuid
  });

  it('rejects too short / too long / bad chars', () => {
    expect(isValidSessionId('short')).toBe(false); // 5 chars
    expect(isValidSessionId('a'.repeat(65))).toBe(false);
    expect(isValidSessionId('with spaces')).toBe(false);
    expect(isValidSessionId('semi;colon')).toBe(false);
    expect(isValidSessionId('quotes"in"id')).toBe(false);
    expect(isValidSessionId("'or'1'='1")).toBe(false); // basic SQLi probe
  });

  it('rejects non-strings', () => {
    expect(isValidSessionId(null)).toBe(false);
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId(12345678)).toBe(false);
    expect(isValidSessionId({ length: 8 })).toBe(false);
  });
});

describe('isValidCellId', () => {
  it('accepts the configured cell ids', () => {
    for (const id of VALID_CELL_IDS) expect(isValidCellId(id)).toBe(true);
  });

  it('rejects unknown ids and non-strings', () => {
    expect(isValidCellId('cell-99')).toBe(false);
    expect(isValidCellId('')).toBe(false);
    expect(isValidCellId(null)).toBe(false);
    expect(isValidCellId(undefined)).toBe(false);
    expect(isValidCellId(1)).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('trims and returns the string when non-empty', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('returns null for empty / whitespace / non-strings', () => {
    expect(sanitizeString('')).toBeNull();
    expect(sanitizeString('   ')).toBeNull();
    expect(sanitizeString(null)).toBeNull();
    expect(sanitizeString(undefined)).toBeNull();
    expect(sanitizeString(42)).toBeNull();
  });

  it('truncates to the max length', () => {
    expect(sanitizeString('x'.repeat(500), 100)?.length).toBe(100);
  });

  it('default max is 200', () => {
    expect(sanitizeString('x'.repeat(500))?.length).toBe(200);
  });
});

describe('isOriginAllowed', () => {
  it('accepts everything when allowlist is empty (dev default)', () => {
    expect(isOriginAllowed([], null, null)).toBe(true);
    expect(isOriginAllowed([], 'https://evil.example', null)).toBe(true);
  });

  it('accepts matching Origin header', () => {
    expect(
      isOriginAllowed(
        ['https://jesusvive.church'],
        'https://jesusvive.church',
        null,
      ),
    ).toBe(true);
  });

  it('rejects non-matching Origin header', () => {
    expect(
      isOriginAllowed(
        ['https://jesusvive.church'],
        'https://evil.example',
        'https://jesusvive.church/ao-vivo/saopaulo',
      ),
    ).toBe(false);
  });

  it('falls back to Referer when Origin is absent', () => {
    expect(
      isOriginAllowed(
        ['https://jesusvive.church'],
        null,
        'https://jesusvive.church/ao-vivo/saopaulo',
      ),
    ).toBe(true);
  });

  it('rejects when both Origin and Referer are absent', () => {
    expect(isOriginAllowed(['https://jesusvive.church'], null, null)).toBe(false);
  });

  it('rejects malformed Referer', () => {
    expect(
      isOriginAllowed(['https://jesusvive.church'], null, 'not a url'),
    ).toBe(false);
  });

  it('supports multiple allowed origins', () => {
    const allowed = ['https://jesusvive.church', 'https://staging.jesusvive.church'];
    expect(isOriginAllowed(allowed, 'https://staging.jesusvive.church', null)).toBe(true);
    expect(isOriginAllowed(allowed, 'https://other.example', null)).toBe(false);
  });
});
