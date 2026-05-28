/**
 * lib/filters.js — Pure filter & drilldown logic.
 */

/**
 * Apply column filters + drilldown filters to a dataset.
 *
 * @param {object[]} rawData   - Full dataset rows
 * @param {object}   filters   - { colName: filterValue }
 * @param {object}   drilldowns - { colName: value }
 * @param {object[]} columns   - ColMeta[] from analyzeColumns
 * @returns {object[]} filtered rows
 */
export function filterData(rawData, filters = {}, drilldowns = {}, columns = []) {
  let data = rawData;

  // ── Column-level filters ──
  for (const [col, val] of Object.entries(filters)) {
    const meta = columns.find(c => c.name === col);
    if (!meta || val == null || val === '') continue;

    if (meta.type === 'categorical') {
      const active = Array.isArray(val) ? val.filter(Boolean) : [];
      if (active.length) data = data.filter(r => active.includes(String(r[col])));

    } else if (meta.type === 'numeric') {
      if (val.min != null && val.min !== '') data = data.filter(r => Number(r[col]) >= val.min);
      if (val.max != null && val.max !== '') data = data.filter(r => Number(r[col]) <= val.max);

    } else if (meta.type === 'date') {
      if (val.from) data = data.filter(r => new Date(r[col]) >= new Date(val.from));
      if (val.to)   data = data.filter(r => new Date(r[col]) <= new Date(val.to));
    }
  }

  // ── Drilldown filters ──
  for (const [col, val] of Object.entries(drilldowns)) {
    const meta = columns.find(c => c.name === col);
    if (!meta) continue; // column not in current dataset

    if (meta.type === 'date') {
      // Chart labels are "YYYY-MM"; match against full date strings
      data = data.filter(r => {
        const raw = r[col];
        if (raw == null || raw === '') return false;
        const d = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(d)) return false;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === val;
      });
    } else {
      data = data.filter(r => String(r[col]) === String(val));
    }
  }

  return data;
}
