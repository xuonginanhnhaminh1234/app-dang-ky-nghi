/**
 * 08 - CROSS-CHECK: mọi route doPost có handler tồn tại; frontend chỉ gọi action có route;
 * mọi onclick có hàm; không còn vết ngoại lệ GPS trong cả 2 file.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { assert, taoMoiTruong } = require('./helpers');

const GS = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const SCRIPT = (HTML.match(/<script>([\s\S]*)<\/script>/) || [])[1] || '';

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

t('mọi route trong doPost đều có hàm handler thật (gọi được, không ReferenceError)', () => {
  const g = taoMoiTruong();
  const routes = [...GS.matchAll(/case '([A-Za-z]+)'/g)].map(m => m[1]);
  assert.ok(routes.length >= 110, 'route quá ít: ' + routes.length);
  routes.forEach(r => {
    g.newRequest();
    const kq = g.callPost(r, {}); // data rỗng - chỉ cần KHÔNG ném "is not defined"
    assert.ok(kq && typeof kq.success === 'boolean', r + ' phải trả JSON chuẩn');
    assert.ok(String(kq.message).indexOf('is not defined') < 0, r + ' handler bị thiếu: ' + kq.message);
  });
});

t('frontend chỉ gọi action có route backend', () => {
  const routes = new Set([...GS.matchAll(/case '([A-Za-z]+)'/g)].map(m => m[1]));
  const acts = [...new Set([...SCRIPT.matchAll(/api(?:Silent)?\('([A-Za-z]+)'/g)].map(m => m[1]))];
  acts.push('checkIn', 'checkOut'); // gọi động qua guiChamCong_
  const thieu = acts.filter(a => !routes.has(a));
  assert.strictEqual(thieu.length, 0, 'action không có route: ' + thieu.join(', '));
});

t('mọi onclick trong HTML đều có hàm trong script', () => {
  const onclicks = [...new Set([...HTML.matchAll(/onclick="([A-Za-z_][A-Za-z0-9_]*)\(/g)].map(m => m[1]))];
  const defs = new Set([...SCRIPT.matchAll(/(?:async\s+)?function\s+([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]));
  const thieu = onclicks.filter(f => !defs.has(f));
  assert.strictEqual(thieu.length, 0, 'onclick thiếu hàm: ' + thieu.join(', '));
});

t('script frontend parse được (không lỗi cú pháp)', () => {
  new Function(SCRIPT);
});

t('backend V5.0-RC2 sạch vết ngoại lệ GPS (NGOAI_LE_GPS/CheDoGPSKhanCap/ChamNgoaiViTri chỉ còn trong ghi chú)', () => {
  ['getNgoaiLeGPSHopLe_', 'ghiNhanDungNgoaiLe_', 'setupSheetsV402', 'grantGPSException',
   'proposeGPSException', 'approveGPSException', 'revokeGPSException', 'setEmergencyGPSMode',
   'buildNgoaiLePayload_'].forEach(fn => {
    assert.ok(GS.indexOf('function ' + fn) < 0, 'còn hàm ' + fn);
  });
  assert.ok(GS.indexOf("NGOAI_LE_GPS: 'NGOAI_LE_GPS'") < 0, 'còn khai báo sheet NGOAI_LE_GPS');
  assert.ok(GS.indexOf("CheDoGPSKhanCap: 'FALSE'") < 0, 'còn key CheDoGPSKhanCap trong CC_MAC_DINH');
});

t('frontend sạch UI ngoại lệ GPS + checkbox chấm ngoài vị trí', () => {
  ['loadNgoaiLeGPS', 'capNgoaiLe', 'deXuatNgoaiLe', 'batTatKhanCap', 'thuHoiNgoaiLe',
   'getGPSExceptions', 'setEmergencyGPSMode'].forEach(x => {
    assert.ok(SCRIPT.indexOf(x + '(') < 0 || SCRIPT.indexOf('function ' + x) < 0,
      'còn vết ' + x + ' trong frontend');
  });
  assert.ok(HTML.indexOf('id="vtNgoai"') < 0, 'còn checkbox Cho phép chấm ngoài vị trí');
  assert.ok(HTML.indexOf('Chế độ khẩn cấp & ngoại lệ GPS') < 0, 'còn card ngoại lệ GPS');
});

t('frontend có đủ màn hình + hàm cho mọi module V5 có backend', () => {
  ['scr-luongnv', 'scr-khac', 'scr-doica', 'scr-vesom', 'scr-tangcatoi', 'scr-pmdash',
   'scr-dieuchinh', 'scr-quyetdinh', 'scr-chotky', 'scr-owner'].forEach(id => {
    assert.ok(HTML.indexOf('id="' + id + '"') >= 0, 'thiếu màn ' + id);
  });
  ['openPMDash', 'openLuongNV', 'openKhac', 'openDoiCa', 'openVeSom', 'openTangCaToi',
   'openDieuChinh', 'openQuyetDinh', 'openChotKy', 'openOwner', 'chotNgayFE', 'luuKPI',
   'kyNhanLuong', 'copyTSVLuong'].forEach(fn => {
    assert.ok(SCRIPT.indexOf('function ' + fn) >= 0, 'thiếu hàm ' + fn);
  });
  // TOÀN BỘ action V5 đều được frontend gọi
  ['getPMDashboard', 'chotNgay', 'getKPIToday', 'updateKPI', 'getKPIConfig', 'updateKPIConfig',
   'getMyShiftChanges', 'getAllShiftChanges', 'approveShiftChange', 'rejectShiftChange', 'cancelMyShiftChange',
   'getMyEarlyLeaves', 'getAllEarlyLeaves', 'approveEarlyLeave', 'rejectEarlyLeave', 'cancelMyEarlyLeave',
   'cancelMyOvertime', 'getAdjustments', 'approveAdjustment', 'rejectAdjustment', 'voidAdjustment',
   'getDecisions', 'approveDecision', 'rejectDecision',
   'submitShiftChange', 'submitEarlyLeave',
   'submitOvertimeRequest', 'createAdjustment', 'createDecision', 'getSalaryHistory', 'getPayrollV5',
   'lockPeriod', 'lockPayroll', 'unlockPeriod', 'getLockStatus', 'getLockedPayroll', 'exportPayrollTSV',
   'getMyPayslip', 'confirmSalaryReceived', 'getOwnerDashboard'].forEach(a => {
    assert.ok(SCRIPT.indexOf("'" + a + "'") >= 0, 'frontend chưa gọi ' + a);
  });
});

t('APP_VERSION = V5.0-RC2', () => {
  assert.ok(GS.indexOf("var APP_VERSION = 'V5.0-RC2'") >= 0);
});

module.exports = tests;
