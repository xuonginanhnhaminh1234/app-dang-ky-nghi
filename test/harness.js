/**
 * HARNESS TEST V5.0-RC2 - chạy Code.gs trong Node bằng mock Google Apps Script.
 * Mock đúng bề mặt API mà Code.gs dùng:
 *   SpreadsheetApp.getActiveSpreadsheet() (getSheetByName/insertSheet/setSpreadsheetTimeZone)
 *   Sheet: getRange/getDataRange/getLastRow/getLastColumn/appendRow/setFrozenRows/getName
 *   Range: getValues/setValues/getValue/setValue/setNumberFormat/setFontWeight (chainable)
 *   CacheService (Map), LockService (noop), Logger, ContentService, Utilities.formatDate
 *
 * Dùng: const { taoMoiTruong } = require('./harness');
 *       const g = taoMoiTruong();          // context đã nạp Code.gs + setupSheets + setupSheetsV5
 *       g.newRequest();                     // mô phỏng request mới (xóa memo như Apps Script)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CODE_GS = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

function fmtDate_(d, fmt) {
  const p2 = n => String(n).padStart(2, '0');
  return fmt
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MM/g, p2(d.getMonth() + 1))
    .replace(/dd/g, p2(d.getDate()))
    .replace(/HH/g, p2(d.getHours()))
    .replace(/mm/g, p2(d.getMinutes()))
    .replace(/ss/g, p2(d.getSeconds()));
}

class MockRange {
  constructor(sheet, r, c, nr, nc) { this.sh = sheet; this.r = r; this.c = c; this.nr = nr; this.nc = nc; }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      const src = this.sh.data[this.r - 1 + i] || [];
      for (let j = 0; j < this.nc; j++) row.push(src[this.c - 1 + j] !== undefined ? src[this.c - 1 + j] : '');
      out.push(row);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) {
    for (let i = 0; i < this.nr; i++) {
      this.sh._ensureRow(this.r - 1 + i, this.c - 1 + this.nc);
      for (let j = 0; j < this.nc; j++) this.sh.data[this.r - 1 + i][this.c - 1 + j] = vals[i][j];
    }
    return this;
  }
  setValue(v) {
    this.sh._ensureRow(this.r - 1, this.c);
    this.sh.data[this.r - 1][this.c - 1] = v;
    return this;
  }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
}

class MockSheet {
  constructor(name) { this.name = name; this.data = []; }
  _ensureRow(idx, minCols) {
    while (this.data.length <= idx) this.data.push([]);
    const row = this.data[idx];
    while (row.length < minCols) row.push('');
  }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; }
  getRange(r, c, nr, nc) { return new MockRange(this, r, c, nr === undefined ? 1 : nr, nc === undefined ? 1 : nc); }
  getDataRange() {
    const nr = Math.max(1, this.data.length);
    const nc = Math.max(1, this.getLastColumn());
    return new MockRange(this, 1, 1, nr, nc);
  }
  appendRow(row) { this.data.push(row.slice()); return this; }
  setFrozenRows() { return this; }
}

class MockSpreadsheet {
  constructor() { this.sheets = {}; }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) { const sh = new MockSheet(name); this.sheets[name] = sh; return sh; }
  setSpreadsheetTimeZone() {}
}

function taoMoiTruong(opts) {
  opts = opts || {};
  const ss = new MockSpreadsheet();
  const cache = new Map();
  const logs = [];

  const sandbox = {
    console: { log: m => logs.push(String(m)), warn: m => logs.push(String(m)) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    CacheService: {
      getScriptCache: () => ({
        get: k => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => { cache.set(k, v); },
        remove: k => { cache.delete(k); }
      })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Logger: { log: m => logs.push(String(m)) },
    ContentService: {
      MimeType: { JSON: 'JSON' },
      createTextOutput: s => ({ _content: s, setMimeType() { return this; }, getContent() { return this._content; } })
    },
    Utilities: { formatDate: (d, tz, fmt) => fmtDate_(d, fmt) }
  };
  vm.createContext(sandbox);
  vm.runInContext(CODE_GS, sandbox, { filename: 'Code.gs' });

  // Tiện ích cho test
  sandbox.__ss = ss;
  sandbox.__cache = cache;
  sandbox.__logs = logs;
  sandbox.newRequest = function () {
    // Apps Script mỗi request là 1 process mới -> memo reset
    const memo = sandbox._memoSheetData;
    Object.keys(memo).forEach(k => { delete memo[k]; });
  };
  sandbox.sheetRows = function (name) {
    // Đọc thô 1 sheet thành mảng object (không qua cache/memo)
    const sh = ss.getSheetByName(name);
    if (!sh || sh.data.length < 2) return [];
    const headers = sh.data[0];
    return sh.data.slice(1).map(r => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ''; });
      return o;
    });
  };
  sandbox.callPost = function (action, data) {
    const out = sandbox.doPost({ postData: { contents: JSON.stringify({ action, data: data || {} }) } });
    return JSON.parse(out._content);
  };

  if (!opts.khongSetup) {
    sandbox.setupSheets();
    sandbox.setupSheetsV5(); // tự gọi setupSheetsV4 bên trong (nền V3.3.3 -> V5)
    sandbox.newRequest();
  }
  return sandbox;
}

module.exports = { taoMoiTruong };
