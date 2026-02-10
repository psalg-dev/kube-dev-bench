import { describe, it, expect } from 'vitest';
import {
  getColumnKey,
  pickDefaultSortKey,
  sortRows,
  toggleSortState,
} from '../utils/tableSorting';

describe('tableSorting', () => {
  describe('getColumnKey', () => {
    it('returns accessorKey when present', () => {
      expect(getColumnKey({ accessorKey: 'name', key: 'other' })).toBe('name');
    });

    it('returns key when accessorKey is not present', () => {
      expect(getColumnKey({ key: 'status' })).toBe('status');
    });

    it('returns id when key and accessorKey are not present', () => {
      expect(getColumnKey({ id: 'age' })).toBe('age');
    });

    it('returns name as fallback', () => {
      expect(getColumnKey({ name: 'column1' })).toBe('column1');
    });

    it('returns empty string for undefined column', () => {
      expect(getColumnKey(undefined)).toBe('');
    });

    it('returns empty string for null column', () => {
      expect(getColumnKey(null as unknown as Parameters<typeof getColumnKey>[0])).toBe('');
    });

    it('returns empty string for column without any key properties', () => {
      expect(getColumnKey({})).toBe('');
    });

    it('converts non-string keys to string', () => {
      expect(getColumnKey({ accessorKey: 123 })).toBe('123');
    });
  });

  describe('pickDefaultSortKey', () => {
    it('prefers age column for default sort', () => {
      const columns = [
        { accessorKey: 'name' },
        { accessorKey: 'age' },
        { accessorKey: 'status' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('age');
    });

    it('picks name column when no age column exists', () => {
      const columns = [
        { accessorKey: 'status' },
        { accessorKey: 'name' },
        { accessorKey: 'type' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('name');
    });

    it('picks first column when no age or name columns exist', () => {
      const columns = [
        { accessorKey: 'status' },
        { accessorKey: 'type' },
        { accessorKey: 'version' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('status');
    });

    it('returns empty string for empty array', () => {
      expect(pickDefaultSortKey([])).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(pickDefaultSortKey(undefined as unknown as Parameters<typeof pickDefaultSortKey>[0])).toBe('');
    });

    it('returns empty string for non-array input', () => {
      expect(pickDefaultSortKey('not an array' as unknown as Parameters<typeof pickDefaultSortKey>[0])).toBe('');
    });

    it('matches age in column label', () => {
      const columns = [
        { accessorKey: 'col1', label: 'Status' },
        { accessorKey: 'col2', label: 'Age' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('col2');
    });

    it('matches name in column header', () => {
      const columns = [
        { accessorKey: 'col1', header: 'Status' },
        { accessorKey: 'col2', header: 'Name' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('col2');
    });

    it('is case insensitive for age matching', () => {
      const columns = [
        { accessorKey: 'createdAge', label: 'Created AGE' },
        { accessorKey: 'status' },
      ];
      expect(pickDefaultSortKey(columns)).toBe('createdAge');
    });
  });

  describe('sortRows', () => {
    const sampleRows = [
      { name: 'Charlie', age: 30 },
      { name: 'Alice', age: 25 },
      { name: 'Bob', age: 35 },
    ];

    it('sorts rows by string column ascending', () => {
      const sorted = sortRows(sampleRows, 'name', 'asc');
      expect(sorted.map((r) => r.name)).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('sorts rows by string column descending', () => {
      const sorted = sortRows(sampleRows, 'name', 'desc');
      expect(sorted.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'Alice']);
    });

    it('sorts rows by numeric column ascending', () => {
      const sorted = sortRows(sampleRows, 'age', 'asc');
      expect(sorted.map((r) => r.age)).toEqual([25, 30, 35]);
    });

    it('sorts rows by numeric column descending', () => {
      const sorted = sortRows(sampleRows, 'age', 'desc');
      expect(sorted.map((r) => r.age)).toEqual([35, 30, 25]);
    });

    it('returns empty array for non-array input', () => {
      expect(sortRows('not an array' as unknown as Array<unknown>, 'name')).toEqual([]);
      expect(sortRows(null as unknown as Array<unknown>, 'name')).toEqual([]);
      expect(sortRows(undefined as unknown as Array<unknown>, 'name')).toEqual([]);
    });

    it('returns original rows when sortKey is empty', () => {
      const sorted = sortRows(sampleRows, '', 'asc');
      expect(sorted).toEqual(sampleRows);
    });

    it('handles null values in sort column', () => {
      const rowsWithNull = [
        { name: 'Charlie' },
        { name: null },
        { name: 'Alice' },
      ];
      const sorted = sortRows(rowsWithNull, 'name', 'asc');
      expect(sorted.map((r) => r.name)).toEqual(['Alice', 'Charlie', null]);
    });

    it('handles undefined values in sort column', () => {
      const rowsWithUndefined = [
        { name: 'Charlie' },
        {},
        { name: 'Alice' },
      ];
      const sorted = sortRows(rowsWithUndefined, 'name', 'asc');
      expect(sorted[0].name).toBe('Alice');
      expect(sorted[1].name).toBe('Charlie');
    });

    it('uses custom getValue function when provided', () => {
      const rows = [
        { data: { value: 3 } },
        { data: { value: 1 } },
        { data: { value: 2 } },
      ];
      const getValue = (row: { data: { value: number } }) => row.data.value;
      const sorted = sortRows(rows, 'ignored', 'asc', getValue);
      expect(sorted.map((r) => r.data.value)).toEqual([1, 2, 3]);
    });

    it('maintains stable sort order for equal values', () => {
      const rows = [
        { name: 'A', id: 1 },
        { name: 'A', id: 2 },
        { name: 'A', id: 3 },
      ];
      const sorted = sortRows(rows, 'name', 'asc');
      expect(sorted.map((r) => r.id)).toEqual([1, 2, 3]);
    });

    describe('duration parsing', () => {
      it('sorts duration strings correctly for age column', () => {
        const rows = [
          { age: '2d' },
          { age: '1h' },
          { age: '30m' },
        ];
        const sorted = sortRows(rows, 'age', 'asc');
        expect(sorted.map((r) => r.age)).toEqual(['30m', '1h', '2d']);
      });

      it('handles complex duration strings', () => {
        const rows = [
          { age: '1d 3h 20m' },
          { age: '2h 10m' },
          { age: '4d 1h' },
        ];
        const sorted = sortRows(rows, 'age', 'asc');
        expect(sorted.map((r) => r.age)).toEqual(['2h 10m', '1d 3h 20m', '4d 1h']);
      });

      it('treats unknown formats as strings', () => {
        const rows = [
          { age: 'unknown' },
          { age: '2d' },
          { age: 'zzz' },
        ];
        const sorted = sortRows(rows, 'age', 'asc');
        expect(sorted.map((r) => r.age)).toEqual(['2d', 'unknown', 'zzz']);
      });
    });
  });

  describe('toggleSortState', () => {
    it('returns existing state when key is empty', () => {
      expect(toggleSortState({ key: 'name', direction: 'asc' }, '')).toEqual({ key: 'name', direction: 'asc' });
    });

    it('sets asc when selecting a new key', () => {
      expect(toggleSortState({ key: 'name', direction: 'desc' }, 'age')).toEqual({ key: 'age', direction: 'asc' });
    });

    it('toggles direction when selecting same key', () => {
      expect(toggleSortState({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
      expect(toggleSortState({ key: 'name', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
    });
  });
});
