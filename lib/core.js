/**
 * lib/core.js — Pure functions extracted from app.js for unit testing.
 * No DOM, no global state, no side-effects.
 */

/* ─── Utilities ─── */
export function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
export function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ─── Number formatter ─── */
export function fmtNum(n) {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

/* ─── Aggregation label ─── */
export function capAgg(a) {
  return a === 'avg' ? 'Avg' : a === 'sum' ? 'Total' : a === 'max' ? 'Max' : 'Min';
}

/* ─── Column type detection ─── */
export function detectType(values, colName) {
  const name = (colName || '').toLowerCase();
  const isIdCol = /(\bid\b|_id$|^id_|\bcode\b|\bno\b$|\bnum\b$|number$|serial|index|key$)/.test(name);
  const isDateCol = /date|time|period|month|year|day|when|hired|created|updated|start|end/.test(name);

  const sample = values.filter(v => v !== '' && v != null).slice(0, 200);
  if (!sample.length) return 'categorical';

  let numHits = 0, dateHits = 0;
  for (const v of sample) {
    if (v instanceof Date && !isNaN(v)) {
      const yr = v.getFullYear();
      if (yr >= 1970 && yr <= 2100) dateHits++;
      else numHits++;
      continue;
    }
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== '') { numHits++; continue; }
    const str = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) dateHits++;
    }
  }

  const total = sample.length;
  if (isIdCol) return numHits / total >= 0.65 ? 'numeric' : 'categorical';
  if (isDateCol && dateHits / total >= 0.5) return 'date';
  if (dateHits / total >= 0.65) return 'date';
  if (numHits  / total >= 0.65) return 'numeric';
  return 'categorical';
}

/* ─── Column analysis ─── */
export function analyzeColumns(rows) {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map(name => {
    const vals = rows.map(r => r[name]);
    const type = detectType(vals, name);
    const meta = { name, type };
    if (type === 'numeric') {
      const nums = vals.map(Number).filter(n => !isNaN(n));
      meta.min = Math.min(...nums);
      meta.max = Math.max(...nums);
    } else if (type === 'date') {
      const dates = vals.map(v => new Date(v)).filter(d => !isNaN(d));
      meta.dateMin = new Date(Math.min(...dates)).toISOString().slice(0, 10);
      meta.dateMax = new Date(Math.max(...dates)).toISOString().slice(0, 10);
    } else {
      meta.uniqueValues = [...new Set(vals.filter(v => v !== '' && v != null))].slice(0, 60);
    }
    return meta;
  });
}

/* ─── KPI metric definitions ─── */
export function buildMetrics(columns) {
  const numCols = columns.filter(c => c.type === 'numeric');
  const metrics = [{ id: 'count', label: 'Total Records', col: null, agg: 'count' }];
  numCols.slice(0, 5).forEach(col => {
    ['sum', 'avg', 'max'].forEach(agg => {
      metrics.push({
        id: `${agg}_${col.name}`,
        label: `${capAgg(agg)} ${col.name}`,
        col: col.name,
        agg,
      });
    });
  });
  return metrics;
}

/* ─── KPI calculator ─── */
export function calcMetric(m, data) {
  if (m.agg === 'count') return data.length;
  const vals = data.map(r => Number(r[m.col])).filter(n => !isNaN(n));
  if (!vals.length) return 0;
  if (m.agg === 'sum') return vals.reduce((a, b) => a + b, 0);
  if (m.agg === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length;
  if (m.agg === 'max') return Math.max(...vals);
  if (m.agg === 'min') return Math.min(...vals);
  return 0;
}

/* ─── Chart data helpers ─── */
export function groupByDate(data, dateCol, valCol, agg) {
  const out = {};
  data.forEach(r => {
    const raw = r[dateCol];
    const d = new Date(raw);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!out[key]) out[key] = { sum: 0, count: 0 };
    const v = Number(r[valCol]);
    if (!isNaN(v)) { out[key].sum += v; out[key].count++; }
  });
  const result = {};
  Object.entries(out).forEach(([k, v]) => {
    result[k] = agg === 'sum' ? v.sum : agg === 'avg' ? v.sum / v.count : v.count;
  });
  return result;
}

export function groupByCat(data, catCol, numCol, agg) {
  const out = {};
  data.forEach(r => {
    const k = String(r[catCol]);
    if (!out[k]) out[k] = { sum: 0, count: 0 };
    const v = Number(r[numCol]);
    if (!isNaN(v)) { out[k].sum += v; out[k].count++; }
  });
  const result = {};
  Object.entries(out).forEach(([k, v]) => {
    result[k] = agg === 'sum' ? v.sum : agg === 'avg' ? v.sum / v.count : v.count;
  });
  return result;
}
