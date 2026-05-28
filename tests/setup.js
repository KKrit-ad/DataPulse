/**
 * tests/setup.js — Global jsdom setup for UI tests.
 */
import { beforeEach } from 'vitest';

// Minimal DOM structure required by UI functions
beforeEach(() => {
  document.body.innerHTML = `
    <html data-theme="light">
    <div id="kpi-cards"></div>
    <div id="customize-checks"></div>
    <div id="customize-panel"></div>
    <div id="filter-controls"></div>
    <div id="breadcrumb-bar"></div>
    <div id="bc-chips"></div>
    <div id="charts-grid"></div>
    <div id="table-head"></div>
    <div id="table-body"></div>
    <div id="table-empty" style="display:none"></div>
    <div id="table-info"></div>
    <div id="pagination"></div>
    <div id="file-name"></div>
    <div id="file-meta"></div>
    <div id="loading"></div>
    <div id="toast"></div>
    <input id="table-search" value="">
    <select id="page-size"><option value="25" selected>25</option></select>
    <table id="data-table"></table>
    `;
});
