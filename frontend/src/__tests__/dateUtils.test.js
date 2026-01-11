import { describe, it, expect } from 'vitest';
import { formatDateDMY, formatTimestampDMYHMS } from '../utils/dateUtils';

describe('dateUtils', () => {
  it('formatDateDMY returns - for empty/invalid values', () => {
    expect(formatDateDMY(null)).toBe('-');
    expect(formatDateDMY(undefined)).toBe('-');
    expect(formatDateDMY('not-a-date')).toBe('-');
  });

  it('formatDateDMY formats dd.mm.yyyy', () => {
    const d = new Date(2026, 0, 11, 12, 34, 56); // local time
    expect(formatDateDMY(d)).toBe('11.01.2026');
    expect(formatDateDMY(d.getTime())).toBe('11.01.2026');
  });

  it('formatTimestampDMYHMS returns - for empty/invalid values', () => {
    expect(formatTimestampDMYHMS(null)).toBe('-');
    expect(formatTimestampDMYHMS(undefined)).toBe('-');
    expect(formatTimestampDMYHMS('not-a-date')).toBe('-');
  });

  it('formatTimestampDMYHMS formats dd.mm.yyyy HH:mm:ss', () => {
    const d = new Date(2026, 0, 11, 1, 2, 3); // local time
    expect(formatTimestampDMYHMS(d)).toBe('11.01.2026 01:02:03');
    expect(formatTimestampDMYHMS(d.getTime())).toBe('11.01.2026 01:02:03');
  });
});
