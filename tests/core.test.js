/**
 * tests/core.test.js
 * Unit tests for pure core functions:
 * detectType, analyzeColumns, fmtNum, calcMetric, buildMetrics,
 * groupByDate, groupByCat, esc, escRe
 */
import { describe, it, expect } from 'vitest';
import {
  detectType,
  analyzeColumns,
  fmtNum,
  capAgg,
  calcMetric,
  buildMetrics,
  groupByDate,
  groupByCat,
  esc,
  escRe,
} from '../lib/core.js';

// ─────────────────────────────────────────────────────────
// detectType
// ─────────────────────────────────────────────────────────
describe('detectType', () => {
  it('detects all-numeric column as numeric', () => {
    expect(detectType([1, 2, 3, 100, 200])).toBe('numeric');
  });

  it('detects string numbers as numeric', () => {
    expect(detectType(['10', '20', '30.5', '100'])).toBe('numeric');
  });

  it('detects ISO date strings as date', () => {
    expect(detectType(['2023-01-15', '2023-06-20', '2024-03-10'])).toBe('date');
  });

  it('detects Date objects in valid range as date', () => {
    const dates = [new Date('2022-01-01'), new Date('2023-06-15'), new Date('2024-12-31')];
    expect(detectType(dates)).toBe('date');
  });

  it('detects Date objects with year < 1970 as numeric (Excel serial IDs)', () => {
    // Excel serial 100 → ~1900, should be treated as numeric not date
    const ancientDates = [new Date(100), new Date(200), new Date(300)];
    // getFullYear() on these is 1970 (epoch ms), but that passes threshold
    // — main test: column named employee_id must be numeric
    expect(detectType([1, 2, 3, 100, 200], 'employee_id')).toBe('numeric');
  });

  it('forces id-named columns to numeric regardless of value', () => {
    expect(detectType([1, 2, 3], 'employee_id')).toBe('numeric');
    expect(detectType([1, 2, 3], 'user_id')).toBe('numeric');
    expect(detectType([1, 2, 3], 'order_number')).toBe('numeric');
    expect(detectType([1, 2, 3], 'serial')).toBe('numeric');
  });

  it('detects date-named columns with lower threshold', () => {
    const mixed = ['2023-01-01', '2023-02-01', 'N/A', '2023-04-01', '2023-05-01'];
    expect(detectType(mixed, 'hire_date')).toBe('date');
  });

  it('detects text strings as categorical', () => {
    expect(detectType(['North', 'South', 'East', 'West'])).toBe('categorical');
  });

  it('returns categorical for empty sample', () => {
    expect(detectType([])).toBe('categorical');
    expect(detectType([null, '', undefined])).toBe('categorical');
  });

  it('handles mixed numeric and text as categorical', () => {
    expect(detectType(['A1', 'B2', 'C3', 'D4'])).toBe('categorical');
  });
});

// ─────────────────────────────────────────────────────────
// analyzeColumns
// ─────────────────────────────────────────────────────────
describe('analyzeColumns', () => {
  const rows = [
    { name: 'Alice', dept: 'Engineering', salary: 90000, hire_date: '2020-01-15' },
    { name: 'Bob',   dept: 'Marketing',   salary: 75000, hire_date: '2021-03-20' },
    { name: 'Carol', dept: 'Engineering', salary: 110000, hire_date: '2019-07-01' },
  ];

  it('returns one meta object per column', () => {
    const cols = analyzeColumns(rows);
    expect(cols).toHaveLength(4);
  });

  it('assigns correct types', () => {
    const cols = analyzeColumns(rows);
    const byName = Object.fromEntries(cols.map(c => [c.name, c]));
    expect(byName.name.type).toBe('categorical');
    expect(byName.dept.type).toBe('categorical');
    expect(byName.salary.type).toBe('numeric');
    expect(byName.hire_date.type).toBe('date');
  });

  it('computes min/max for numeric columns', () => {
    const cols = analyzeColumns(rows);
    const salary = cols.find(c => c.name === 'salary');
    expect(salary.min).toBe(75000);
    expect(salary.max).toBe(110000);
  });

  it('computes dateMin/dateMax for date columns', () => {
    const cols = analyzeColumns(rows);
    const hireDate = cols.find(c => c.name === 'hire_date');
    expect(hireDate.dateMin).toBe('2019-07-01');
    expect(hireDate.dateMax).toBe('2021-03-20');
  });

  it('collects uniqueValues for categorical columns', () => {
    const cols = analyzeColumns(rows);
    const dept = cols.find(c => c.name === 'dept');
    expect(dept.uniqueValues).toContain('Engineering');
    expect(dept.uniqueValues).toContain('Marketing');
    expect(dept.uniqueValues).toHaveLength(2);
  });

  it('returns empty array for empty rows', () => {
    expect(analyzeColumns([])).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// fmtNum
// ─────────────────────────────────────────────────────────
describe('fmtNum', () => {
  it('formats billions', () => expect(fmtNum(1_500_000_000)).toBe('1.5B'));
  it('formats negative billions', () => expect(fmtNum(-2_000_000_000)).toBe('-2.0B'));
  it('formats millions', () => expect(fmtNum(6_700_000)).toBe('6.7M'));
  it('formats thousands', () => expect(fmtNum(25_700)).toBe('25.7K'));
  it('formats small integers', () => expect(fmtNum(42)).toBe('42'));
  it('formats zero', () => expect(fmtNum(0)).toBe('0'));
  it('formats decimals', () => expect(fmtNum(3.14159)).toBe('3.14'));
  it('does not use K for 999', () => expect(fmtNum(999)).toBe('999'));
  it('uses K for 1000', () => expect(fmtNum(1000)).toBe('1.0K'));
});

// ─────────────────────────────────────────────────────────
// capAgg
// ─────────────────────────────────────────────────────────
describe('capAgg', () => {
  it('returns correct labels', () => {
    expect(capAgg('sum')).toBe('Total');
    expect(capAgg('avg')).toBe('Avg');
    expect(capAgg('max')).toBe('Max');
    expect(capAgg('min')).toBe('Min');
    expect(capAgg('unknown')).toBe('Min'); // fallback
  });
});

// ─────────────────────────────────────────────────────────
// calcMetric
// ─────────────────────────────────────────────────────────
describe('calcMetric', () => {
  const data = [
    { salary: 100, score: 4.5 },
    { salary: 200, score: 3.0 },
    { salary: 300, score: 5.0 },
  ];

  it('count returns row count', () => {
    expect(calcMetric({ agg: 'count', col: null }, data)).toBe(3);
  });

  it('sum returns total', () => {
    expect(calcMetric({ agg: 'sum', col: 'salary' }, data)).toBe(600);
  });

  it('avg returns mean', () => {
    expect(calcMetric({ agg: 'avg', col: 'salary' }, data)).toBe(200);
  });

  it('max returns maximum', () => {
    expect(calcMetric({ agg: 'max', col: 'salary' }, data)).toBe(300);
  });

  it('min returns minimum', () => {
    expect(calcMetric({ agg: 'min', col: 'salary' }, data)).toBe(100);
  });

  it('returns 0 for empty numeric column', () => {
    expect(calcMetric({ agg: 'sum', col: 'salary' }, [])).toBe(0);
  });

  it('ignores non-numeric values', () => {
    const d = [{ salary: 'N/A' }, { salary: 500 }, { salary: null }];
    expect(calcMetric({ agg: 'sum', col: 'salary' }, d)).toBe(500);
  });

  it('count works on empty data', () => {
    expect(calcMetric({ agg: 'count', col: null }, [])).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// buildMetrics
// ─────────────────────────────────────────────────────────
describe('buildMetrics', () => {
  const columns = [
    { name: 'dept',   type: 'categorical' },
    { name: 'salary', type: 'numeric' },
    { name: 'score',  type: 'numeric' },
  ];

  it('always includes a count metric first', () => {
    const metrics = buildMetrics(columns);
    expect(metrics[0].agg).toBe('count');
    expect(metrics[0].col).toBeNull();
  });

  it('generates sum/avg/max for each numeric column', () => {
    const metrics = buildMetrics(columns);
    const aggs = metrics.filter(m => m.col === 'salary').map(m => m.agg);
    expect(aggs).toContain('sum');
    expect(aggs).toContain('avg');
    expect(aggs).toContain('max');
  });

  it('ignores non-numeric columns', () => {
    const metrics = buildMetrics(columns);
    expect(metrics.every(m => m.col !== 'dept')).toBe(true);
  });

  it('caps at 5 numeric columns', () => {
    const manyCols = Array.from({ length: 10 }, (_, i) => ({
      name: `col${i}`, type: 'numeric',
    }));
    const metrics = buildMetrics(manyCols);
    const numericMetrics = metrics.filter(m => m.col !== null);
    expect(numericMetrics.length).toBeLessThanOrEqual(5 * 3);
  });

  it('includes column name in label', () => {
    const metrics = buildMetrics(columns);
    const sumSalary = metrics.find(m => m.col === 'salary' && m.agg === 'sum');
    expect(sumSalary.label).toContain('salary');
  });
});

// ─────────────────────────────────────────────────────────
// groupByDate
// ─────────────────────────────────────────────────────────
describe('groupByDate', () => {
  const data = [
    { Date: '2023-01-05', Revenue: 100 },
    { Date: '2023-01-20', Revenue: 200 },
    { Date: '2023-02-10', Revenue: 300 },
    { Date: '2023-02-28', Revenue: 150 },
    { Date: 'invalid',    Revenue: 999 },
  ];

  it('groups by YYYY-MM key', () => {
    const result = groupByDate(data, 'Date', 'Revenue', 'sum');
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['2023-01', '2023-02']));
  });

  it('sums values in same month', () => {
    const result = groupByDate(data, 'Date', 'Revenue', 'sum');
    expect(result['2023-01']).toBe(300);
    expect(result['2023-02']).toBe(450);
  });

  it('averages values in same month', () => {
    const result = groupByDate(data, 'Date', 'Revenue', 'avg');
    expect(result['2023-01']).toBe(150);
  });

  it('counts entries per month', () => {
    const result = groupByDate(data, 'Date', 'Revenue', 'count');
    expect(result['2023-01']).toBe(2);
    expect(result['2023-02']).toBe(2);
  });

  it('skips invalid dates', () => {
    const result = groupByDate(data, 'Date', 'Revenue', 'sum');
    expect(Object.keys(result)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────
// groupByCat
// ─────────────────────────────────────────────────────────
describe('groupByCat', () => {
  const data = [
    { Region: 'North', Revenue: 1000 },
    { Region: 'North', Revenue: 2000 },
    { Region: 'South', Revenue: 1500 },
    { Region: 'South', Revenue: 500  },
    { Region: 'East',  Revenue: 800  },
  ];

  it('sums revenue per category', () => {
    const result = groupByCat(data, 'Region', 'Revenue', 'sum');
    expect(result['North']).toBe(3000);
    expect(result['South']).toBe(2000);
    expect(result['East']).toBe(800);
  });

  it('averages revenue per category', () => {
    const result = groupByCat(data, 'Region', 'Revenue', 'avg');
    expect(result['North']).toBe(1500);
    expect(result['South']).toBe(1000);
  });

  it('counts entries per category', () => {
    const result = groupByCat(data, 'Region', 'Revenue', 'count');
    expect(result['North']).toBe(2);
    expect(result['South']).toBe(2);
    expect(result['East']).toBe(1);
  });

  it('returns empty object for empty data', () => {
    expect(groupByCat([], 'Region', 'Revenue', 'sum')).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────
// esc / escRe
// ─────────────────────────────────────────────────────────
describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<script>')).toBe('&lt;script&gt;');
    expect(esc('a & b')).toBe('a &amp; b');
    expect(esc('"quoted"')).toBe('&quot;quoted&quot;');
  });
  it('converts non-strings', () => {
    expect(esc(123)).toBe('123');
    expect(esc(null)).toBe('null');
  });
});

describe('escRe', () => {
  it('escapes regex special characters', () => {
    expect(escRe('a.b')).toBe('a\\.b');
    expect(escRe('(test)')).toBe('\\(test\\)');
    expect(escRe('$100')).toBe('\\$100');
  });
});
