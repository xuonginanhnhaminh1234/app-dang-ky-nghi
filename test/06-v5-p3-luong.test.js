/**
 * 06 - V5 P3: Quyết định nhân sự, lịch sử lương append-only, lương áp dụng,
 * bảng lương V5 chia giai đoạn (Q2) + quy chế phép 2 ngày/tháng.
 */
'use strict';
const { assert, okTrue, okFalse, moiTruongChuan, batFlags, themChamCong, ngayThangNay, thangNay, namNay } = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

function moiTruongP3() {
  const g = moiTruongChuan();
  batFlags(g, ['SalaryHistory']);
  g.updateRowById('NHAN_VIEN', 'UserID', 'U001', { LuongCoBan: '2600000', HinhThucLuong: 'Theo tháng' });
  // Công chuẩn tháng này = 26 (mặc định CongChuanMacDinh)
  g.newRequest();
  return g;
}

t('Flag SalaryHistory FALSE: lương đọc NHAN_VIEN (fallback nguyên trạng V3.3.3)', () => {
  const g = moiTruongChuan();
  g.updateRowById('NHAN_VIEN', 'UserID', 'U001', { LuongCoBan: '2600000' });
  g.newRequest();
  const l = g.getLuongApDung_('U001', ngayThangNay(10));
  assert.strictEqual(l.nguon, 'NHAN_VIEN');
  assert.strictEqual(l.luongThang, 2600000);
});

t('createDecision ChinhThuc -> chủ xưởng duyệt -> sinh bản ghi LICH_SU_LUONG + NgayChinhThuc', () => {
  const g = moiTruongP3();
  const d = okTrue(g.createDecision({
    userID: 'U999', targetUserID: 'U001', loai: 'ChinhThuc', hieuLucTu: ngayThangNay(16),
    lyDo: 'hết thử việc đạt', luongChinhThuc: '2600000'
  }));
  g.newRequest();
  okTrue(g.approveDecision({ userID: 'U999', qdID: d.data.qdID }));
  const ls = g.sheetRows('LICH_SU_LUONG');
  assert.strictEqual(ls.length, 1);
  assert.strictEqual(Number(ls[0].LuongApDung), 2600000);
  assert.strictEqual(Number(ls[0].TyLe), 100, 'ChinhThuc luôn 100%');
  const nv = g.sheetRows('NHAN_VIEN').find(r => r.UserID === 'U001');
  assert.strictEqual(nv.NgayChinhThuc, ngayThangNay(16));
});

t('Bản ghi lương mới đóng HieuLucDen bản cũ (append-only, không ghi đè)', () => {
  const g = moiTruongP3();
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2000000', tyLe: 100, hieuLucTu: ngayThangNay(1), lyDo: 'ban đầu' });
  g.newRequest();
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayThangNay(16), lyDo: 'tăng lương' });
  g.newRequest();
  const ls = g.sheetRows('LICH_SU_LUONG');
  assert.strictEqual(ls.length, 2, 'không ghi đè - phải 2 bản ghi');
  const banCu = ls.find(r => Number(r.LuongChinhThuc) === 2000000);
  assert.strictEqual(banCu.HieuLucDen, ngayThangNay(15), 'bản cũ phải đóng HieuLucDen = trước ngày hiệu lực mới');
  // getLuongApDung đúng theo ngày
  assert.strictEqual(g.getLuongApDung_('U001', ngayThangNay(10)).luongThang, 2000000);
  assert.strictEqual(g.getLuongApDung_('U001', ngayThangNay(20)).luongThang, 2600000);
});

t('Thử việc 85%: LuongApDung = hệ TỰ TÍNH ChinhThuc × TyLe (không nhập tay)', () => {
  const g = moiTruongP3();
  g.themBanGhiLuong_({ UserID: 'U002', HoTen: 'Phúc Hậu' }, { luongChinhThuc: '3000000', tyLe: 85, hieuLucTu: ngayThangNay(1), lyDo: 'thử việc' });
  const ls = g.sheetRows('LICH_SU_LUONG')[0];
  assert.strictEqual(Number(ls.LuongApDung), 2550000, '85% của 3tr = 2.55tr');
});

t('Bảng lương V5 chia giai đoạn giữa tháng theo NGÀY CÔNG THỰC TẾ (Q2)', () => {
  const g = moiTruongP3();
  // Giai đoạn 1 (ngày 1-15): thử việc 85% của 2.6tr = 2.21tr; giai đoạn 2 (16+): 100%
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 85, hieuLucTu: ngayThangNay(1), lyDo: 'thử việc' });
  g.newRequest();
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayThangNay(16), lyDo: 'chính thức' });
  // 2 công giai đoạn 1 + 3 công giai đoạn 2
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(3), '07:30', '17:30', 8, 0);
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(17), '07:30', '17:30', 8, 0);
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(18), '07:30', '17:30', 8, 0);
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(19), '07:30', '17:30', 8, 0);
  g.newRequest();
  const kq = okTrue(g.getPayrollV5('U999', thangNay(), namNay(), {}));
  const r = kq.data.bangLuong.find(x => x.userID === 'U001');
  assert.strictEqual(r.giaiDoan.length, 2, 'phải 2 giai đoạn, nhận ' + r.giaiDoan.length);
  // Giai đoạn 1: 2210000/26*2 = 170000; giai đoạn 2: 2600000/26*3 = 300000
  assert.strictEqual(r.giaiDoan[0].tien, Math.round(2210000 / 26 * 2), 'tiền giai đoạn 1');
  assert.strictEqual(r.giaiDoan[1].tien, Math.round(2600000 / 26 * 3), 'tiền giai đoạn 2');
  assert.strictEqual(r.tongCong, 5);
});

t('Quy chế phép: nghỉ Có phép 1 ngày -> hưởng lương; phần không nghỉ cộng tiền; vượt hạn mức cảnh báo', () => {
  const g = moiTruongP3();
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayThangNay(1), lyDo: 'x' });
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  // 1 đơn Có phép FULL đã duyệt trong tháng
  g.appendRow('LICH_NGHI', {
    LeaveID: 'LV-T1', UserID: 'U001', HoTen: 'Kiều Doan', PhongBan: 'CSKH',
    NgayNghi: ngayThangNay(3), CaNghi: 'FULL', LoaiNghi: 'Có phép', LyDo: 'x', TinhCong: 'Tính phép',
    TrangThai: 'Đã duyệt', LaYeuCauDacBiet: 'FALSE', VuotSlot: 'FALSE'
  });
  g.newRequest();
  const kq = okTrue(g.getPayrollV5('U999', thangNay(), namNay(), {}));
  const r = kq.data.bangLuong.find(x => x.userID === 'U001');
  const donGia = Math.round(2600000 / 26); // 100k/ngày
  assert.strictEqual(r.phepDaNghi, 1);
  assert.strictEqual(r.phepConLai, 1);
  assert.strictEqual(r.tienPhepKhongNghi, donGia, 'còn 1 ngày phép không nghỉ -> cộng ' + donGia);
  assert.strictEqual(r.tongCong, 2, '1 công thực tế + 1 công phép hưởng lương');
  assert.strictEqual(r.tienCong, Math.round(2600000 / 26 * 2));
  // Vượt hạn mức: thêm 2 đơn FULL nữa (tổng 3 > 2)
  g.appendRow('LICH_NGHI', { LeaveID: 'LV-T2', UserID: 'U001', HoTen: 'Kiều Doan', PhongBan: 'CSKH', NgayNghi: ngayThangNay(4), CaNghi: 'FULL', LoaiNghi: 'Có phép', LyDo: 'x', TrangThai: 'Đã duyệt' });
  g.appendRow('LICH_NGHI', { LeaveID: 'LV-T3', UserID: 'U001', HoTen: 'Kiều Doan', PhongBan: 'CSKH', NgayNghi: ngayThangNay(5), CaNghi: 'FULL', LoaiNghi: 'Có phép', LyDo: 'x', TrangThai: 'Đã duyệt' });
  g.newRequest();
  const kq2 = okTrue(g.getPayrollV5('U999', thangNay(), namNay(), {}));
  const r2 = kq2.data.bangLuong.find(x => x.userID === 'U001');
  assert.strictEqual(r2.phepDaNghi, 2, 'hưởng tối đa hạn mức 2');
  assert.strictEqual(r2.tienPhepKhongNghi, 0);
  assert.ok(r2.canhBao.indexOf('VƯỢT hạn mức') >= 0, 'phải cảnh báo vượt hạn mức');
});

t('SoNgayPhepThang là cấu hình (đổi 2 -> 3 có hiệu lực)', () => {
  const g = moiTruongP3();
  g.updateRowById('CAU_HINH_CHUNG', 'Key', 'SoNgayPhepThang', { Value: '3' });
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayThangNay(1), lyDo: 'x' });
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  g.newRequest();
  const kq = okTrue(g.getPayrollV5('U999', thangNay(), namNay(), {}));
  const r = kq.data.bangLuong.find(x => x.userID === 'U001');
  assert.strictEqual(r.phepConLai, 3, 'hạn mức mới = 3');
});

t('Công chuẩn theo CAU_HINH_CONG_CHUAN (tháng/phòng ban) thắng mặc định', () => {
  const g = moiTruongP3();
  g.appendRow('CAU_HINH_CONG_CHUAN', { Thang: String(thangNay()), Nam: String(namNay()), PhongBan: 'CSKH', CongChuan: '24' });
  g.newRequest();
  assert.strictEqual(g.getCongChuan_(thangNay(), namNay(), 'CSKH'), 24);
  assert.strictEqual(g.getCongChuan_(thangNay(), namNay(), 'GiaCong'), 26, 'PB khác vẫn mặc định 26');
});

t('Quyết định TangLuong duyệt xong: mốc xét tăng lương 6 tháng derive từ bản ghi mới nhất', () => {
  const g = moiTruongP3();
  // NV chính thức từ 7 tháng trước -> đến kỳ (quá hạn)
  const d7 = new Date(); d7.setMonth(d7.getMonth() - 7);
  const ngayCT = d7.getFullYear() + '-' + String(d7.getMonth() + 1).padStart(2, '0') + '-01';
  g.updateRowById('NHAN_VIEN', 'UserID', 'U001', { NgayChinhThuc: ngayCT });
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayCT, lyDo: 'chính thức' });
  g.newRequest();
  let due = g.getSalaryReviewDue_();
  assert.ok(due.some(x => x.userID === 'U001'), 'phải nằm trong danh sách đến kỳ xét');
  // Duyệt tăng lương hôm nay -> mốc mới +6 tháng -> hết nằm trong danh sách (<=30 ngày)
  const d = okTrue(g.createDecision({ userID: 'U999', targetUserID: 'U001', loai: 'TangLuong', hieuLucTu: ngayThangNay(new Date().getDate()), lyDo: 'đến kỳ', luongChinhThuc: '3000000' }));
  g.newRequest();
  okTrue(g.approveDecision({ userID: 'U999', qdID: d.data.qdID }));
  g.newRequest();
  due = g.getSalaryReviewDue_();
  assert.ok(!due.some(x => x.userID === 'U001'), 'sau tăng lương mốc tự dời 6 tháng');
});

t('Quyết định NghiViec: duyệt -> USERS Inactive + NHAN_VIEN nghỉ việc (không xóa dòng)', () => {
  const g = moiTruongP3();
  const d = okTrue(g.createDecision({ userID: 'U999', targetUserID: 'U003', loai: 'NghiViec', hieuLucTu: ngayThangNay(20), lyDo: 'xin nghỉ', noiDungMoi: 'Nghỉ việc' }));
  g.newRequest();
  okTrue(g.approveDecision({ userID: 'U999', qdID: d.data.qdID }));
  const us = g.sheetRows('USERS').find(r => r.UserID === 'U003');
  assert.strictEqual(us.TrangThai, 'Inactive');
  const nv = g.sheetRows('NHAN_VIEN').find(r => r.UserID === 'U003');
  assert.strictEqual(nv.TrangThaiLamViec, 'Nghỉ việc');
});

t('Quyết định: PM đề xuất được, duyệt CHỈ chủ xưởng; từ chối bắt buộc lý do', () => {
  const g = moiTruongP3();
  g.appendRow('QUYEN_NHAN_SU', { UserID: 'U002', DuocQuanLyNhanSu: 'TRUE', DuocSuaCong: 'TRUE', DuocXemBangLuong: 'FALSE', DuocDuyetTamUng: 'FALSE', DuocChotLuong: 'FALSE', TrangThai: 'Active' });
  g.newRequest();
  const d = okTrue(g.createDecision({ userID: 'U002', targetUserID: 'U001', loai: 'TangLuong', hieuLucTu: ngayThangNay(20), lyDo: 'x', luongChinhThuc: '3000000' }));
  g.newRequest();
  okFalse(g.approveDecision({ userID: 'U002', qdID: d.data.qdID }), 'chủ xưởng');
  okFalse(g.rejectDecision({ userID: 'U999', qdID: d.data.qdID, lyDo: '' }), 'lý do');
  okTrue(g.rejectDecision({ userID: 'U999', qdID: d.data.qdID, lyDo: 'chưa tới kỳ' }));
});

t('getSalaryHistory: NV xem của mình; xem người khác cần quyền', () => {
  const g = moiTruongP3();
  g.themBanGhiLuong_({ UserID: 'U001', HoTen: 'Kiều Doan' }, { luongChinhThuc: '2600000', tyLe: 100, hieuLucTu: ngayThangNay(1), lyDo: 'x' });
  g.newRequest();
  okTrue(g.getSalaryHistory('U001', ''));
  okFalse(g.getSalaryHistory('U002', 'U001'), 'chính mình');
  okTrue(g.getSalaryHistory('U999', 'U001'));
});

module.exports = tests;
