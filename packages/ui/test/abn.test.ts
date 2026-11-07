import { describe, expect, it } from 'vitest';
import { abnError, isValidAbn, normaliseAbn } from '../src/abn';

describe('abn', () => {
  it('accepts a well-formed ABN with or without spaces', () => {
    expect(isValidAbn('51 824 753 556')).toBe(true);
    expect(isValidAbn('51824753556')).toBe(true);
    expect(abnError('51 824 753 556')).toBeNull();
  });
  it('refuses wrong checksums, wrong lengths and empty input', () => {
    expect(isValidAbn('12345678901')).toBe(false);
    expect(abnError('')).toBe('Enter your ABN');
    expect(abnError('123')).toBe('An ABN has 11 digits');
    expect(abnError('12345678901')).toMatch(/does not look right/);
  });
  it('normalises to digits only', () => {
    expect(normaliseAbn('51 824-753.556')).toBe('51824753556');
  });
});
