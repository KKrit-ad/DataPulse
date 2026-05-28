/**
 * tests/ui.test.js
 * DOM / UI rendering tests using jsdom (configured via vitest.config.js).
 * Tests focus on: KPI card output, filter control generation,
 * breadcrumb visibility, table rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeColumns, calcMetric, buildMetrics, fmtNum } from '../lib/core.js';
import { filterData } from '../lib/filters.js';
import { genSales, genEmployee } from '../lib/sample.js';

/* ── Helpers that mimic the real rendering logic ── */

function renderKPICards(container, data, columns) {
  const metrics = buildMetrics(columns);
  container.innerHTML = '';
  metrics.forEach((m, i) => {
    const v = calcMetric(m, data);
    const card = document.createElement('div');
    card.className = `kpi-card c${i % 6}`;
    card.id = 'kpi-' + m.id;
    card.innerHTML = `
      <div class="kpi-card-label">${m.label}</div>
      <div class="kpi-card-value" id="kpiv-${m.id}">${fmtNum(v)}</div>`;
    container.appendChild(card);
  });
}

function renderFilterControls(container, columns) {
  container.innerHTML = '';
  columns.forEach(col => {
    if (col.type === 'categorical' && col.uniqueValues && col.uniqueValues.length <= 25) {
      const grp = document.createElement('div');
      grp.className = 'filter-group';
      grp.dataset.col = col.name;
      grp.dataset.colType = 'categorical';
      const sel = document.createElement('select');
      sel.className = 'filter-select';
      sel.multiple = true;
      col.uniqueValues.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v; opt.textContent = v;
        sel.appendChild(opt);
      });
      grp.appendChild(sel);
      container.appendChild(grp);
    } else if (col.type === 'numeric') {
      const grp = document.createElement('div');
      grp.className = 'filter-group';
      grp.dataset.col = col.name;
      grp.dataset.colType = 'numeric';
      container.appendChild(grp);
    } else if (col.type === 'date') {
      const grp = document.createElement('div');
      grp.className = 'filter-group';
      grp.dataset.col = col.name;
      grp.dataset.colType = 'date';
      container.appendChild(grp);
    }
  });
}

function renderBreadcrumb(barEl, chipsEl, drilldowns) {
  const entries = Object.entries(drilldowns);
  if (!entries.length) {
    barEl.classList.remove('visible');
    return;
  }
  barEl.classList.add('visible');
  chipsEl.innerHTML = '';
  entries.forEach(([col, val]) => {
    const chip = document.createElement('span');
    chip.className = 'bc-chip';
    chip.textContent = `${col}: ${val}`;
    chipsEl.appendChild(chip);
  });
}

function renderTableRows(tbody, data, columns, pageSize = 25) {
  tbody.innerHTML = '';
  data.slice(0, pageSize).forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      td.textContent = String(row[col.name] ?? '');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────────────
// KPI Cards
// ─────────────────────────────────────────────────────────
describe('KPI card rendering', () => {
  let container;
  const rows = [
    { dept: 'Eng', salary: 100 },
    { dept: 'Mkt', salary: 200 },
    { dept: 'Eng', salary: 300 },
  ];
  const columns = analyzeColumns(rows);

  beforeEach(() => {
    container = document.getElementById('kpi-cards');
  });

  it('renders a card for each metric', () => {
    renderKPICards(container, rows, columns);
    const metrics = buildMetrics(columns);
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(metrics.length);
  });

  it('renders correct count value', () => {
    renderKPICards(container, rows, columns);
    const countEl = container.querySelector('#kpiv-count');
    expect(countEl.textContent).toBe('3');
  });

  it('renders correct sum value', () => {
    renderKPICards(container, rows, columns);
    const sumEl = container.querySelector('#kpiv-sum_salary');
    expect(sumEl.textContent).toBe('600');
  });

  it('renders correct avg value', () => {
    renderKPICards(container, rows, columns);
    const avgEl = container.querySelector('#kpiv-avg_salary');
    expect(avgEl.textContent).toBe('200');
  });

  it('clears and rebuilds on second call (no stale cards)', () => {
    renderKPICards(container, rows, columns);
    renderKPICards(container, rows, columns);
    const metrics = buildMetrics(columns);
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(metrics.length);
  });

  it('updates values after drilldown filter', () => {
    const filtered = filterData(rows, { dept: ['Eng'] }, {}, columns);
    renderKPICards(container, filtered, columns);
    const countEl = container.querySelector('#kpiv-count');
    expect(countEl.textContent).toBe('2');
  });
});

// ─────────────────────────────────────────────────────────
// Filter controls
// ─────────────────────────────────────────────────────────
describe('Filter control rendering', () => {
  let container;

  beforeEach(() => {
    container = document.getElementById('filter-controls');
  });

  it('renders categorical column as select', () => {
    const columns = analyzeColumns([
      { region: 'North', revenue: 100 },
      { region: 'South', revenue: 200 },
    ]);
    renderFilterControls(container, columns);
    const cats = container.querySelectorAll('[data-col-type="categorical"]');
    expect(cats.length).toBeGreaterThanOrEqual(1);
  });

  it('renders numeric column as range group', () => {
    const columns = analyzeColumns([
      { salary: 1000 }, { salary: 2000 },
    ]);
    renderFilterControls(container, columns);
    const nums = container.querySelectorAll('[data-col-type="numeric"]');
    expect(nums.length).toBe(1);
  });

  it('renders date column as date group', () => {
    const columns = analyzeColumns([
      { hire_date: '2023-01-01' }, { hire_date: '2023-06-01' },
    ]);
    renderFilterControls(container, columns);
    const dates = container.querySelectorAll('[data-col-type="date"]');
    expect(dates.length).toBe(1);
  });

  it('populates options for categorical columns', () => {
    const rows = [
      { region: 'North' }, { region: 'South' }, { region: 'East' },
    ];
    const columns = analyzeColumns(rows);
    renderFilterControls(container, columns);
    const opts = container.querySelectorAll('select option');
    expect(opts.length).toBe(3);
  });

  it('skips high-cardinality categorical columns (> 25 unique)', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}` }));
    const columns = analyzeColumns(rows);
    renderFilterControls(container, columns);
    // id is numeric (skipped), no filter rendered
    expect(container.children.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// Breadcrumb bar
// ─────────────────────────────────────────────────────────
describe('Breadcrumb rendering', () => {
  let bar, chips;

  beforeEach(() => {
    bar   = document.getElementById('breadcrumb-bar');
    chips = document.getElementById('bc-chips');
  });

  it('is hidden when drilldowns are empty', () => {
    renderBreadcrumb(bar, chips, {});
    expect(bar.classList.contains('visible')).toBe(false);
  });

  it('becomes visible when drilldown is set', () => {
    renderBreadcrumb(bar, chips, { Region: 'North' });
    expect(bar.classList.contains('visible')).toBe(true);
  });

  it('renders one chip per drilldown', () => {
    renderBreadcrumb(bar, chips, { Region: 'North', Category: 'Sports' });
    expect(chips.querySelectorAll('.bc-chip')).toHaveLength(2);
  });

  it('chip text contains column name and value', () => {
    renderBreadcrumb(bar, chips, { Region: 'North' });
    expect(chips.querySelector('.bc-chip').textContent).toContain('Region');
    expect(chips.querySelector('.bc-chip').textContent).toContain('North');
  });

  it('hides again when drilldowns cleared', () => {
    renderBreadcrumb(bar, chips, { Region: 'North' });
    renderBreadcrumb(bar, chips, {});
    expect(bar.classList.contains('visible')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// Data table
// ─────────────────────────────────────────────────────────
describe('Table rendering', () => {
  let tbody;
  const rows = [
    { name: 'Alice', dept: 'Eng', salary: 90000 },
    { name: 'Bob',   dept: 'Mkt', salary: 75000 },
    { name: 'Carol', dept: 'Eng', salary: 110000 },
    { name: 'Dave',  dept: 'HR',  salary: 65000 },
  ];
  const columns = analyzeColumns(rows);

  beforeEach(() => {
    tbody = document.getElementById('table-body');
  });

  it('renders one <tr> per row', () => {
    renderTableRows(tbody, rows, columns);
    expect(tbody.querySelectorAll('tr')).toHaveLength(4);
  });

  it('renders one <td> per column per row', () => {
    renderTableRows(tbody, rows, columns);
    const firstRow = tbody.querySelector('tr');
    expect(firstRow.querySelectorAll('td')).toHaveLength(columns.length);
  });

  it('cell contains correct value', () => {
    renderTableRows(tbody, rows, columns);
    const cells = tbody.querySelector('tr').querySelectorAll('td');
    const values = [...cells].map(c => c.textContent);
    expect(values).toContain('Alice');
    expect(values).toContain('Eng');
  });

  it('respects pageSize limit', () => {
    renderTableRows(tbody, rows, columns, 2);
    expect(tbody.querySelectorAll('tr')).toHaveLength(2);
  });

  it('renders empty tbody when data is empty', () => {
    renderTableRows(tbody, [], columns);
    expect(tbody.querySelectorAll('tr')).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// Integration — sample data through full pipeline
// ─────────────────────────────────────────────────────────
describe('Integration: sample data through full pipeline', () => {
  it('sales: columns detected, KPIs computed, drilldown filters correctly', () => {
    const data    = genSales();
    const columns = analyzeColumns(data);
    const metrics = buildMetrics(columns);

    // Columns detected
    expect(columns.find(c => c.name === 'Date')?.type).toBe('date');
    expect(columns.find(c => c.name === 'Region')?.type).toBe('categorical');
    expect(columns.find(c => c.name === 'Revenue')?.type).toBe('numeric');

    // Total records
    const count = calcMetric(metrics.find(m => m.agg === 'count'), data);
    expect(count).toBe(1000);

    // Drilldown by Region
    const northData = filterData(data, {}, { Region: 'North' }, columns);
    expect(northData.length).toBeGreaterThan(0);
    expect(northData.every(r => r.Region === 'North')).toBe(true);

    // Revenue sum after drilldown is less than total
    const totalRev = calcMetric(metrics.find(m => m.col === 'Revenue' && m.agg === 'sum'), data);
    const northRev = calcMetric(metrics.find(m => m.col === 'Revenue' && m.agg === 'sum'), northData);
    expect(northRev).toBeLessThan(totalRev);
  });

  it('employee: salary metrics and date drilldown work', () => {
    const data    = genEmployee();
    const columns = analyzeColumns(data);

    // Date drilldown by month
    const filtered = filterData(data, {}, { 'Hire Date': '2020-06' }, columns);
    filtered.forEach(r => {
      const d = new Date(r['Hire Date']);
      expect(d.getFullYear()).toBe(2020);
      expect(d.getMonth()).toBe(5); // June = index 5
    });
  });
});
