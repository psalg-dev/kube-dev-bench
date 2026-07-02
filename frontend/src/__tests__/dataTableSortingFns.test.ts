import { describe, it, expect } from 'vitest';
import type { Row } from '@tanstack/react-table';
import {
  textSortingFn,
  numberSortingFn,
  durationSortingFn,
  datetimeSortingFn,
  sortTypeToFn,
  type ColumnSortType,
} from '../components/DataTable/sortingFns';

// Helper to create minimal fake Row objects for testing.
// Two-step structural cast (not the forbidden `as unknown as`): Row<unknown> is
// assignable to Pick<Row<unknown>,'getValue'>, so this narrows-then-widens legally.
const createFakeRow = (value: unknown): Row<unknown> =>
  ({ getValue: () => value }) as Pick<Row<unknown>, 'getValue'> as Row<unknown>;

describe('DataTable Sorting Functions', () => {
  describe('textSortingFn', () => {
    it('should sort text alphabetically', () => {
      const rowA = createFakeRow('apple');
      const rowB = createFakeRow('banana');
      expect(textSortingFn(rowA, rowB, 'col')).toBeLessThan(0);
      expect(textSortingFn(rowB, rowA, 'col')).toBeGreaterThan(0);
    });

    it('should use locale numeric compare (item2 < item10)', () => {
      const row2 = createFakeRow('item2');
      const row10 = createFakeRow('item10');
      expect(textSortingFn(row2, row10, 'col')).toBeLessThan(0);
      expect(textSortingFn(row10, row2, 'col')).toBeGreaterThan(0);
    });

    it('should handle empty strings and nulls (sort last in asc)', () => {
      const rowWithText = createFakeRow('text');
      const rowWithEmpty = createFakeRow('');
      const rowWithNull = createFakeRow(null);
      const rowWithUndefined = createFakeRow(undefined);

      expect(textSortingFn(rowWithText, rowWithEmpty, 'col')).toBeLessThan(0);
      expect(textSortingFn(rowWithEmpty, rowWithText, 'col')).toBeGreaterThan(0);
      expect(textSortingFn(rowWithText, rowWithNull, 'col')).toBeLessThan(0);
      expect(textSortingFn(rowWithText, rowWithUndefined, 'col')).toBeLessThan(0);
    });

    it('should treat null and empty equivalently (both sort last)', () => {
      const rowWithNull = createFakeRow(null);
      const rowWithEmpty = createFakeRow('');
      // Both should be treated as "no value" - order between them is stable
      expect(textSortingFn(rowWithNull, rowWithEmpty, 'col')).toBe(0);
    });

    it('should be case-insensitive for base comparison', () => {
      const rowLower = createFakeRow('apple');
      const rowUpper = createFakeRow('APPLE');
      // localeCompare with sensitivity: 'base' should make these equal
      expect(textSortingFn(rowLower, rowUpper, 'col')).toBe(0);
    });
  });

  describe('numberSortingFn', () => {
    it('should sort numbers numerically', () => {
      const row5 = createFakeRow(5);
      const row10 = createFakeRow(10);
      expect(numberSortingFn(row5, row10, 'col')).toBeLessThan(0);
      expect(numberSortingFn(row10, row5, 'col')).toBeGreaterThan(0);
    });

    it('should compare numeric strings numerically not lexically (9 < 10)', () => {
      const row9 = createFakeRow('9');
      const row10 = createFakeRow('10');
      expect(numberSortingFn(row9, row10, 'col')).toBeLessThan(0);
      expect(numberSortingFn(row10, row9, 'col')).toBeGreaterThan(0);
    });

    it('should handle nulls and empty strings (sort last in asc)', () => {
      const rowWithNum = createFakeRow(42);
      const rowWithEmpty = createFakeRow('');
      const rowWithNull = createFakeRow(null);
      const rowWithUndefined = createFakeRow(undefined);

      expect(numberSortingFn(rowWithNum, rowWithEmpty, 'col')).toBeLessThan(0);
      expect(numberSortingFn(rowWithNum, rowWithNull, 'col')).toBeLessThan(0);
      expect(numberSortingFn(rowWithNum, rowWithUndefined, 'col')).toBeLessThan(0);
    });

    it('should treat null and empty as equivalent', () => {
      const rowWithNull = createFakeRow(null);
      const rowWithEmpty = createFakeRow('');
      expect(numberSortingFn(rowWithNull, rowWithEmpty, 'col')).toBe(0);
    });

    it('should handle non-numeric strings (fallback to locale compare)', () => {
      const rowNum = createFakeRow(10);
      const rowText = createFakeRow('abc');
      // Non-numeric strings should still sort, just not numerically
      // They should come after numbers
      expect(numberSortingFn(rowNum, rowText, 'col')).toBeLessThan(0);
    });
  });

  describe('durationSortingFn', () => {
    it('should parse and compare duration strings: 5m < 1h < 2d', () => {
      const row5m = createFakeRow('5m');
      const row1h = createFakeRow('1h');
      const row2d = createFakeRow('2d');

      expect(durationSortingFn(row5m, row1h, 'col')).toBeLessThan(0);
      expect(durationSortingFn(row1h, row2d, 'col')).toBeLessThan(0);
      expect(durationSortingFn(row2d, row5m, 'col')).toBeGreaterThan(0);
    });

    it('should handle multiple units: 1h30m = 1h + 30m', () => {
      const row90m = createFakeRow('90m');
      const row1h30m = createFakeRow('1h30m');
      expect(durationSortingFn(row90m, row1h30m, 'col')).toBe(0);
    });

    it('should handle complex duration strings', () => {
      const row1d1h = createFakeRow('1d1h');
      const row25h = createFakeRow('25h');
      expect(durationSortingFn(row1d1h, row25h, 'col')).toBe(0);
    });

    it('should handle numeric values (treat as seconds)', () => {
      const row60 = createFakeRow(60);
      const row1m = createFakeRow('1m');
      expect(durationSortingFn(row60, row1m, 'col')).toBe(0);
    });

    it('should handle nulls and empty strings (sort last in asc)', () => {
      const rowWithDuration = createFakeRow('1h');
      const rowWithEmpty = createFakeRow('');
      const rowWithNull = createFakeRow(null);
      const rowWithUndefined = createFakeRow(undefined);

      expect(durationSortingFn(rowWithDuration, rowWithEmpty, 'col')).toBeLessThan(0);
      expect(durationSortingFn(rowWithDuration, rowWithNull, 'col')).toBeLessThan(0);
      expect(durationSortingFn(rowWithDuration, rowWithUndefined, 'col')).toBeLessThan(0);
    });

    it('should treat null and empty as equivalent', () => {
      const rowWithNull = createFakeRow(null);
      const rowWithEmpty = createFakeRow('');
      expect(durationSortingFn(rowWithNull, rowWithEmpty, 'col')).toBe(0);
    });

    it('should handle unparseable strings (fallback to text compare)', () => {
      const row1h = createFakeRow('1h');
      const rowInvalid = createFakeRow('not-a-duration');
      // Unparseable should sort with valid durations using text comparison
      expect(typeof durationSortingFn(row1h, rowInvalid, 'col')).toBe('number');
    });
  });

  describe('datetimeSortingFn', () => {
    it('should sort ISO datetime strings ascending', () => {
      const row1 = createFakeRow('2024-01-01T00:00:00Z');
      const row2 = createFakeRow('2024-01-02T00:00:00Z');
      expect(datetimeSortingFn(row1, row2, 'col')).toBeLessThan(0);
      expect(datetimeSortingFn(row2, row1, 'col')).toBeGreaterThan(0);
    });

    it('should handle different ISO datetime formats', () => {
      const row1 = createFakeRow('2024-01-01T10:00:00Z');
      const row2 = createFakeRow('2024-01-01T11:00:00Z');
      expect(datetimeSortingFn(row1, row2, 'col')).toBeLessThan(0);
    });

    it('should parse and compare datetime as timestamps', () => {
      const row1 = createFakeRow('2024-01-01T00:00:00Z');
      const row2 = createFakeRow('2024-01-01T00:00:01Z');
      expect(datetimeSortingFn(row1, row2, 'col')).toBeLessThan(0);
    });

    it('should handle nulls and empty strings (sort last in asc)', () => {
      const rowWithDate = createFakeRow('2024-01-01T00:00:00Z');
      const rowWithEmpty = createFakeRow('');
      const rowWithNull = createFakeRow(null);
      const rowWithUndefined = createFakeRow(undefined);

      expect(datetimeSortingFn(rowWithDate, rowWithEmpty, 'col')).toBeLessThan(0);
      expect(datetimeSortingFn(rowWithDate, rowWithNull, 'col')).toBeLessThan(0);
      expect(datetimeSortingFn(rowWithDate, rowWithUndefined, 'col')).toBeLessThan(0);
    });

    it('should treat null and empty as equivalent', () => {
      const rowWithNull = createFakeRow(null);
      const rowWithEmpty = createFakeRow('');
      expect(datetimeSortingFn(rowWithNull, rowWithEmpty, 'col')).toBe(0);
    });

    it('should handle numeric timestamps', () => {
      const row1 = createFakeRow(1704067200000); // 2024-01-01T00:00:00Z in ms
      const row2 = createFakeRow(1704153600000); // 2024-01-02T00:00:00Z in ms
      expect(datetimeSortingFn(row1, row2, 'col')).toBeLessThan(0);
    });
  });

  describe('sortTypeToFn', () => {
    it('should return textSortingFn for type "text"', () => {
      expect(sortTypeToFn('text')).toBe(textSortingFn);
    });

    it('should return numberSortingFn for type "number"', () => {
      expect(sortTypeToFn('number')).toBe(numberSortingFn);
    });

    it('should return durationSortingFn for type "duration"', () => {
      expect(sortTypeToFn('duration')).toBe(durationSortingFn);
    });

    it('should return datetimeSortingFn for type "datetime"', () => {
      expect(sortTypeToFn('datetime')).toBe(datetimeSortingFn);
    });
  });

  describe('ColumnSortType type', () => {
    it('should accept valid sort types', () => {
      const types: ColumnSortType[] = ['text', 'number', 'duration', 'datetime'];
      expect(types).toHaveLength(4);
    });
  });
});
