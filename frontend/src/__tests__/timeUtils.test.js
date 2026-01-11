import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatAge, formatRelativeTime } from '../utils/timeUtils';

describe('timeUtils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-11T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatAge', () => {
    it('returns - for empty/invalid values', () => {
      expect(formatAge(null)).toBe('-');
      expect(formatAge(undefined)).toBe('-');
      expect(formatAge('not-a-date')).toBe('-');
    });

    it('formats seconds/minutes/hours/days', () => {
      expect(formatAge(new Date('2026-01-11T00:00:00.000Z'))).toBe('0s');
      expect(formatAge(new Date('2026-01-10T23:59:30.000Z'))).toBe('30s');
      expect(formatAge(new Date('2026-01-10T23:59:00.000Z'))).toBe('1m');
      expect(formatAge(new Date('2026-01-10T23:58:00.000Z'))).toBe('2m');
      expect(formatAge(new Date('2026-01-10T23:00:00.000Z'))).toBe('1h');
      expect(formatAge(new Date('2026-01-09T00:00:00.000Z'))).toBe('2d');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns - for empty/invalid values', () => {
      expect(formatRelativeTime(null)).toBe('-');
      expect(formatRelativeTime(undefined)).toBe('-');
      expect(formatRelativeTime('not-a-date')).toBe('-');
    });

    it('formats recent times with friendly phrasing', () => {
      expect(formatRelativeTime(new Date('2026-01-11T00:00:00.000Z'))).toBe('just now');
      expect(formatRelativeTime(new Date('2026-01-10T23:59:00.000Z'))).toBe('1 minute ago');
      expect(formatRelativeTime(new Date('2026-01-10T23:58:00.000Z'))).toBe('2 minutes ago');
      expect(formatRelativeTime(new Date('2026-01-10T23:00:00.000Z'))).toBe('1 hour ago');
      expect(formatRelativeTime(new Date('2026-01-10T22:00:00.000Z'))).toBe('2 hours ago');
      expect(formatRelativeTime(new Date('2026-01-10T00:00:00.000Z'))).toBe('yesterday');
      expect(formatRelativeTime(new Date('2026-01-08T00:00:00.000Z'))).toBe('3 days ago');
    });
  });
});
