# KPI Analytics Dashboard — Specification

## Overview
A browser-based, zero-backend analytics tool that transforms any `.xlsx` / `.xls` / `.csv` file into a fully interactive KPI dashboard with charts, filters, drill-down, and a data table — all running locally in the browser.

---

## Goals
| Goal | Detail |
|------|--------|
| Zero setup | No server, no login, no install — open `index.html` |
| Auto-intelligence | Detect column types and generate relevant KPIs/charts automatically |
| Interactivity | Filters, drill-down, metric toggles, table sort/search/pagination |
| Beautiful UX | Responsive, clean design with light/dark mode |

---

## Tech Stack
| Layer | Choice | Reason |
|-------|--------|--------|
| Parsing | SheetJS `xlsx@0.18.5` (CDN) | Best xlsx/csv browser parser |
| Charts | Chart.js `4.4.0` (CDN) | Mature, extensible, good API |
| Fonts | Inter via Google Fonts | Clean, readable, widely used |
| Framework | Vanilla JS + CSS custom props | Zero build step, fast loading |

---

## File Structure
```
kpi-dashboard/
├── index.html      ← Single HTML shell
├── app.css         ← Full design system + component styles
├── app.js          ← Application logic
└── SPEC.md         ← This file
```

---

## Screen Flow

```
Upload Screen  →  [file drop / sample click]  →  Dashboard Screen
```

### Upload Screen
- Centered hero layout with product name and tagline
- Drag-and-drop upload zone with hover animation
- "Choose File" button as secondary entry point
- Three sample-data quick-load cards: **Employee**, **Sales**, **Financial**
- Light/dark mode toggle

### Dashboard Screen
- **Header**: Back button, file name, row×col count, Export CSV, theme toggle
- **Drill-down breadcrumb bar**: chips showing active drilldown filters; "Clear all" button; hidden when inactive
- **Filter bar**: dynamically generated per-column controls; "Reset" button
- **KPI section**: auto-generated metric cards with customize panel
- **Charts section**: auto-generated chart cards in responsive grid
- **Data table**: search, sort, paginate, row count selector

---

## Column Type Detection

Run on every non-null value sample (first 200 rows):

| Heuristic | Detected As |
|-----------|-------------|
| ≥70 % parse as `Number` | `numeric` |
| ≥70 % parse as `Date` | `date` |
| otherwise | `categorical` |

---

## Auto-Generated KPI Cards

One card per numeric column + a row-count card:

| Metric | Label |
|--------|-------|
| COUNT  | Total Records |
| SUM    | Total `<col>` |
| AVG    | Avg `<col>` |
| MAX    | Max `<col>` |
| MIN    | Min `<col>` |

Cards are toggled on/off via the **Customize** panel (saved in `localStorage`).

---

## Auto-Generated Charts

Priority order — up to 6 charts rendered:

| Priority | Condition | Chart Type | Description |
|----------|-----------|------------|-------------|
| 1 | date col + numeric col exists | Line | Trend over time |
| 2 | categorical col (≤20 uniques) + numeric col | Bar | Comparison by category |
| 3 | categorical col (≤10 uniques) | Doughnut | Distribution |
| 4 | second categorical + numeric | Horizontal Bar | Secondary comparison |
| 5 | two numeric cols | Scatter | Correlation |
| 6 | multiple numeric cols | Radar | Multi-metric overview |

Each chart card shows:
- Chart title + subtitle
- Click-to-drill-down hint
- Responsive canvas

---

## Filter Bar

Dynamically generated per column type:

| Column Type | Control | Behavior |
|-------------|---------|----------|
| `categorical` ≤25 uniques | Multi-select dropdown | Toggle values on/off |
| `numeric` | Range slider (min–max) | Filter rows in range |
| `date` | Date-range (from / to) | Filter rows in date window |

Applying any filter:
1. Updates `state.filteredData`
2. Recalculates KPI cards
3. Redraws all charts
4. Re-renders data table (page 1)

---

## Drill-Down

Triggered by clicking a **chart data point** (bar, pie slice, line point):

1. Adds a filter chip to the breadcrumb bar
2. Appends the clicked dimension→value to `state.drilldowns`
3. `applyFilters()` runs (same pipeline as filter bar)
4. Multiple drill-downs are ANDed together
5. "✕ Clear all" resets all drilldown state

---

## Metrics Toggle

- **Gear icon** in KPI section header opens an inline panel
- One checkbox per metric card
- Unchecking hides the card (CSS `display:none`)
- State persisted in `localStorage` under key `datapulse_metrics`

---

## Data Table

| Feature | Detail |
|---------|--------|
| Search | Client-side full-text filter across all columns |
| Sort | Click column header → asc/desc cycle |
| Pagination | 10 / 25 / 50 / 100 rows per page |
| Row info | "Showing X–Y of Z filtered rows" |
| Highlight | Search term highlighted in cells |

---

## Sample Data Generators (built-in)

### Employee (500 rows)
Columns: `Name`, `Department`, `Role`, `Location`, `Salary`, `Performance`, `Hire Date`, `Status`

### Sales (1 000 rows)
Columns: `Date`, `Region`, `Product`, `Category`, `Units`, `Revenue`, `Cost`, `Profit`

### Financial (360 rows)
Columns: `Month`, `Department`, `Category`, `Amount`, `Budget`, `Variance`, `Type`

---

## Export
Clicking **Export CSV** downloads `filteredData` as a UTF-8 CSV via a Blob URL.

---

## Responsive Breakpoints

| Breakpoint | Layout change |
|------------|--------------|
| `≥1280px` | 2-col chart grid |
| `960–1279px` | 2-col chart grid, narrower sidebar |
| `640–959px` | 1-col chart grid, KPI cards scroll horizontally |
| `<640px` | Single column everything, simplified filters |

---

## Accessibility
- All interactive elements have `title` / `aria-label`
- Color is not the only signal (values + icons used)
- Focus-visible outline on keyboard navigation
- Sufficient contrast ratio on text elements

---

## Browser Support
Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

---

## Implementation Steps

1. **HTML scaffold** — upload screen + dashboard screen shells
2. **CSS design system** — variables, typography, layout, components
3. **File parsing** — SheetJS integration, column detection
4. **Sample data generators** — deterministic seeded pseudo-random data
5. **KPI engine** — aggregate calculations, card rendering
6. **Chart engine** — auto-select chart type, Chart.js wiring
7. **Filter engine** — control generation, filter application pipeline
8. **Drill-down** — click handlers on charts, breadcrumb management
9. **Data table** — sort, search, paginate
10. **Metrics toggle** — customize panel + localStorage persistence
11. **Export** — Blob CSV download
12. **Dark mode** — CSS variable swap + localStorage persistence
13. **Polish** — animations, loading state, empty states, error messages
