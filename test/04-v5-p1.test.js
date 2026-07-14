/**
 * 04 - V5 P1: KPI, Dashboard PM + Chốt ngày, Đổi ca theo ngày, Về sớm, NV tự đăng ký OT.
 */
'use strict';
const { assert, okTrue, okFalse, moiTruongChuan, batFlags, homNay, themNgay, TRONG_XUONG } = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

function moiTruongP1() {
  const g = moiTruongChuan();
  batFlags(g, ['KPI', 'ReminderCenter', 'ShiftRequest', 'EarlyLeave', 'Overtime']);
  return g;
}

t('KPI: chỉ tiêu mặc định từ CAU_HINH_KPI; updateKPI upsert theo ngày+PB; NV thường bị chặn quyền', () => {
  const g = moiTruongP1();
  let kq = okTrue(g.getKPIToday('U999', ''));
  const cskh = kq.data.danhSach.find(x => x.phongBan === 'CSKH');
  assert.strictEqual(cskh.chiTieu, 100, 'chỉ tiêu mặc định 100');
  assert.strictEqual(cskh.daNhap, false);
  g.newRequest();
  okTrue(g.updateKPI({ userID: 'U999', phongBan: 'CSKH', thucTe: 42 }));
  g.newRequest();
  okTrue(g.updateKPI({ userID: 'U999', phongBan: 'CSKH', thucTe: 55 })); // upsert cùng dòng
  assert.strictEqual(g.sheetRows('KPI_NGAY').length, 1, 'upsert không tạo dòng trùng');
  g.newRequest();
  kq = okTrue(g.getKPIToday('U999', ''));
  assert.strictEqual(kq.data.danhSach.find(x => x.phongBan === 'CSKH').thucTe, 55);
  g.newRequest();
  okFalse(g.getKPIToday('U001', ''), 'quyền'); // NV thường (flag TRUE nhưng không phải QL)
  okFalse(g.updateKPI({ userID: 'U001', phongBan: 'CSKH', thucTe: 1 }), 'quyền');
});

t('updateKPIConfig (RC2 có flag): đổi chỉ tiêu mặc định; NV thường bị chặn', () => {
  const g = moiTruongP1();
  okTrue(g.updateKPIConfig({ userID: 'U999', phongBan: 'CSKH', chiTieuMacDinh: 120 }));
  g.newRequest();
  const kq = okTrue(g.getKPIConfig('U999'));
  assert.strictEqual(kq.data.find(x => x.phongBan === 'CSKH').chiTieuMacDinh, 120);
  okFalse(g.updateKPIConfig({ userID: 'U001', phongBan: 'CSKH', chiTieuMacDinh: 1 }), 'quyền');
});

t('Đổi ca: gửi -> trùng bị chặn -> duyệt tự ghi LICH_LAM -> chấm công tính ca mới', () => {
  const g = moiTruongP1();
  const ngay = themNgay(1);
  const d = okTrue(g.submitShiftChange({ userID: 'U003', ngay: ngay, caDeNghi: 'TUYCHINH', gioBatDau: '09:00', gioKetThuc: '13:00', lyDo: 'việc nhà' }));
  g.newRequest();
  okFalse(g.submitShiftChange({ userID: 'U003', ngay: ngay, caDeNghi: 'SANG', lyDo: 'x' }), 'đang chờ duyệt');
  g.newRequest();
  okTrue(g.approveShiftChange({ userID: 'U999', doiCaID: d.data.doiCaID }));
  const ll = g.sheetRows('LICH_LAM');
  assert.strictEqual(ll.length, 1, 'duyệt phải ghi 1 dòng LICH_LAM');
  assert.strictEqual(ll[0].GioBatDau, '09:00');
  g.newRequest();
  // Chấm công ngày đó tính theo lịch riêng 09:00-13:00
  const cc = g.calcAttendanceForUser_('U003', 'GiaCong', ngay, '09:00', '13:00');
  assert.strictEqual(cc.diTre, false, 'vào 09:00 theo ca mới không trễ');
});

t('Đổi ca: quá khứ bị chặn; từ chối bắt buộc lý do; NV hủy đơn chờ của mình', () => {
  const g = moiTruongP1();
  okFalse(g.submitShiftChange({ userID: 'U003', ngay: '2020-01-01', caDeNghi: 'SANG', lyDo: 'x' }), 'hôm nay trở đi');
  const d = okTrue(g.submitShiftChange({ userID: 'U003', ngay: themNgay(2), caDeNghi: 'SANG', lyDo: 'x' }));
  g.newRequest();
  okFalse(g.rejectShiftChange({ userID: 'U999', doiCaID: d.data.doiCaID, lyDo: '' }), 'lý do');
  // NV khác không hủy được đơn người khác
  okFalse(g.cancelMyShiftChange({ userID: 'U001', doiCaID: d.data.doiCaID }), 'chính mình');
  okTrue(g.cancelMyShiftChange({ userID: 'U003', doiCaID: d.data.doiCaID }));
  g.newRequest();
  okFalse(g.approveShiftChange({ userID: 'U999', doiCaID: d.data.doiCaID }), 'đã được xử lý');
});

t('Về sớm: gửi -> duyệt nối ghi chú vào CHAM_CONG nếu đã có dòng; từ chối/hủy đúng luật', () => {
  const g = moiTruongP1();
  // Có dòng chấm công hôm nay trước
  okTrue(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)));
  g.newRequest();
  const d = okTrue(g.submitEarlyLeave({ userID: 'U001', ngay: homNay(), gioVeSom: '16:00', lyDo: 'đón con' }));
  g.newRequest();
  okTrue(g.approveEarlyLeave({ userID: 'U999', veSomID: d.data.veSomID }));
  const cc = g.sheetRows('CHAM_CONG')[0];
  assert.ok(String(cc.GhiChuQuanLy).indexOf('Về sớm CÓ PHÉP') >= 0, 'phải nối ghi chú đối chiếu');
  g.newRequest();
  const d2 = okTrue(g.submitEarlyLeave({ userID: 'U002', ngay: homNay(), gioVeSom: '15:00', lyDo: 'khám bệnh' }));
  g.newRequest();
  okFalse(g.rejectEarlyLeave({ userID: 'U999', veSomID: d2.data.veSomID, lyDo: '' }), 'lý do');
  okTrue(g.rejectEarlyLeave({ userID: 'U999', veSomID: d2.data.veSomID, lyDo: 'thiếu người' }));
});

t('OT nhân viên: đăng ký tự tính giờ -> hủy đơn chờ; duyệt bằng API cũ', () => {
  const g = moiTruongP1();
  const d = okTrue(g.submitOvertimeRequest({ userID: 'U001', ngay: homNay(), gioBatDau: '17:30', gioKetThuc: '19:00', lyDo: 'đơn gấp' }));
  g.newRequest();
  const tc = g.sheetRows('TANG_CA')[0];
  assert.strictEqual(Number(tc.SoGioTangCa), 1.5, 'tự tính 1.5h');
  assert.strictEqual(tc.TrangThai, 'Chờ duyệt');
  // duyệt bằng luồng cũ
  okTrue(g.approveOvertime({ managerUserID: 'U999', tangCaID: d.data.tangCaID }));
  g.newRequest();
  okFalse(g.cancelMyOvertime({ userID: 'U001', tangCaID: d.data.tangCaID }), 'Chỉ hủy được');
  // đơn mới rồi hủy
  const d2 = okTrue(g.submitOvertimeRequest({ userID: 'U001', ngay: themNgay(1), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'x' }));
  g.newRequest();
  okFalse(g.cancelMyOvertime({ userID: 'U002', tangCaID: d2.data.tangCaID }), 'chính mình');
  okTrue(g.cancelMyOvertime({ userID: 'U001', tangCaID: d2.data.tangCaID }));
});

t('getPMDashboard: 1 request gom KPI + cần xử lý + hôm nay; NV thường bị chặn', () => {
  const g = moiTruongP1();
  // 1 đơn nghỉ chờ + 1 OT chờ + 1 đổi ca chờ
  okTrue(g.submitLeave({ userID: 'U001', ngayNghi: themNgay(3), caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'x' }));
  g.newRequest();
  okTrue(g.submitOvertimeRequest({ userID: 'U002', ngay: homNay(), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'x' }));
  g.newRequest();
  okTrue(g.submitShiftChange({ userID: 'U003', ngay: themNgay(1), caDeNghi: 'SANG', lyDo: 'x' }));
  g.newRequest();
  const kq = okTrue(g.getPMDashboard('U999'));
  assert.ok(Array.isArray(kq.data.kpi), 'KPI bật -> phải có mảng kpi');
  assert.strictEqual(kq.data.canXuLy.length, 3, 'phải gom đủ 3 việc chờ, nhận ' + kq.data.canXuLy.length);
  assert.ok(kq.data.homNay.tongActive >= 4);
  assert.strictEqual(kq.data.daChotHomNay, false);
  g.newRequest();
  okFalse(g.getPMDashboard('U001'), 'quyền');
});

t('chotNgay: còn việc tồn -> đòi lý do (needLyDo); có lý do -> ghi PHIEN_XU_LY_PM + báo cáo', () => {
  const g = moiTruongP1();
  okTrue(g.submitLeave({ userID: 'U001', ngayNghi: themNgay(3), caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'x' }));
  g.newRequest();
  const c1 = okFalse(g.chotNgay({ userID: 'U999' }));
  assert.ok(c1.data && c1.data.needLyDo === true, 'phải trả needLyDo khi còn tồn');
  g.newRequest();
  const c2 = okTrue(g.chotNgay({ userID: 'U999', lyDoTon: 'đơn mới gửi cuối giờ, mai xử lý' }));
  assert.ok(c2.data.baoCao.indexOf('CHỐT NGÀY') >= 0, 'phải sinh báo cáo');
  const phien = g.sheetRows('PHIEN_XU_LY_PM');
  assert.strictEqual(phien.length, 1);
  assert.ok(Number(phien[0].SoViecConTon) >= 1);
  g.newRequest();
  const kq = okTrue(g.getPMDashboard('U999'));
  assert.strictEqual(kq.data.daChotHomNay, true);
});

t('chotNgay khi sạch việc: không cần lý do', () => {
  const g = moiTruongChuan();
  batFlags(g, ['ReminderCenter']);
  // Không seed gì hôm nay -> có thể còn "chưa checkout" = 0 vì không ai chấm
  const kq = okTrue(g.chotNgay({ userID: 'U999' }));
  assert.ok(kq.message.indexOf('sạch việc') >= 0 || kq.message.indexOf('Đã chốt') >= 0);
});

module.exports = tests;
