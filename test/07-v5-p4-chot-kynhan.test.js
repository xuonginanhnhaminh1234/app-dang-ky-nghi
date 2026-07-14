/**
 * 07 - V5 P4: khóa công/lương (guard 11 hàm), snapshot LanChot/HieuLuc,
 * phiếu lương + ký nhận, dashboard chủ xưởng.
 */
'use strict';
const {
  assert, okTrue, okFalse, moiTruongChuan, batFlags, themChamCong,
  ngayThangNay, thangNay, namNay, themNgay
} = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

function moiTruongP4() {
  const g = moiTruongChuan();
  batFlags(g, ['PayrollLock', 'SalaryConfirm', 'OwnerDashboard', 'SalaryHistory']);
  g.updateRowById('NHAN_VIEN', 'UserID', 'U001', { LuongCoBan: '2600000', HinhThucLuong: 'Theo tháng' });
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  g.newRequest();
  return g;
}

t('Chốt CÔNG: chặn chốt trùng; guard chặn đúng nhóm hàm CÔNG của tháng đã chốt', () => {
  const g = moiTruongP4();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okFalse(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }), 'không chốt trùng');
  g.newRequest();
  // Sửa công tháng đã chốt -> chặn
  const cc = g.sheetRows('CHAM_CONG')[0];
  okFalse(g.updateAttendanceByManager({ managerUserID: 'U999', chamCongID: cc.ChamCongID, gioVao: '08:00', lyDo: 'x' }), 'đã CHỐT');
  okFalse(g.createAttendanceByManager({ managerUserID: 'U999', targetUserID: 'U002', ngay: ngayThangNay(3), gioVao: '07:30', gioRa: '17:30', lyDo: 'x' }), 'đã CHỐT');
  // Duyệt nghỉ của ngày thuộc tháng đã chốt -> chặn (đơn tạo trước bằng append trực tiếp)
  g.appendRow('LICH_NGHI', { LeaveID: 'LV-P4', UserID: 'U002', HoTen: 'Phúc Hậu', PhongBan: 'KyThuat', NgayNghi: ngayThangNay(5), CaNghi: 'SANG', LoaiNghi: 'Có phép', LyDo: 'x', TrangThai: 'Chờ duyệt' });
  g.newRequest();
  okFalse(g.approveLeave({ managerUserID: 'U999', leaveID: 'LV-P4', xacNhanCanhBao: true }), 'đã CHỐT');
  // OT: tháng KHÁC (chưa chốt) vẫn duyệt được; OT thuộc tháng đã chốt bị chặn
  okTrue(g.createOvertime({ managerUserID: 'U999', targetUserID: 'U001', ngay: themNgay(40), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'x', duyetLuon: false }));
  const tcKhacThang = g.sheetRows('TANG_CA').slice(-1)[0].TangCaID;
  g.newRequest();
  okTrue(g.approveOvertime({ managerUserID: 'U999', tangCaID: tcKhacThang }));
  okTrue(g.createOvertime({ managerUserID: 'U999', targetUserID: 'U001', ngay: ngayThangNay(6), gioBatDau: '17:30', gioKetThuc: '18:30', lyDo: 'x', duyetLuon: false }));
  const tcThangChot = g.sheetRows('TANG_CA').slice(-1)[0].TangCaID;
  g.newRequest();
  okFalse(g.approveOvertime({ managerUserID: 'U999', tangCaID: tcThangChot }), 'đã CHỐT');
});

t('Chốt LƯƠNG đòi chốt CÔNG trước; snapshot LanChot=1 HieuLuc=TRUE; guard nhóm LƯƠNG', () => {
  const g = moiTruongP4();
  okFalse(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }), 'CHỐT CÔNG');
  g.newRequest();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  const bl = g.sheetRows('BANG_LUONG');
  assert.ok(bl.length >= 1, 'phải có snapshot');
  assert.ok(bl.every(r => r.LanChot === '1' && r.HieuLuc === 'TRUE'));
  g.newRequest();
  okFalse(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }), 'không chốt trùng');
  // Guard LƯƠNG: thưởng phạt tháng đã chốt lương -> chặn
  okFalse(g.createBonusPenalty({ managerUserID: 'U999', targetUserID: 'U001', thang: thangNay(), nam: namNay(), loai: 'Thưởng', soTien: '100000', lyDo: 'x' }), 'đã CHỐT LƯƠNG');
  // markAdvancePaid của đơn có NgayDeNghi tháng đã chốt -> chặn
  const tu = okTrue(g.submitAdvance({ userID: 'U001', soTien: '200000', lyDo: 'x' }));
  g.newRequest();
  okTrue(g.approveAdvance({ managerUserID: 'U999', tamUngID: tu.data.tamUngID }));
  g.newRequest();
  okFalse(g.markAdvancePaid({ managerUserID: 'U999', tamUngID: tu.data.tamUngID }), 'đã CHỐT LƯƠNG');
});

t('Mở khóa LƯƠNG (chỉ chủ xưởng, bắt buộc lý do): bản cũ HieuLuc=FALSE không xóa; chốt lại LanChot=2; ký lại', () => {
  const g = moiTruongP4();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  // NV ký bản 1
  const phieu1 = okTrue(g.getMyPayslip('U001', thangNay(), namNay())).data;
  okTrue(g.confirmSalaryReceived({ userID: 'U001', bangLuongID: phieu1.bangLuongID, thietBi: 'test' }));
  g.newRequest();
  okFalse(g.confirmSalaryReceived({ userID: 'U001', bangLuongID: phieu1.bangLuongID }), 'đã ký');
  // PM thường không mở khóa được
  g.appendRow('QUYEN_NHAN_SU', { UserID: 'U002', DuocQuanLyNhanSu: 'TRUE', DuocSuaCong: 'TRUE', DuocXemBangLuong: 'TRUE', DuocDuyetTamUng: 'TRUE', DuocChotLuong: 'TRUE', TrangThai: 'Active' });
  g.newRequest();
  okFalse(g.unlockPeriod({ userID: 'U002', loai: 'LUONG', thang: thangNay(), nam: namNay(), lyDo: 'x' }), 'chủ xưởng');
  okFalse(g.unlockPeriod({ userID: 'U999', loai: 'LUONG', thang: thangNay(), nam: namNay(), lyDo: '' }), 'lý do');
  okTrue(g.unlockPeriod({ userID: 'U999', loai: 'LUONG', thang: thangNay(), nam: namNay(), lyDo: 'bổ sung thưởng' }));
  g.newRequest();
  // Bản 1 còn nguyên nhưng hết hiệu lực, KHÔNG xóa
  const bl = g.sheetRows('BANG_LUONG');
  assert.ok(bl.length >= 1 && bl.every(r => r.HieuLuc === 'FALSE'), 'bản 1 phải HieuLuc=FALSE, không xóa');
  assert.strictEqual(bl.find(r => r.UserID === 'U001').DaKyNhan, 'TRUE', 'chữ ký bản cũ giữ nguyên');
  // NV mở phiếu lúc chưa chốt lại -> báo chưa chốt
  okFalse(g.getMyPayslip('U001', thangNay(), namNay()), 'chưa chốt');
  // Chốt lại -> LanChot=2, NV ký lại bản mới
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  const phieu2 = okTrue(g.getMyPayslip('U001', thangNay(), namNay())).data;
  assert.strictEqual(phieu2.lanChot, 2);
  assert.strictEqual(phieu2.daKyNhan, false, 'bản mới phải ký lại');
  okTrue(g.confirmSalaryReceived({ userID: 'U001', bangLuongID: phieu2.bangLuongID, thietBi: 'test' }));
  // Ký bản cũ (hết hiệu lực) bị chặn
  g.newRequest();
  okFalse(g.confirmSalaryReceived({ userID: 'U002', bangLuongID: phieu1.bangLuongID }), 'chính mình');
});

t('Mở khóa CÔNG bị chặn khi LƯƠNG cùng tháng đang chốt', () => {
  const g = moiTruongP4();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okFalse(g.unlockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay(), lyDo: 'x' }), 'mở khóa LƯƠNG trước');
});

t('getLockedPayroll + exportPayrollTSV (RC2 có flag): trả bản hiệu lực; NV thường bị chặn quyền', () => {
  const g = moiTruongP4();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  const kq = okTrue(g.getLockedPayroll('U999', thangNay(), namNay()));
  assert.ok(kq.data.bangLuong.length >= 1);
  const tsv = okTrue(g.exportPayrollTSV('U999', thangNay(), namNay()));
  assert.ok(tsv.data.tsv.indexOf('THỰC NHẬN') >= 0, 'TSV phải có header');
  okFalse(g.getLockedPayroll('U001', thangNay(), namNay()), 'quyền');
});

t('getMyPayslip: NV chỉ thấy phiếu CỦA MÌNH', () => {
  const g = moiTruongP4();
  okTrue(g.lockPeriod({ userID: 'U999', loai: 'CONG', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  okTrue(g.lockPayroll({ userID: 'U999', thang: thangNay(), nam: namNay() }));
  g.newRequest();
  const p1 = okTrue(g.getMyPayslip('U001', thangNay(), namNay())).data;
  assert.strictEqual(p1.userID, 'U001');
  // U002 không ký được phiếu U001
  okFalse(g.confirmSalaryReceived({ userID: 'U002', bangLuongID: p1.bangLuongID }), 'chính mình');
});

t('getOwnerDashboard: đủ khối số; user không quyền bị chặn', () => {
  const g = moiTruongP4();
  const kq = okTrue(g.getOwnerDashboard('U999'));
  const d = kq.data;
  ['diLam', 'tongActive', 'nghi', 'diTre', 'chuaRa', 'chuaVao', 'viecPMChuaXuLy', 'pmDaChotNgay', 'nhacNho'].forEach(k => {
    assert.ok(k in d, 'thiếu khối ' + k);
  });
  g.newRequest();
  okFalse(g.getOwnerDashboard('U001'), 'quyền');
});

module.exports = tests;
