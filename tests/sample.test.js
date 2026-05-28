/**
 * tests/sample.test.js
 * Unit tests for built-in sample data generators.
 * Validates row count, required columns, and value constraints.
 */
import { describe, it, expect } from 'vitest';
import { genSales, genEmployee, genFinance } from '../lib/sample.js';

// ─────────────────────────────────────────────────────────
// genSales
// ─────────────────────────────────────────────────────────
describe('genSales', () => {
  const data = genSales();

  it('generates exactly 1000 rows', () => {
    expect(data).toHaveLength(1000);
  });

  it('contains all required columns', () => {
    const required = ['Date', 'Region', 'Category', 'Product', 'Units Sold', 'Revenue', 'Cost', 'Profit'];
    required.forEach(col => {
      expect(data[0]).toHaveProperty(col);
    });
  });

  it('Date is ISO yyyy-mm-dd format', () => {
    expect(data[0].Date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Dates are within 2023–2024 range', () => {
    data.forEach(row => {
      const year = new Date(row.Date).getFullYear();
      expect(year).toBeGreaterThanOrEqual(2023);
      expect(year).toBeLessThanOrEqual(2024);
    });
  });

  it('Revenue is positive', () => {
    expect(data.every(r => r.Revenue > 0)).toBe(true);
  });

  it('Units Sold is between 1 and 50', () => {
    expect(data.every(r => r['Units Sold'] >= 1 && r['Units Sold'] <= 50)).toBe(true);
  });

  it('Profit equals Revenue minus Cost', () => {
    data.slice(0, 50).forEach(r => {
      expect(r.Profit).toBe(r.Revenue - r.Cost);
    });
  });

  it('Region is one of the expected values', () => {
    const valid = new Set(['North', 'South', 'East', 'West', 'Central']);
    expect(data.every(r => valid.has(r.Region))).toBe(true);
  });

  it('has multiple unique regions', () => {
    const regions = new Set(data.map(r => r.Region));
    expect(regions.size).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────
// genEmployee
// ─────────────────────────────────────────────────────────
describe('genEmployee', () => {
  const data = genEmployee();

  it('generates exactly 500 rows', () => {
    expect(data).toHaveLength(500);
  });

  it('contains all required columns', () => {
    const required = ['Name', 'Department', 'Role', 'Location', 'Salary', 'Performance Score', 'Hire Date', 'Status'];
    required.forEach(col => {
      expect(data[0]).toHaveProperty(col);
    });
  });

  it('Salary is between 35000 and 150000', () => {
    expect(data.every(r => r.Salary >= 35000 && r.Salary <= 150000)).toBe(true);
  });

  it('Performance Score is between 2 and 5', () => {
    expect(data.every(r => r['Performance Score'] >= 2 && r['Performance Score'] <= 5)).toBe(true);
  });

  it('Hire Date is ISO yyyy-mm-dd', () => {
    expect(data[0]['Hire Date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('Hire Date year is between 2018 and 2023', () => {
    data.forEach(r => {
      const year = new Date(r['Hire Date']).getFullYear();
      expect(year).toBeGreaterThanOrEqual(2018);
      expect(year).toBeLessThanOrEqual(2023);
    });
  });

  it('Status is one of the expected values', () => {
    const valid = new Set(['Active', 'On Leave', 'Resigned']);
    expect(data.every(r => valid.has(r.Status))).toBe(true);
  });

  it('has multiple unique departments', () => {
    const depts = new Set(data.map(r => r.Department));
    expect(depts.size).toBeGreaterThanOrEqual(5);
  });

  it('Name is a non-empty string', () => {
    expect(data.every(r => typeof r.Name === 'string' && r.Name.length > 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// genFinance
// ─────────────────────────────────────────────────────────
describe('genFinance', () => {
  const data = genFinance();

  it('generates exactly 144 rows (2 years × 12 months × 6 depts)', () => {
    expect(data).toHaveLength(144);
  });

  it('contains all required columns', () => {
    const required = ['Month', 'Department', 'Category', 'Budget', 'Actual', 'Variance', 'Variance %', 'Type'];
    required.forEach(col => {
      expect(data[0]).toHaveProperty(col);
    });
  });

  it('Month is yyyy-mm format', () => {
    expect(data[0].Month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('Budget is positive', () => {
    expect(data.every(r => r.Budget > 0)).toBe(true);
  });

  it('Variance equals Actual minus Budget', () => {
    data.forEach(r => {
      expect(r.Variance).toBe(r.Actual - r.Budget);
    });
  });

  it('Type reflects over/under budget', () => {
    data.forEach(r => {
      if (r.Actual > r.Budget) expect(r.Type).toBe('Over Budget');
      else expect(r.Type).toBe('Under Budget');
    });
  });

  it('covers both 2023 and 2024', () => {
    const years = new Set(data.map(r => r.Month.slice(0, 4)));
    expect(years.has('2023')).toBe(true);
    expect(years.has('2024')).toBe(true);
  });
});
