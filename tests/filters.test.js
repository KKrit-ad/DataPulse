/**
 * tests/filters.test.js
 * Unit tests for filterData — covers categorical, numeric, date filters
 * and drilldown logic including the YYYY-MM partial date match.
 */
import { describe, it, expect } from 'vitest';
import { filterData } from '../lib/filters.js';
import { analyzeColumns } from '../lib/core.js';

const salesData = [
  { Date: '2023-01-10', Region: 'North', Category: 'Electronics', Revenue: 1000, Units: 5 },
  { Date: '2023-01-25', Region: 'South', Category: 'Apparel',     Revenue: 500,  Units: 2 },
  { Date: '2023-02-14', Region: 'North', Category: 'Electronics', Revenue: 1500, Units: 8 },
  { Date: '2023-03-05', Region: 'East',  Category: 'Sports',      Revenue: 800,  Units: 3 },
  { Date: '2023-03-20', Region: 'North', Category: 'Sports',      Revenue: 600,  Units: 4 },
];
const columns = analyzeColumns(salesData);

// ─────────────────────────────────────────────────────────
// Categorical filter
// ─────────────────────────────────────────────────────────
describe('filterData — categorical filter', () => {
  it('filters by single category value', () => {
    const result = filterData(salesData, { Region: ['North'] }, {}, columns);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.Region === 'North')).toBe(true);
  });

  it('filters by multiple category values', () => {
    const result = filterData(salesData, { Region: ['North', 'South'] }, {}, columns);
    expect(result).toHaveLength(4);
  });

  it('returns all rows when filter is empty array', () => {
    const result = filterData(salesData, { Region: [] }, {}, columns);
    expect(result).toHaveLength(5);
  });

  it('returns empty when no rows match', () => {
    const result = filterData(salesData, { Region: ['West'] }, {}, columns);
    expect(result).toHaveLength(0);
  });

  it('chains two categorical filters (AND)', () => {
    const result = filterData(
      salesData,
      { Region: ['North'], Category: ['Sports'] },
      {},
      columns,
    );
    expect(result).toHaveLength(1);
    expect(result[0].Date).toBe('2023-03-20');
  });
});

// ─────────────────────────────────────────────────────────
// Numeric range filter
// ─────────────────────────────────────────────────────────
describe('filterData — numeric range filter', () => {
  it('filters by min only', () => {
    const result = filterData(salesData, { Revenue: { min: 800 } }, {}, columns);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.Revenue >= 800)).toBe(true);
  });

  it('filters by max only', () => {
    const result = filterData(salesData, { Revenue: { max: 800 } }, {}, columns);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.Revenue <= 800)).toBe(true);
  });

  it('filters by min and max range', () => {
    const result = filterData(salesData, { Revenue: { min: 600, max: 1000 } }, {}, columns);
    expect(result).toHaveLength(3);
  });

  it('returns all rows when range is null', () => {
    const result = filterData(salesData, { Revenue: { min: null, max: null } }, {}, columns);
    expect(result).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────
// Date range filter
// ─────────────────────────────────────────────────────────
describe('filterData — date range filter', () => {
  it('filters by from date', () => {
    const result = filterData(salesData, { Date: { from: '2023-02-01' } }, {}, columns);
    expect(result).toHaveLength(3);
    expect(result.every(r => new Date(r.Date) >= new Date('2023-02-01'))).toBe(true);
  });

  it('filters by to date', () => {
    const result = filterData(salesData, { Date: { to: '2023-01-31' } }, {}, columns);
    expect(result).toHaveLength(2);
  });

  it('filters by from and to date range', () => {
    const result = filterData(
      salesData,
      { Date: { from: '2023-02-01', to: '2023-02-28' } },
      {},
      columns,
    );
    expect(result).toHaveLength(1);
    expect(result[0].Date).toBe('2023-02-14');
  });

  it('returns all rows when no date boundaries set', () => {
    const result = filterData(salesData, { Date: { from: null, to: null } }, {}, columns);
    expect(result).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────
// Drilldown — categorical
// ─────────────────────────────────────────────────────────
describe('filterData — categorical drilldown', () => {
  it('drills into a single category value', () => {
    const result = filterData(salesData, {}, { Region: 'North' }, columns);
    expect(result).toHaveLength(3);
    expect(result.every(r => r.Region === 'North')).toBe(true);
  });

  it('stacks multiple drilldowns (AND logic)', () => {
    const result = filterData(salesData, {}, { Region: 'North', Category: 'Electronics' }, columns);
    expect(result).toHaveLength(2);
  });

  it('returns empty for non-existent drilldown value', () => {
    const result = filterData(salesData, {}, { Region: 'Unknown' }, columns);
    expect(result).toHaveLength(0);
  });

  it('skips drilldown column not in current dataset', () => {
    // "Segment" does not exist in salesData — should not crash and return full data
    const result = filterData(salesData, {}, { Segment: 'B2B' }, columns);
    expect(result).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────
// Drilldown — date (YYYY-MM partial match)
// ─────────────────────────────────────────────────────────
describe('filterData — date drilldown (YYYY-MM partial match)', () => {
  it('matches all rows in the same month', () => {
    const result = filterData(salesData, {}, { Date: '2023-01' }, columns);
    expect(result).toHaveLength(2);
    expect(result.every(r => r.Date.startsWith('2023-01'))).toBe(true);
  });

  it('matches single-row month', () => {
    const result = filterData(salesData, {}, { Date: '2023-02' }, columns);
    expect(result).toHaveLength(1);
    expect(result[0].Date).toBe('2023-02-14');
  });

  it('returns empty for month with no rows', () => {
    const result = filterData(salesData, {}, { Date: '2023-06' }, columns);
    expect(result).toHaveLength(0);
  });

  it('does NOT match partial string (bug regression)', () => {
    // Before fix: String(r.Date) === '2023-01' was false for '2023-01-10'
    // After fix: month-key comparison works
    const result = filterData(salesData, {}, { Date: '2023-01' }, columns);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// Combined filter + drilldown
// ─────────────────────────────────────────────────────────
describe('filterData — combined filter + drilldown', () => {
  it('applies both filter and drilldown (AND)', () => {
    // Filter: Revenue >= 600, Drilldown: Region = North
    const result = filterData(
      salesData,
      { Revenue: { min: 600 } },
      { Region: 'North' },
      columns,
    );
    // North rows: revenues 1000, 1500, 600 → all >= 600 → 3 rows
    expect(result).toHaveLength(3);
    expect(result.every(r => r.Region === 'North')).toBe(true);
    expect(result.every(r => r.Revenue >= 600)).toBe(true);
  });
});
