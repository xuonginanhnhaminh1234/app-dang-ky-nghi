/**
 * 05 - V5 P2: Event chấm công bất biến (dual-write) + phiếu điều chỉnh 2 cấp (Q1).
 */
'use strict';
const { assert, okTrue, okFalse, moiTruongChuan, batFlags, themChamCong, ngayThangNay, TRONG_XUONG } = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

function moiTruongP2() {
  const g = moiTruongChuan();
  batFlags(g, ['AttendanceV2']);
  return g;
}

t('AttendanceV2 bật: checkIn/checkOut ghi event append-only đủ trường', () => {
  const g = moiTruongP2();
  okTrue(g.checkIn(Object.assign({ userID: 'U001', thietBi: 'TestPhone Chrome' }, TRONG_XUONG)));
  g.newRequest();
  okTrue(g.checkOut(Object.assign({ userID: 'U001' }, TRONG_XUONG)));
  const ev = g.sheetRows('CHAM_CONG_EVENT');
  assert.strictEqual(ev.length, 2, 'phải có 2 event');
  assert.strictEqual(ev[0].Loai, 'CHECKIN');
  assert.strictEqual(ev[1].Loai, 'CHECKOUT');
  assert.ok(ev[0].ViDo && ev[0].KhoangCach !== '', 'event phải lưu vị trí');
  assert.strictEqual(ev[0].ThietBi, 'TestPhone Chrome');
});

t('Phiếu cấp A (BuCheckin): hiệu lực NGAY + áp vào CHAM_CONG + tính lại công + CoDieuChinh=TRUE', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(2);
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngay, '', '17:30', 0, 0); // quên chấm vào
  g.newRequest();
  const d = okTrue(g.createAdjustment({
    userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'BuCheckin', giaTriMoi: '07:30',
    lyDo: 'quên chấm - xác minh với tổ trưởng'
  }));
  assert.strictEqual(d.data.capDo, 'A');
  const cc = g.sheetRows('CHAM_CONG')[0];
  assert.strictEqual(cc.GioVao, '07:30');
  assert.strictEqual(cc.CoDieuChinh, 'TRUE');
  assert.ok(Number(cc.SoGioLam) > 0, 'phải tính lại giờ công (nhận ' + cc.SoGioLam + ')');
  const phieu = g.sheetRows('DIEU_CHINH_CONG')[0];
  assert.strictEqual(phieu.TrangThai, 'HieuLuc');
  assert.ok(phieu.GiaTriCu, 'phải lưu giá trị cũ');
});

t('Phiếu cấp A (MienDiTre): xóa cờ trễ, có audit', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(3);
  g.appendRow('CHAM_CONG', {
    ChamCongID: 'CC-T2', UserID: 'U001', HoTen: 'Kiều Doan', PhongBan: 'CSKH', Ngay: ngay,
    GioVao: '08:00', GioRa: '17:30', CaLam: 'FULL', SoGioLam: '7.5', DiTre: 'TRUE', SoPhutTre: '25',
    VeSom: 'FALSE', SoPhutVeSom: '0', TangCa: 'FALSE', SoGioTangCa: '0', TrangThai: 'Hoàn tất'
  });
  g.newRequest();
  okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'MienDiTre', giaTriMoi: '', lyDo: 'kẹt xe do tai nạn - cả tổ xác nhận' }));
  const cc = g.sheetRows('CHAM_CONG')[0];
  assert.strictEqual(cc.DiTre, 'FALSE');
  assert.strictEqual(cc.SoPhutTre, '0');
  assert.ok(g.sheetRows('CHAM_CONG_HISTORY').length >= 1, 'phải có audit');
});

t('Phiếu cấp B (BoSungCong): ChoDuyet - PM duyệt bị chặn, CHỦ XƯỞNG duyệt mới áp', () => {
  const g = moiTruongP2();
  // PM riêng (không phải chủ xưởng): cấp quyền suaCong cho U002
  g.appendRow('QUYEN_NHAN_SU', { UserID: 'U002', DuocQuanLyNhanSu: 'FALSE', DuocSuaCong: 'TRUE', DuocXemBangLuong: 'FALSE', DuocDuyetTamUng: 'FALSE', DuocChotLuong: 'FALSE', TrangThai: 'Active' });
  g.newRequest();
  const ngay = ngayThangNay(4);
  const d = okTrue(g.createAdjustment({ userID: 'U002', targetUserID: 'U001', ngay: ngay, loai: 'BoSungCong', giaTriMoi: '8', lyDo: 'đi công trình cả ngày' }));
  assert.strictEqual(d.data.capDo, 'B');
  assert.strictEqual(g.sheetRows('DIEU_CHINH_CONG')[0].TrangThai, 'ChoDuyet');
  g.newRequest();
  // PM (U002) tự duyệt -> chặn (chỉ chủ xưởng)
  okFalse(g.approveAdjustment({ userID: 'U002', phieuID: d.data.phieuID }), 'chủ xưởng');
  g.newRequest();
  okTrue(g.approveAdjustment({ userID: 'U999', phieuID: d.data.phieuID }));
  const cc = g.sheetRows('CHAM_CONG').find(r => r.UserID === 'U001');
  assert.strictEqual(Number(cc.SoGioLam), 8, 'duyệt xong phải áp 8h công');
  assert.strictEqual(cc.CoDieuChinh, 'TRUE');
});

t('Chủ xưởng tạo phiếu B rồi tự duyệt: được, nhưng ghi rõ 2 vai', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(5);
  const d = okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'DieuChinhOT', giaTriMoi: '2', lyDo: 'OT đột xuất có xác nhận' }));
  g.newRequest();
  okTrue(g.approveAdjustment({ userID: 'U999', phieuID: d.data.phieuID }));
  const phieu = g.sheetRows('DIEU_CHINH_CONG')[0];
  assert.ok(String(phieu.GhiChu).indexOf('2 vai') >= 0, 'phải ghi rõ 2 vai');
});

t('Từ chối/vô hiệu phiếu: bắt buộc lý do; vô hiệu không tự hoàn tác dữ liệu', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(6);
  const d = okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'BoSungCong', giaTriMoi: '8', lyDo: 'x' }));
  g.newRequest();
  okFalse(g.rejectAdjustment({ userID: 'U999', phieuID: d.data.phieuID, lyDo: '' }), 'lý do');
  okTrue(g.rejectAdjustment({ userID: 'U999', phieuID: d.data.phieuID, lyDo: 'không đủ căn cứ' }));
  g.newRequest();
  // Phiếu A hiệu lực rồi vô hiệu
  const d2 = okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'GhiChu', giaTriMoi: 'note test', lyDo: 'x' }));
  g.newRequest();
  okFalse(g.voidAdjustment({ userID: 'U999', phieuID: d2.data.phieuID, lyDo: '' }), 'lý do');
  okTrue(g.voidAdjustment({ userID: 'U999', phieuID: d2.data.phieuID, lyDo: 'tạo nhầm' }));
  const phieu = g.sheetRows('DIEU_CHINH_CONG').find(r => r.PhieuID === d2.data.phieuID);
  assert.strictEqual(phieu.TrangThai, 'VoHieu');
  assert.strictEqual(phieu.NguoiVoHieu, 'U999');
});

t('getAdjustments: NV thường chỉ thấy phiếu của mình', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(7);
  okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'GhiChu', giaTriMoi: 'a', lyDo: 'x' }));
  g.newRequest();
  okTrue(g.createAdjustment({ userID: 'U999', targetUserID: 'U002', ngay: ngay, loai: 'GhiChu', giaTriMoi: 'b', lyDo: 'x' }));
  g.newRequest();
  const cua1 = okTrue(g.getAdjustments('U001', {}));
  assert.strictEqual(cua1.data.length, 1, 'U001 chỉ thấy phiếu của mình');
  const quanLy = okTrue(g.getAdjustments('U999', {}));
  assert.strictEqual(quanLy.data.length, 2);
});

t('Phiếu điều chỉnh loại lạ / giờ sai / thiếu lý do -> chặn', () => {
  const g = moiTruongP2();
  const ngay = ngayThangNay(8);
  okFalse(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'HackLuong', giaTriMoi: '1', lyDo: 'x' }), 'không hợp lệ');
  okFalse(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'BuCheckin', giaTriMoi: '25:99', lyDo: 'x' }), 'không hợp lệ');
  okFalse(g.createAdjustment({ userID: 'U999', targetUserID: 'U001', ngay: ngay, loai: 'MienDiTre', giaTriMoi: '', lyDo: '' }), 'lý do');
});

module.exports = tests;
