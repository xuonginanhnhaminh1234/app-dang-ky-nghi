/**
 * RUNNER TEST V5.0-RC2 - chạy: node test/run-tests.js
 * Mỗi file test export mảng các { ten, fn }. fn ném lỗi = FAIL.
 */
'use strict';
const path = require('path');

const CAC_FILE = [
  '01-regression-v333.test.js',
  '02-flag-off.test.js',
  '03-gps-fail-closed.test.js',
  '04-v5-p1.test.js',
  '05-v5-p2-dieuchinh.test.js',
  '06-v5-p3-luong.test.js',
  '07-v5-p4-chot-kynhan.test.js',
  '08-cross-check.test.js'
];

let pass = 0, fail = 0;
const loi = [];

for (const f of CAC_FILE) {
  const tests = require(path.join(__dirname, f));
  console.log('\n=== ' + f + ' (' + tests.length + ' test) ===');
  for (const t of tests) {
    try {
      t.fn();
      pass++;
      console.log('  PASS  ' + t.ten);
    } catch (e) {
      fail++;
      loi.push(f + ' :: ' + t.ten + ' :: ' + e.message);
      console.log('  FAIL  ' + t.ten + '\n        ' + e.message);
    }
  }
}

console.log('\n==============================');
console.log('TỔNG: ' + (pass + fail) + ' | PASS: ' + pass + ' | FAIL: ' + fail);
if (loi.length) {
  console.log('\nDANH SÁCH FAIL:');
  loi.forEach(l => console.log(' - ' + l));
  process.exit(1);
}
console.log('TẤT CẢ TEST PASS ✅');
