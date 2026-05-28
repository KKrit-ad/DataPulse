/* ══════════════════════════════════════════════
   DataPulse  |  app.js
   ══════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────
   CHART PALETTE
───────────────────────────────── */
const PALETTE = [
  '#6366f1','#10b981','#f59e0b','#3b82f6',
  '#ef4444','#8b5cf6','#06b6d4','#ec4899',
  '#84cc16','#f97316','#14b8a6','#a855f7'
];
const PALETTE_A = PALETTE.map(h => h + 'cc'); // 80% alpha

/* ─────────────────────────────────
   GLOBAL STATE
───────────────────────────────── */
const state = {
  raw: [],           // original rows (array of objects)
  filtered: [],      // after filters + drilldowns
  columns: [],       // ColMeta[]
  filters: {},       // { colName: filterValue }
  drilldowns: {},    // { colName: value } from chart clicks
  charts: {},        // { id: Chart instance }
  metrics: {},       // { metricId: boolean (visible) }
  searchQuery: '',
  page: 1,
  pageSize: 25,
  sortCol: null,
  sortDir: 'asc',
  fileName: '',
};

/* ColMeta shape:
   { name, type: 'numeric'|'date'|'categorical',
     uniqueValues?, min?, max?, dateMin?, dateMax? } */

/* ─────────────────────────────────
   THEME
───────────────────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  html.dataset.theme = next;
  localStorage.setItem('dp_theme', next);
  // Re-render charts for dark/light colours
  if (state.raw.length) redrawAllCharts();
}
(function initTheme() {
  const saved = localStorage.getItem('dp_theme');
  if (saved) document.documentElement.dataset.theme = saved;
})();

/* ─────────────────────────────────
   FILE UPLOAD
───────────────────────────────── */
const uploadZone = document.getElementById('upload-zone');
const fileInput  = document.getElementById('file-input');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (f) processFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});

function processFile(file) {
  state.fileName = file.name;
  showLoading('Reading file…');
  const isCSV = /\.csv$/i.test(file.name);
  const reader = new FileReader();

  if (isCSV) {
    reader.onload = e => {
      try {
        const text = e.target.result;
        const rows = parseCSV(text);
        hideLoading();
        if (!rows.length) { showToast('File appears empty.'); return; }
        initDashboard(rows, file.name);
      } catch(err) {
        hideLoading();
        showToast('Could not parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        hideLoading();
        if (!rows.length) { showToast('File appears empty — try another sheet.'); return; }
        initDashboard(rows, file.name);
      } catch(err) {
        hideLoading();
        showToast('Could not parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseCSV(text) {
  // Strip BOM if present
  const raw = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) return [];

  // Auto-detect delimiter from the header line
  const header = lines[0];
  const delim = (header.split('\t').length > header.split(';').length &&
                 header.split('\t').length > header.split(',').length)
    ? '\t'
    : header.split(';').length > header.split(',').length ? ';' : ',';

  const headers = splitCSVLine(header, delim);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = splitCSVLine(line, delim);
    const row = {};
    headers.forEach((h, j) => {
      const v = vals[j] ?? '';
      // Coerce numeric strings to numbers
      row[h] = v !== '' && !isNaN(v) && v.trim() !== '' ? Number(v) : v;
    });
    rows.push(row);
  }
  return rows;
}

function splitCSVLine(line, delim) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (ch === delim && !inQuote) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

/* ─────────────────────────────────
   SAMPLE DATA GENERATORS
───────────────────────────────── */
function loadSample(type) {
  showLoading('Generating sample data…');
  setTimeout(() => {
    const rows = type === 'sales'    ? genSales()
               : type === 'employee' ? genEmployee()
               :                       genFinance();
    hideLoading();
    const labels = { sales:'Sales Performance', employee:'HR / Employee', finance:'Financial Budget' };
    initDashboard(rows, labels[type]);
  }, 80);
}

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function genSales() {
  const regions   = ['North','South','East','West','Central'];
  const categories= ['Electronics','Apparel','Food & Beverage','Home & Garden','Sports','Automotive'];
  const products  = { Electronics:['Laptop','Monitor','Headset','Phone','Camera'],
                      Apparel:['T-Shirt','Jacket','Jeans','Shoes','Hat'],
                      'Food & Beverage':['Coffee','Tea','Protein Bar','Energy Drink','Juice'],
                      'Home & Garden':['Sofa','Lamp','Rug','Planter','Curtain'],
                      Sports:['Bicycle','Yoga Mat','Dumbbell','Running Shoes','Swim Cap'],
                      Automotive:['Tire','Battery','Oil Filter','Brake Pad','Wiper Blade'] };
  const rows = [];
  const start = new Date('2023-01-01');
  for (let i = 0; i < 1000; i++) {
    const cat = pick(categories);
    const prod = pick(products[cat]);
    const d = new Date(start.getTime() + rnd(0, 729) * 86400000);
    const units = rnd(1, 50);
    const price = rnd(10, 500);
    const cost  = Math.round(price * (0.4 + Math.random() * 0.3));
    rows.push({
      Date: d.toISOString().slice(0,10),
      Region: pick(regions),
      Category: cat,
      Product: prod,
      'Units Sold': units,
      Revenue: units * price,
      Cost: units * cost,
      Profit: units * (price - cost),
      Manager: pick(['Alice','Bob','Carol','David','Eva']),
    });
  }
  return rows;
}

function genEmployee() {
  const depts = ['Engineering','Marketing','Sales','HR','Finance','Operations','Product','Design'];
  const roles = { Engineering:['Engineer','Senior Engineer','Tech Lead','Architect'],
                  Marketing:['Analyst','Specialist','Manager','Director'],
                  Sales:['Rep','Account Exec','Sales Manager','VP Sales'],
                  HR:['Recruiter','HR Specialist','HR Manager','CHRO'],
                  Finance:['Analyst','Accountant','Finance Manager','CFO'],
                  Operations:['Coordinator','Supervisor','Ops Manager','COO'],
                  Product:['PM','Senior PM','Group PM','VP Product'],
                  Design:['Designer','UX Lead','Design Manager','Head of Design'] };
  const locations = ['Bangkok','Chiang Mai','Phuket','Singapore','Kuala Lumpur','Remote'];
  const statuses  = ['Active','Active','Active','Active','On Leave','Resigned'];
  const firstNames= ['Anya','Ben','Chloe','Dan','Eva','Finn','Grace','Hugo','Iris','Jake','Kim','Leo','Mia','Nina','Omar','Pam','Quinn','Ray','Sara','Tom'];
  const lastNames = ['Smith','Jones','Brown','Taylor','Wilson','Davis','Clark','Lewis','Hall','Young'];
  const rows = [];
  for (let i = 0; i < 500; i++) {
    const dept = pick(depts);
    const role = pick(roles[dept]);
    const salary = rnd(35000, 150000);
    const hire = new Date(2018 + rnd(0,5), rnd(0,11), rnd(1,28));
    rows.push({
      Name: pick(firstNames) + ' ' + pick(lastNames),
      Department: dept,
      Role: role,
      Location: pick(locations),
      Salary: salary,
      'Performance Score': parseFloat((2 + Math.random() * 3).toFixed(1)),
      'Hire Date': hire.toISOString().slice(0,10),
      Status: pick(statuses),
    });
  }
  return rows;
}

function genFinance() {
  const depts = ['Engineering','Marketing','Sales','HR','Finance','Operations'];
  const types = ['Payroll','Infrastructure','Marketing Spend','Travel','Training','Vendor'];
  const rows = [];
  for (let y = 2023; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const dept of depts) {
        const budget = rnd(50000, 300000);
        const actual = Math.round(budget * (0.7 + Math.random() * 0.6));
        rows.push({
          Month: `${y}-${String(m).padStart(2,'0')}`,
          Department: dept,
          Category: pick(types),
          Budget: budget,
          Actual: actual,
          Variance: actual - budget,
          'Variance %': parseFloat(((actual - budget) / budget * 100).toFixed(1)),
          Type: actual > budget ? 'Over Budget' : 'Under Budget',
        });
      }
    }
  }
  return rows;
}

/* ─────────────────────────────────
   COLUMN DETECTION
───────────────────────────────── */
function detectType(values, colName) {
  const name = (colName || '').toLowerCase();
  // Column name strongly hints it's an ID / code — never treat as date
  const isIdCol  = /(\bid\b|_id$|^id_|\bcode\b|\bno\b$|\bnum\b$|number$|serial|index|key$)/.test(name);
  // Column name strongly hints it's a date
  const isDateCol = /date|time|period|month|year|day|when|hired|created|updated|start|end/.test(name);

  const sample = values.filter(v => v !== '' && v != null).slice(0, 200);
  if (!sample.length) return 'categorical';
  let numHits = 0, dateHits = 0;
  for (const v of sample) {
    if (v instanceof Date && !isNaN(v)) {
      const yr = v.getFullYear();
      // Excel serial numbers mis-converted to dates land in 1900-1969 range for IDs < ~25000
      // Only trust Date objects if they look like real calendar dates
      if (yr >= 1970 && yr <= 2100) { dateHits++; }
      else { numHits++; } // treat as numeric (likely an ID mis-converted)
      continue;
    }
    const n = Number(v);
    if (!isNaN(n) && String(v).trim() !== '') { numHits++; continue; }
    const str = String(v).trim();
    // Only recognise explicit ISO / common date patterns
    if (/^\d{4}-\d{2}-\d{2}|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2100) dateHits++;
    }
  }
  const total = sample.length;
  // ID-named columns: never classify as date
  if (isIdCol)  return numHits / total >= 0.65 ? 'numeric' : 'categorical';
  // Date-named columns: lower threshold
  if (isDateCol && dateHits / total >= 0.5) return 'date';
  if (dateHits / total >= 0.65) return 'date';
  if (numHits  / total >= 0.65) return 'numeric';
  return 'categorical';
}

function analyzeColumns(rows) {
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
      meta.dateMin = new Date(Math.min(...dates)).toISOString().slice(0,10);
      meta.dateMax = new Date(Math.max(...dates)).toISOString().slice(0,10);
    } else {
      meta.uniqueValues = [...new Set(vals.filter(v => v !== '' && v != null))].slice(0,60);
    }
    return meta;
  });
}

/* ─────────────────────────────────
   INIT DASHBOARD
───────────────────────────────── */
function initDashboard(rows, label) {
  // Reset state
  state.raw       = rows;
  state.filters   = {};
  state.drilldowns= {};
  state.searchQuery= '';
  state.page      = 1;
  state.sortCol   = null;
  state.sortDir   = 'asc';
  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};

  state.columns = analyzeColumns(rows);
  state.filtered = [...rows];

  // Meta info
  document.getElementById('file-name').textContent = label;
  document.getElementById('file-meta').textContent = `${rows.length.toLocaleString()} rows × ${state.columns.length} columns`;

  // Build UI
  renderFilters();
  renderKPIs();
  renderCharts();
  renderTable();
  hideBreadcrumb();

  // Show dashboard
  document.getElementById('upload-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  document.getElementById('dash-main').scrollTop = 0;
}

function backToUpload() {
  document.getElementById('dashboard-screen').classList.remove('active');
  document.getElementById('upload-screen').classList.add('active');
  document.getElementById('file-input').value = '';
}

/* ─────────────────────────────────
   FILTER PIPELINE
───────────────────────────────── */
function applyFilters() {
  let data = state.raw;

  // Column filters
  for (const [col, val] of Object.entries(state.filters)) {
    const meta = state.columns.find(c => c.name === col);
    if (!meta || val == null || val === '') continue;
    if (meta.type === 'categorical') {
      const active = val.filter(Boolean);
      if (active.length) data = data.filter(r => active.includes(String(r[col])));
    } else if (meta.type === 'numeric') {
      if (val.min !== '' && val.min != null) data = data.filter(r => Number(r[col]) >= val.min);
      if (val.max !== '' && val.max != null) data = data.filter(r => Number(r[col]) <= val.max);
    } else if (meta.type === 'date') {
      if (val.from) data = data.filter(r => new Date(r[col]) >= new Date(val.from));
      if (val.to)   data = data.filter(r => new Date(r[col]) <= new Date(val.to));
    }
  }

  // Drilldown filters
  for (const [col, val] of Object.entries(state.drilldowns)) {
    const meta = state.columns.find(c => c.name === col);
    if (!meta) continue; // column not in current dataset — skip
    if (meta.type === 'date') {
      // Line-chart labels are "YYYY-MM"; match against full date strings
      data = data.filter(r => {
        const raw = r[col];
        if (raw == null || raw === '') return false;
        const d = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(d)) return false;
        const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        return monthKey === val;
      });
    } else {
      data = data.filter(r => String(r[col]) === String(val));
    }
  }

  state.filtered = data;
  state.page = 1;

  updateKPIs();   // values only — labels stay from renderKPIs
  redrawAllCharts();
  renderTable();
  updateBreadcrumb();
}

function resetFilters() {
  state.filters = {};
  // Reset DOM controls
  document.querySelectorAll('.filter-select').forEach(s => {
    [...s.options].forEach(o => o.selected = false);
    s.classList.remove('active');
  });
  document.querySelectorAll('.filter-range input, .filter-date input').forEach(i => i.value = '');
  applyFilters();
}

/* ─────────────────────────────────
   RENDER FILTERS
───────────────────────────────── */
function renderFilters() {
  const container = document.getElementById('filter-controls');
  container.innerHTML = '';

  state.columns.forEach(col => {
    const group = document.createElement('div');
    group.className = 'filter-group';
    const label = document.createElement('div');
    label.className = 'filter-label';
    label.textContent = col.name;
    group.appendChild(label);

    if (col.type === 'categorical' && col.uniqueValues && col.uniqueValues.length <= 25) {
      const sel = document.createElement('select');
      sel.className = 'filter-select';
      sel.multiple = true;
      sel.size = 1;
      sel.title = 'Hold Ctrl/Cmd to select multiple';
      sel.innerHTML = `<option value="">All</option>` +
        col.uniqueValues.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
      sel.addEventListener('change', () => {
        const selected = [...sel.selectedOptions].map(o => o.value).filter(v => v !== '');
        state.filters[col.name] = selected.length ? selected : null;
        sel.classList.toggle('active', selected.length > 0);
        applyFilters();
      });
      group.appendChild(sel);

    } else if (col.type === 'numeric') {
      const wrap = document.createElement('div');
      wrap.className = 'filter-range';
      const minI = makeInput('number', col.min, 'Min');
      const sep  = document.createElement('span');
      sep.className = 'filter-range-sep'; sep.textContent = '–';
      const maxI = makeInput('number', col.max, 'Max');
      const onChange = () => {
        state.filters[col.name] = { min: minI.value === '' ? null : Number(minI.value),
                                    max: maxI.value === '' ? null : Number(maxI.value) };
        applyFilters();
      };
      minI.addEventListener('change', onChange);
      maxI.addEventListener('change', onChange);
      wrap.append(minI, sep, maxI);
      group.appendChild(wrap);

    } else if (col.type === 'date') {
      const wrap = document.createElement('div');
      wrap.className = 'filter-date';
      const from = makeInput('date', '', 'From');
      const sep  = document.createElement('span');
      sep.className = 'filter-range-sep'; sep.textContent = '–';
      const to   = makeInput('date', '', 'To');
      const onChange = () => {
        state.filters[col.name] = { from: from.value || null, to: to.value || null };
        applyFilters();
      };
      from.addEventListener('change', onChange);
      to.addEventListener('change', onChange);
      wrap.append(from, sep, to);
      group.appendChild(wrap);
    } else {
      return; // skip wide-cardinality categoricals in filter bar
    }
    container.appendChild(group);
  });
}

function makeInput(type, placeholder, title) {
  const i = document.createElement('input');
  i.type = type; i.placeholder = placeholder; i.title = title;
  return i;
}

/* ─────────────────────────────────
   KPI CARDS
───────────────────────────────── */
const KPI_ICONS = { count:'#️⃣', sum:'∑', avg:'≈', max:'↑', min:'↓' };
const KPI_SUBS  = { count:'total records', sum:'total', avg:'average', max:'maximum', min:'minimum' };

function buildMetrics() {
  const metrics = [];
  metrics.push({ id:'count', label:'Total Records', col:null, agg:'count', idx: 0 });
  let idx = 1;
  state.columns.filter(c => c.type === 'numeric').slice(0,5).forEach(col => {
    ['sum','avg','max'].forEach(agg => {
      metrics.push({ id:`${agg}_${col.name}`, label:`${capAgg(agg)} ${col.name}`, col:col.name, agg, idx: idx++ });
    });
  });
  return metrics;
}

function capAgg(a) { return a === 'avg' ? 'Avg' : a === 'sum' ? 'Total' : a === 'max' ? 'Max' : 'Min'; }

function calcMetric(m, data) {
  if (m.agg === 'count') return data.length;
  const vals = data.map(r => Number(r[m.col])).filter(n => !isNaN(n));
  if (!vals.length) return 0;
  if (m.agg === 'sum') return vals.reduce((a,b) => a+b, 0);
  if (m.agg === 'avg') return vals.reduce((a,b) => a+b, 0) / vals.length;
  if (m.agg === 'max') return Math.max(...vals);
  if (m.agg === 'min') return Math.min(...vals);
}

function fmtNum(n) {
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

function renderKPIs() {
  const metricsAll = buildMetrics();

  // Reset visibility state for the new dataset
  const saved = JSON.parse(localStorage.getItem('dp_metrics') || '{}');
  state.metrics = {};
  metricsAll.forEach(m => {
    state.metrics[m.id] = saved[m.id] !== undefined ? saved[m.id] : true;
  });

  // Rebuild customize checkboxes
  const checksEl = document.getElementById('customize-checks');
  checksEl.innerHTML = '';
  metricsAll.forEach(m => {
    const lbl = document.createElement('label');
    lbl.className = 'customize-check' + (state.metrics[m.id] ? ' checked' : '');
    lbl.dataset.id = m.id;
    lbl.innerHTML = `<input type="checkbox" ${state.metrics[m.id] ? 'checked' : ''}> ${m.label}`;
    lbl.querySelector('input').addEventListener('change', e => {
      state.metrics[m.id] = e.target.checked;
      lbl.classList.toggle('checked', e.target.checked);
      localStorage.setItem('dp_metrics', JSON.stringify(state.metrics));
      const card = document.getElementById('kpi-' + m.id);
      if (card) card.style.display = e.target.checked ? '' : 'none';
    });
    checksEl.appendChild(lbl);
  });

  // Always fully rebuild KPI cards (avoids stale labels from previous dataset)
  const container = document.getElementById('kpi-cards');
  container.innerHTML = '';
  metricsAll.forEach((m, i) => {
    const v = calcMetric(m, state.filtered);
    const card = document.createElement('div');
    card.className = `kpi-card c${i % 6}`;
    card.id = 'kpi-' + m.id;
    card.style.display = state.metrics[m.id] ? '' : 'none';
    card.innerHTML = `
      <div class="kpi-card-label">${esc(m.label)} <span class="kpi-icon">${KPI_ICONS[m.agg] || '📊'}</span></div>
      <div class="kpi-card-value" id="kpiv-${m.id}">${fmtNum(v)}</div>
      <div class="kpi-card-sub">${KPI_SUBS[m.agg]}</div>`;
    container.appendChild(card);
  });
}

// Reactive value-only update — called by applyFilters, does NOT touch labels
function updateKPIs() {
  const metricsAll = buildMetrics();
  metricsAll.forEach(m => {
    const v = calcMetric(m, state.filtered);
    const el = document.getElementById('kpiv-' + m.id);
    if (el) el.textContent = fmtNum(v);
  });
}

function toggleCustomize() {
  document.getElementById('customize-panel').classList.toggle('open');
}

/* ─────────────────────────────────
   CHARTS
───────────────────────────────── */
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.font.size   = 12;

function getChartDefaults() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    gridColor:   dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.06)',
    tickColor:   dark ? '#64748b' : '#94a3b8',
    legendColor: dark ? '#94a3b8' : '#475569',
  };
}

function renderCharts() {
  const grid = document.getElementById('charts-grid');
  grid.innerHTML = '';
  Object.values(state.charts).forEach(c => c.destroy());
  state.charts = {};

  const cols = state.columns;
  const numCols  = cols.filter(c => c.type === 'numeric');
  const dateCols = cols.filter(c => c.type === 'date');
  const catCols  = cols.filter(c => c.type === 'categorical' && c.uniqueValues && c.uniqueValues.length >= 2 && c.uniqueValues.length <= 20);

  const chartDefs = [];

  // 1. Line: date × first numeric
  if (dateCols.length && numCols.length) {
    chartDefs.push({ type:'line', dateCol: dateCols[0].name, numCol: numCols[0].name, wide: true });
  }

  // 2. Bar: best cat × first numeric
  if (catCols.length && numCols.length) {
    chartDefs.push({ type:'bar', catCol: catCols[0].name, numCol: numCols[0].name });
  }

  // 3. Doughnut: second cat (or first)
  if (catCols.length >= 2) {
    chartDefs.push({ type:'doughnut', catCol: catCols[1].name });
  } else if (catCols.length === 1) {
    chartDefs.push({ type:'doughnut', catCol: catCols[0].name });
  }

  // 4. Horizontal bar: second cat × second numeric
  if (catCols.length >= 2 && numCols.length >= 2) {
    chartDefs.push({ type:'hbar', catCol: catCols[1].name, numCol: numCols[1].name });
  } else if (catCols.length >= 1 && numCols.length >= 2) {
    chartDefs.push({ type:'hbar', catCol: catCols[0].name, numCol: numCols[1].name });
  }

  // 5. Scatter: first two numerics
  if (numCols.length >= 2) {
    chartDefs.push({ type:'scatter', x: numCols[0].name, y: numCols[1].name });
  }

  // 6. Grouped bar (second date or third cat vs two numerics)
  if (catCols.length >= 1 && numCols.length >= 3) {
    chartDefs.push({ type:'multibar', catCol: catCols[0].name, numCols: numCols.slice(0,3).map(c=>c.name) });
  }

  chartDefs.slice(0,6).forEach((def, i) => createChartCard(def, i));
}

function createChartCard(def, idx) {
  const grid = document.getElementById('charts-grid');
  const card = document.createElement('div');
  card.className = 'chart-card' + (def.wide ? ' wide' : '');
  card.id = `chart-card-${idx}`;

  const title = chartTitle(def);
  card.innerHTML = `
    <div class="chart-card-hdr">
      <div class="chart-card-title">${title.main}</div>
      <div class="chart-card-sub">${title.sub}</div>
    </div>
    <span class="chart-card-hint">Click to drill down</span>
    <div class="chart-canvas-wrap"><canvas id="chart-canvas-${idx}"></canvas></div>`;
  grid.appendChild(card);

  buildChart(def, idx);
}

function chartTitle(def) {
  if (def.type === 'line')     return { main:`${def.numCol} Over Time`, sub:`Trend by ${def.dateCol}` };
  if (def.type === 'bar')      return { main:`${def.numCol} by ${def.catCol}`, sub:'Click a bar to drill down' };
  if (def.type === 'doughnut') return { main:`${def.catCol} Distribution`, sub:'Click a slice to drill down' };
  if (def.type === 'hbar')     return { main:`${def.numCol} by ${def.catCol}`, sub:'Horizontal comparison' };
  if (def.type === 'scatter')  return { main:`${def.x} vs ${def.y}`, sub:'Correlation scatter plot' };
  if (def.type === 'multibar') return { main:`Multi-metric by ${def.catCol}`, sub:def.numCols.join(' · ') };
  return { main:'Chart', sub:'' };
}

function buildChart(def, idx) {
  const d = getChartDefaults();
  const ctx = document.getElementById(`chart-canvas-${idx}`);
  if (!ctx) return;
  if (state.charts[idx]) state.charts[idx].destroy();

  const data = state.filtered;
  let config;

  if (def.type === 'line') {
    config = buildLineConfig(data, def, d, idx);
  } else if (def.type === 'bar') {
    config = buildBarConfig(data, def, d, idx);
  } else if (def.type === 'doughnut') {
    config = buildDoughnutConfig(data, def, d, idx);
  } else if (def.type === 'hbar') {
    config = buildHBarConfig(data, def, d, idx);
  } else if (def.type === 'scatter') {
    config = buildScatterConfig(data, def, d);
  } else if (def.type === 'multibar') {
    config = buildMultiBarConfig(data, def, d, idx);
  }

  if (!config) return;
  config.options = config.options || {};
  config.options.responsive = true;
  config.options.maintainAspectRatio = true;

  state.charts[idx] = new Chart(ctx, config);
  // Store def on instance for redraw
  state.charts[idx]._def = def;
}

/* ── Line chart ── */
function buildLineConfig(data, def, d, idx) {
  const grouped = groupByDate(data, def.dateCol, def.numCol, 'sum');
  const labels  = Object.keys(grouped).sort();
  const values  = labels.map(k => grouped[k]);
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: def.numCol,
        data: values,
        borderColor: PALETTE[0],
        backgroundColor: PALETTE[0] + '20',
        tension: .4, fill: true, pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: PALETTE[0],
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: d.tickColor, maxTicksLimit: 12 }, grid: { color: d.gridColor } },
        y: { ticks: { color: d.tickColor, callback: v => fmtNum(v) }, grid: { color: d.gridColor } }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        const label = labels[els[0].index];
        drillDown(def.dateCol, label, idx);
      }
    }
  };
}

function groupByDate(data, dateCol, valCol, agg) {
  const out = {};
  data.forEach(r => {
    const raw = r[dateCol];
    const d = new Date(raw);
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    if (!out[key]) out[key] = { sum:0, count:0 };
    const v = Number(r[valCol]);
    if (!isNaN(v)) { out[key].sum += v; out[key].count++; }
  });
  const result = {};
  Object.entries(out).forEach(([k,v]) => {
    result[k] = agg === 'sum' ? v.sum : agg === 'avg' ? v.sum/v.count : v.count;
  });
  return result;
}

/* ── Bar chart ── */
function buildBarConfig(data, def, d, idx) {
  const grouped = groupByCat(data, def.catCol, def.numCol, 'sum');
  const labels  = Object.keys(grouped).sort((a,b) => grouped[b]-grouped[a]).slice(0,15);
  const values  = labels.map(k => grouped[k]);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: def.numCol,
        data: values,
        backgroundColor: labels.map((_,i) => PALETTE_A[i % PALETTE.length]),
        borderColor: labels.map((_,i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1.5, borderRadius: 4,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: d.tickColor, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: d.tickColor, callback: v => fmtNum(v) }, grid: { color: d.gridColor } }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        drillDown(def.catCol, labels[els[0].index], idx);
      }
    }
  };
}

/* ── Doughnut ── */
function buildDoughnutConfig(data, def, d, idx) {
  const counts = {};
  data.forEach(r => {
    const v = String(r[def.catCol]);
    counts[v] = (counts[v] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => e[1]);
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: PALETTE.slice(0, labels.length),
        borderColor: 'transparent', hoverOffset: 8 }]
    },
    options: {
      cutout: '62%',
      plugins: {
        legend: { position:'right', labels: { color: d.legendColor, padding: 12, font: { size:11 } } }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        drillDown(def.catCol, labels[els[0].index], idx);
      }
    }
  };
}

/* ── Horizontal bar ── */
function buildHBarConfig(data, def, d, idx) {
  const grouped = groupByCat(data, def.catCol, def.numCol, 'avg');
  const labels  = Object.keys(grouped).sort((a,b) => grouped[b]-grouped[a]).slice(0,12);
  const values  = labels.map(k => grouped[k]);
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Avg ${def.numCol}`,
        data: values,
        backgroundColor: PALETTE_A[3],
        borderColor: PALETTE[3],
        borderWidth: 1.5, borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: d.tickColor, callback: v => fmtNum(v) }, grid: { color: d.gridColor } },
        y: { ticks: { color: d.tickColor } , grid: { display: false } }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        drillDown(def.catCol, labels[els[0].index], idx);
      }
    }
  };
}

/* ── Scatter ── */
function buildScatterConfig(data, def, d) {
  const points = data.slice(0, 400).map(r => ({
    x: Number(r[def.x]), y: Number(r[def.y])
  })).filter(p => !isNaN(p.x) && !isNaN(p.y));
  return {
    type: 'scatter',
    data: {
      datasets: [{
        label: `${def.x} vs ${def.y}`,
        data: points,
        backgroundColor: PALETTE[0] + '80',
        pointRadius: 4, pointHoverRadius: 7,
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display:true, text: def.x, color: d.tickColor }, ticks: { color: d.tickColor }, grid: { color: d.gridColor } },
        y: { title: { display:true, text: def.y, color: d.tickColor }, ticks: { color: d.tickColor }, grid: { color: d.gridColor } }
      }
    }
  };
}

/* ── Multi bar ── */
function buildMultiBarConfig(data, def, d, idx) {
  const labels = [...new Set(data.map(r => String(r[def.catCol])))].slice(0,12);
  const datasets = def.numCols.map((col, i) => {
    const grouped = groupByCat(data, def.catCol, col, 'sum');
    return {
      label: col,
      data: labels.map(l => grouped[l] || 0),
      backgroundColor: PALETTE_A[i % PALETTE.length],
      borderColor: PALETTE[i % PALETTE.length],
      borderWidth: 1.5, borderRadius: 3,
    };
  });
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      plugins: { legend: { labels: { color: d.legendColor } } },
      scales: {
        x: { ticks: { color: d.tickColor, maxRotation: 35 }, grid: { display: false } },
        y: { ticks: { color: d.tickColor, callback: v => fmtNum(v) }, grid: { color: d.gridColor } }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        drillDown(def.catCol, labels[els[0].index], idx);
      }
    }
  };
}

function groupByCat(data, catCol, numCol, agg) {
  const out = {};
  data.forEach(r => {
    const k = String(r[catCol]);
    if (!out[k]) out[k] = { sum:0, count:0 };
    const v = Number(r[numCol]);
    if (!isNaN(v)) { out[k].sum += v; out[k].count++; }
  });
  const result = {};
  Object.entries(out).forEach(([k,v]) => {
    result[k] = agg === 'sum' ? v.sum : agg === 'avg' ? v.sum/v.count : v.count;
  });
  return result;
}

function redrawAllCharts() {
  Object.entries(state.charts).forEach(([idx, chart]) => {
    buildChart(chart._def, Number(idx));
  });
}

/* ─────────────────────────────────
   DRILL-DOWN
───────────────────────────────── */
function drillDown(col, val, cardIdx) {
  state.drilldowns[col] = val;
  applyFilters();
  showToast(`🔍 ${col}: ${val} — ${state.filtered.length.toLocaleString()} rows`);
  // Highlight the source chart card
  document.querySelectorAll('.chart-card').forEach((c, i) => {
    c.classList.toggle('drilled', cardIdx !== undefined && i === cardIdx);
  });
}

function clearDrilldowns() {
  state.drilldowns = {};
  applyFilters();
}

function updateBreadcrumb() {
  const bar   = document.getElementById('breadcrumb-bar');
  const chips = document.getElementById('bc-chips');
  const entries = Object.entries(state.drilldowns);
  chips.innerHTML = '';
  if (!entries.length) {
    bar.classList.remove('visible');
    document.documentElement.style.setProperty('--bc-h', '0px');
    return;
  }
  bar.classList.add('visible');
  entries.forEach(([col, val]) => {
    const chip = document.createElement('div');
    chip.className = 'bc-chip';
    chip.innerHTML = `<span>${esc(col)}: <strong>${esc(String(val))}</strong></span>
      <span class="bc-chip-remove" onclick="removeDrilldown('${esc(col)}')">✕</span>`;
    chips.appendChild(chip);
  });
  // Let the browser paint the bar, then measure its height for the sticky offset
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--bc-h', bar.offsetHeight + 'px');
  });
}

function hideBreadcrumb() {
  const bar = document.getElementById('breadcrumb-bar');
  bar.classList.remove('visible');
  document.documentElement.style.setProperty('--bc-h', '0px');
}

function removeDrilldown(col) {
  delete state.drilldowns[col];
  applyFilters();
}

/* ─────────────────────────────────
   DATA TABLE
───────────────────────────────── */
function renderTable() {
  const q    = state.searchQuery.toLowerCase();
  let data   = state.filtered;

  // Search
  if (q) {
    data = data.filter(row =>
      Object.values(row).some(v => String(v).toLowerCase().includes(q))
    );
  }

  // Sort
  if (state.sortCol) {
    const col  = state.sortCol;
    const meta = state.columns.find(c => c.name === col);
    const dir  = state.sortDir === 'asc' ? 1 : -1;
    data = [...data].sort((a, b) => {
      let va = a[col], vb = b[col];
      if (meta && meta.type === 'numeric') { va = Number(va); vb = Number(vb); }
      else if (meta && meta.type === 'date') { va = new Date(va); vb = new Date(vb); }
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  const total   = data.length;
  const ps      = state.pageSize;
  const pages   = Math.max(1, Math.ceil(total / ps));
  state.page    = Math.min(state.page, pages);
  const start   = (state.page - 1) * ps;
  const pageData= data.slice(start, start + ps);

  // Table empty?
  const tableEl = document.getElementById('data-table');
  const emptyEl = document.getElementById('table-empty');
  if (!total) {
    tableEl.style.display = 'none';
    emptyEl.style.display = '';
  } else {
    tableEl.style.display = '';
    emptyEl.style.display = 'none';
  }

  // Head
  const thead = document.getElementById('table-head');
  thead.innerHTML = '';
  const tr = document.createElement('tr');
  state.columns.forEach(col => {
    const th = document.createElement('th');
    const isSorted = state.sortCol === col.name;
    th.className = isSorted ? `sort-${state.sortDir}` : '';
    th.innerHTML = `${esc(col.name)} <span class="sort-icon"></span>`;
    th.addEventListener('click', () => {
      if (state.sortCol === col.name) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortCol = col.name; state.sortDir = 'asc';
      }
      renderTable();
    });
    tr.appendChild(th);
  });
  thead.appendChild(tr);

  // Body
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';
  pageData.forEach(row => {
    const tr = document.createElement('tr');
    state.columns.forEach(col => {
      const td = document.createElement('td');
      const raw = String(row[col.name] ?? '');
      td.textContent = raw;
      if (q && raw.toLowerCase().includes(q)) {
        td.innerHTML = raw.replace(new RegExp(`(${escRe(q)})`, 'gi'), '<mark class="highlight">$1</mark>');
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  // Footer
  const info = document.getElementById('table-info');
  info.textContent = total
    ? `Showing ${start+1}–${Math.min(start+ps, total)} of ${total.toLocaleString()} rows`
    : 'No rows';

  renderPagination(pages);
}

function renderPagination(pages) {
  const el = document.getElementById('pagination');
  el.innerHTML = '';
  if (pages <= 1) return;

  const cur = state.page;
  const mkBtn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.textContent = label;
    if (disabled) b.disabled = true;
    b.onclick = () => { state.page = page; renderTable(); };
    return b;
  };

  el.appendChild(mkBtn('‹', cur-1, cur===1, false));

  const show = new Set([1, pages, cur, cur-1, cur+1].filter(p => p>=1 && p<=pages));
  let prev = 0;
  [...show].sort((a,b)=>a-b).forEach(p => {
    if (p - prev > 1) {
      const dots = document.createElement('span');
      dots.className = 'page-ellipsis'; dots.textContent = '…';
      el.appendChild(dots);
    }
    el.appendChild(mkBtn(p, p, false, p === cur));
    prev = p;
  });

  el.appendChild(mkBtn('›', cur+1, cur===pages, false));
}

function onTableSearch() {
  state.searchQuery = document.getElementById('table-search').value;
  state.page = 1;
  renderTable();
}

function onPageSize() {
  state.pageSize = Number(document.getElementById('page-size').value);
  state.page = 1;
  renderTable();
}

/* ─────────────────────────────────
   EXPORT CSV
───────────────────────────────── */
function exportCSV() {
  const rows = state.filtered;
  if (!rows.length) { showToast('No data to export'); return; }
  const headers = state.columns.map(c => c.name);
  const csv = [headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(','))
  ].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.fileName || 'export').replace(/\.[^.]+$/, '') + '_filtered.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast(`Exported ${rows.length.toLocaleString()} rows`);
}

/* ─────────────────────────────────
   LOADING / TOAST
───────────────────────────────── */
function showLoading(msg) {
  document.getElementById('loading').classList.add('show');
  document.getElementById('loading-sub').textContent = msg || '';
}
function hideLoading() { document.getElementById('loading').classList.remove('show'); }

let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ─────────────────────────────────
   UTILS
───────────────────────────────── */
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
