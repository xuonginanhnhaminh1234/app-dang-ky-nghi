/**
 * 02 - HỢP ĐỒNG FLAG = FALSE: mọi API V5 bị chặn "Chức năng đang tắt.",
 * không ghi event, guard khóa kỳ vô hiệu, 4 API đã chốt flag ở RC2,
 * 6 API ngoại lệ GPS không còn tồn tại. App = V3.3.3.
 */
'use strict';
const { assert, okTrue, okFalse, moiTruongChuan, ngayThangNay, TRONG_XUONG, homNay } = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

// API V5 + tham số tối thiểu (đủ để qua bước parse, chặn phải xảy ra Ở FLAG trước mọi logic)
const DS_API_V5 = [
  ['getKPIToday', g => g.getKPIToday('U999', '')],
  ['updateKPI', g => g.updateKPI({ userID: 'U999', phongBan: 'CSKH', thucTe: 5 })],
  ['getKPIConfig', g => g.getKPIConfig('U999')],
  ['updateKPIConfig', g => g.updateKPIConfig({ userID: 'U999', phongBan: 'CSKH', chiTieuMacDinh: 100 })],
  ['getPMDashboard', g => g.getPMDashboard('U999')],
  ['chotNgay', g => g.chotNgay({ userID: 'U999' })],
  ['submitShiftChange', g => g.submitShiftChange({ userID: 'U001', ngay: homNay(), caDeNghi: 'SANG', lyDo: 'x' })],
  ['getMyShiftChanges', g => g.getMyShiftChanges('U001')],
  ['getAllShiftChanges', g => g.getAllShiftChanges('U999', {})],
  ['approveShiftChange', g => g.approveShiftChange({ userID: 'U999', doiCaID: 'DC-X' })],
  ['rejectShiftChange', g => g.rejectShiftChange({ userID: 'U999', doiCaID: 'DC-X', lyDo: 'x' })],
  ['cancelMyShiftChange', g => g.cancelMyShiftChange({ userID: 'U001', doiCaID: 'DC-X' })],
  ['submitEarlyLeave', g => g.submitEarlyLeave({ userID: 'U001', ngay: homNay(), gioVeSom: '16:00', lyDo: 'x' })],
  ['getMyEarlyLeaves', g => g.getMyEarlyLeaves('U001')],
  ['getAllEarlyLeaves', g => g.getAllEarlyLeaves('U999', {})],
  ['approveEarlyLeave', g => g.approveEarlyLeave({ userID: 'U999', veSomID: 'VS-X' })],
  ['rejectEarlyLeave', g => g.rejectEarlyLeave({ userID: 'U999', veSomID: 'VS-X', lyDo: 'x' })],
  ['cancelMyEarlyLeave', g => g.cancelMyEarlyLeave({ userID: 'U001', veSomID: 'VS-X' })],
  ['submitOvertimeRequest', g => g.submitOvertimeRequest({ userID: 'U001', ngay: homNay(), gioBatDau: '17:30', gioKetThuc: '19:00', lyDo: 'x' })],
  ['cancelMyOvertime', g => g.cancelMyOvertime({ userID: 'U001', tangCaID: 'TC-X' })],
  ['createAdjustment', g => g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: homNay(), loai: 'MienDiTre', lyDo: 'x' })],
  ['getAdjustments', g => g.getAdjustments('U999', {})],
  ['approveAdjustment', g => g.approveAdjustment({ userID: 'U999', phieuID: 'DC5-X' })],
  ['rejectAdjustment', g => g.rejectAdjustment({ userID: 'U999', phieuID: 'DC5-X', lyDo: 'x' })],
  ['voidAdjustment', g => g.voidAdjustment({ userID: 'U999', phieuID: 'DC5-X', lyDo: 'x' })],
  ['createDecision', g => g.createDecision({ userID: 'U999', targetUserID: 'U001', loai: 'ChinhThuc', hieuLucTu: homNay(), lyDo: 'x', luongChinhThuc: '5000000' })],
  ['getDecisions', g => g.getDecisions('U999', {})],
  ['approveDecision', g => g.approveDecision({ userID: 'U999', qdID: 'QD-X' })],
  ['rejectDecision', g => g.rejectDecision({ userID: 'U999', qdID: 'QD-X', lyDo: 'x' })],
  ['getSalaryHistory', g => g.getSalaryHistory('U999', 'U001')],
  ['getPayrollV5', g => g.getPayrollV5('U999', 1, 2026, {})],           // RC2: chốt flag SalaryHistory
  ['lockPeriod', g => g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: 1, nam: 2026 })],
  ['unlockPeriod', g => g.unlockPeriod({ userID: 'U999', loai: 'CONG', thang: 1, nam: 2026, lyDo: 'x' })],
  ['lockPayroll', g => g.lockPayroll({ userID: 'U999', thang: 1, nam: 2026 })],
  ['getLockedPayroll', g => g.getLockedPayroll('U999', 1, 2026)],       // RC2: chốt flag PayrollLock
  ['exportPayrollTSV', g => g.exportPayrollTSV('U999', 1, 2026)],       // RC2: qua getLockedPayroll
  ['getMyPayslip', g => g.getMyPayslip('U001', 1, 2026)],
  ['confirmSalaryReceived', g => g.confirmSalaryReceived({ userID: 'U001', bangLuongID: 'BL-X' })],
  ['getOwnerDashboard', g => g.getOwnerDashboard('U999')]
];

t('TOÀN BỘ ' + DS_API_V5.length + ' API V5 trả "Chức năng đang tắt." khi flag FALSE', () => {
  const g = moiTruongChuan();
  DS_API_V5.forEach(([ten, goi]) => {
    g.newRequest();
    const kq = goi(g);
    assert.strictEqual(kq.success, false, ten + ' phải bị chặn khi flag FALSE');
    assert.ok(String(kq.message).indexOf('Chức năng đang tắt') >= 0,
      ten + ' phải báo "Chức năng đang tắt." | nhận: ' + kq.message);
  });
});

t('6 API ngoại lệ GPS V4.0.2 đã bị gỡ hẳn (doPost không nhận diện)', () => {
  const g = moiTruongChuan();
  ['getGPSExceptions', 'proposeGPSException', 'grantGPSException', 'approveGPSException',
   'revokeGPSException', 'setEmergencyGPSMode'].forEach(a => {
    const kq = g.callPost(a, { userID: 'U999' });
    assert.strictEqual(kq.success, false);
    assert.ok(kq.message.indexOf('Không nhận diện') >= 0, a + ' phải không còn route | nhận: ' + kq.message);
  });
});

t('flag FALSE: checkIn KHÔNG ghi event vào CHAM_CONG_EVENT', () => {
  const g = moiTruongChuan();
  okTrue(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)));
  assert.strictEqual(g.sheetRows('CHAM_CONG_EVENT').length, 0, 'AttendanceV2 FALSE -> không có event');
});

t('flag FALSE: guard khóa kỳ vô hiệu (checkKyKhoa_ trả null dù CHOT_KY có dòng)', () => {
  const g = moiTruongChuan();
  // Giả lập dòng chốt kỳ có sẵn trên sheet nhưng PayrollLock đang FALSE
  g.appendRow('CHOT_KY', { ChotID: 'CK-GIA', Loai: 'CONG', Thang: String(new Date().getMonth() + 1), Nam: String(new Date().getFullYear()), LanChot: '1', TrangThai: 'Đã chốt' });
  g.newRequest();
  assert.strictEqual(g.checkKyKhoa_('CONG', ngayThangNay(2)), null, 'PayrollLock FALSE -> guard phải trả null');
  // Hàm cũ vẫn chạy bình thường
  okTrue(g.createBonusPenalty({ managerUserID: 'U999', targetUserID: 'U001', thang: new Date().getMonth() + 1, nam: new Date().getFullYear(), loai: 'Thưởng', soTien: '100000', lyDo: 'x' }));
});

t('giá trị flag lạ (VD "ABC") coi như FALSE', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_MODULE', 'Module', 'KPI', { Enable: 'ABC' });
  g.newRequest();
  okFalse(g.getKPIToday('U999', ''), 'Chức năng đang tắt');
});

t('TEST: quản lý dùng được, nhân viên thường bị chặn ở backend', () => {
  const g = moiTruongChuan();
  okTrue(g.updateModuleConfig({ userID: 'U999', module: 'Overtime', enable: 'TEST' }));
  g.newRequest();
  okTrue(g.submitOvertimeRequest({ userID: 'U999', ngay: homNay(), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'test' }));
  g.newRequest();
  okFalse(g.submitOvertimeRequest({ userID: 'U001', ngay: homNay(), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'test' }), 'Chức năng đang tắt');
});

module.exports = tests;
