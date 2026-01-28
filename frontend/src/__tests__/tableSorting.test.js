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
      expect(getColumnKey(null)).toBe('');
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
      expect(pickDefaultSortKey(undefined)).toBe('');
    });

    it('returns empty string for non-array input', () => {
      expect(pickDefaultSortKey('not an array')).toBe('');
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
      expect(sortRows('not an array', 'name')).toEqual([]);
      expect(sortRows(null, 'name')).toEqual([]);
      expect(sortRows(undefined, 'name')).toEqual([]);
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
      const rowsWithUndefined = [{ name: 'Charlie' }, {}, { name: 'Alice' }];
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
      const getValue = (row) => row.data.value;
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
        const rows = [{ age: '2d' }, { age: '1h' }, { age: '30m' }];
        const sorted = sortRows(rows, 'age', 'asc');
        expect(sorted.map((r) => r.age)).toEqual(['30m', '1h', '2d']);
      });

      it('handles complex duration strings', () => {
        const rows = [{ age: '1d 12h' }, { age: '2d' }, { age: '36h' }];
        const sorted = sortRows(rows, 'age', 'asc');
        // 36h = 1.5d, 1d12h = 1.5d, 2d = 2d
        // So order should be: 36h, 1d12h, 2d (ascending)
        expect(sorted[2].age).toBe('2d');
      });

      it('handles seconds and minutes', () => {
        const rows = [{ age: '90s' }, { age: '1m' }, { age: '2m' }];
        const sorted = sortRows(rows, 'age', 'asc');
        expect(sorted.map((r) => r.age)).toEqual(['1m', '90s', '2m']);
      });
    });

    describe('date parsing', () => {
      it('sorts ISO date strings correctly', () => {
        const rows = [
          { created: '2024-01-15T10:00:00Z' },
          { created: '2024-01-01T10:00:00Z' },
          { created: '2024-01-30T10:00:00Z' },
        ];
        const sorted = sortRows(rows, 'created', 'asc');
        expect(sorted[0].created).toBe('2024-01-01T10:00:00Z');
        expect(sorted[2].created).toBe('2024-01-30T10:00:00Z');
      });
    });

    describe('numeric string parsing', () => {
      it('sorts numeric strings numerically', () => {
        const rows = [{ count: '10' }, { count: '2' }, { count: '1' }];
        const sorted = sortRows(rows, 'count', 'asc');
        expect(sorted.map((r) => r.count)).toEqual(['1', '2', '10']);
      });
    });
  });

  describe('toggleSortState', () => {
    it('returns asc direction for new key', () => {
      const result = toggleSortState({ key: 'name', direction: 'asc' }, 'age');
      expect(result).toEqual({ key: 'age', direction: 'asc' });
    });

    it('toggles from asc to desc for same key', () => {
      const result = toggleSortState({ key: 'name', direction: 'asc' }, 'name');
      expect(result).toEqual({ key: 'name', direction: 'desc' });
    });

    it('toggles from desc to asc for same key', () => {
      const result = toggleSortState(
        { key: 'name', direction: 'desc' },
        'name',
      );
      expect(result).toEqual({ key: 'name', direction: 'asc' });
    });

    it('returns current state when key is empty', () => {
      const current = { key: 'name', direction: 'asc' };
      const result = toggleSortState(current, '');
      expect(result).toBe(current);
    });

    it('returns current state when key is undefined', () => {
      const current = { key: 'name', direction: 'asc' };
      const result = toggleSortState(current, undefined);
      expect(result).toBe(current);
    });

    it('handles undefined current state', () => {
      const result = toggleSortState(undefined, 'name');
      expect(result).toEqual({ key: 'name', direction: 'asc' });
    });

    it('handles null current state', () => {
      const result = toggleSortState(null, 'name');
      expect(result).toEqual({ key: 'name', direction: 'asc' });
    });
  });
});
