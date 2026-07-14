/**
 * 01 - REGRESSION V3.3.3: đăng nhập, nghỉ phép + slot, chấm công GPS,
 * tính công theo phòng ban, cache, tạm ứng/thưởng phạt/tăng ca/lương sơ bộ.
 * Toàn bộ chạy với MỌI FLAG V4/V5 = FALSE (mặc định sau setup) -> hành vi V3.3.3.
 */
'use strict';
const {
  assert, okTrue, okFalse, moiTruongChuan, themChamCong,
  ngayThangNay, thangNay, namNay, themNgay, TRONG_XUONG, NGOAI_XUONG
} = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

t('setupSheets + setupSheetsV5 tạo đủ sheet nền V3.3.3 + V4 + V5', () => {
  const g = moiTruongChuan();
  const can = ['USERS', 'LICH_NGHI', 'CHAM_CONG', 'NHAN_VIEN', 'CAU_HINH_MODULE', 'DOI_CA', 'VE_SOM',
    'THONG_BAO', 'CHOT_KY', 'BANG_LUONG', 'KPI_NGAY', 'CAU_HINH_KPI', 'CHAM_CONG_EVENT',
    'DIEU_CHINH_CONG', 'LICH_SU_LUONG', 'QUYET_DINH_NHAN_SU', 'CAU_HINH_CONG_CHUAN', 'PHIEN_XU_LY_PM'];
  can.forEach(name => assert.ok(g.__ss.getSheetByName(name), 'thiếu sheet ' + name));
  assert.ok(!g.__ss.getSheetByName('NGOAI_LE_GPS'), 'RC2 KHÔNG được tạo sheet NGOAI_LE_GPS');
});

t('setupSheetsV5 idempotent: chạy lần 2 trả báo cáo rỗng', () => {
  const g = moiTruongChuan();
  g.newRequest();
  const bc = g.setupSheetsV5();
  assert.strictEqual(bc.sheetTaoMoi.length, 0, 'lần 2 không được tạo sheet: ' + JSON.stringify(bc.sheetTaoMoi));
  assert.strictEqual(bc.cotNoiThem.length, 0, 'lần 2 không được nối cột: ' + JSON.stringify(bc.cotNoiThem));
  assert.strictEqual(bc.dongSeed.length, 0, 'lần 2 không được seed: ' + JSON.stringify(bc.dongSeed));
});

t('loginFull PIN đúng/sai + flag mặc định FALSE toàn bộ', () => {
  const g = moiTruongChuan();
  const res = okTrue(g.loginFull('1111'));
  assert.strictEqual(res.data.user.userID, 'U001');
  assert.strictEqual(res.data.user.hoTen, 'Kiều Doan');
  okFalse(g.loginFull('0000'), 'PIN');
  // Mọi module đều FALSE sau setup
  const mc = okTrue(g.getModuleConfig('U999'));
  mc.data.forEach(m => assert.strictEqual(m.trangThai, 'FALSE', m.module + ' phải FALSE mặc định'));
  assert.strictEqual(mc.data.length, 13, 'phải có đủ 13 flag');
});

t('refreshFull user Active + user bị khóa', () => {
  const g = moiTruongChuan();
  okTrue(g.refreshFull('U001'));
  g.updateRowById('USERS', 'UserID', 'U001', { TrangThai: 'Inactive' });
  g.newRequest();
  okFalse(g.refreshFull('U001'));
});

t('submitLeave: đúng hạn báo trước -> Chờ duyệt; quá gần -> chặn; trùng -> chặn', () => {
  const g = moiTruongChuan();
  const ngayTest = themNgay(3);
  okTrue(g.submitLeave({ userID: 'U001', ngayNghi: ngayTest, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'test' }));
  g.newRequest();
  okFalse(g.submitLeave({ userID: 'U001', ngayNghi: themNgay(1), caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'test' }), 'trước ít nhất');
  okFalse(g.submitLeave({ userID: 'U001', ngayNghi: ngayTest, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'test' }));
});

t('slot đầy -> chặn + yêu cầu đặc biệt; duyệt thường bị chặn vượt slot; approveOverSlot OK', () => {
  const g = moiTruongChuan();
  const ngayTest = themNgay(4);
  // CSKH slot SANG = 1. Thêm 1 user CSKH nữa.
  g.appendRow('USERS', { UserID: 'U004', HoTen: 'Test CSKH', MaPIN: '4444', PhongBan: 'CSKH', VaiTro: 'NhanVien', DuocXemDashboard: 'FALSE', DuocDuyetNghi: 'FALSE', DuocSuaCauHinh: 'FALSE', TrangThai: 'Active' });
  g.newRequest();
  okTrue(g.submitLeave({ userID: 'U001', ngayNghi: ngayTest, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'a' }));
  g.newRequest();
  const kq = okFalse(g.submitLeave({ userID: 'U004', ngayNghi: ngayTest, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'b' }), 'đủ số người');
  assert.ok(kq.data && kq.data.canSpecialRequest === true, 'phải mời gửi yêu cầu đặc biệt');
  g.newRequest();
  const db = okTrue(g.submitLeave({ userID: 'U004', ngayNghi: ngayTest, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'b', forceSpecialRequest: true }));
  const leaveID = db.data.leaveID;
  g.newRequest();
  okFalse(g.approveLeave({ managerUserID: 'U999', leaveID: leaveID, xacNhanCanhBao: true }), 'vượt slot');
  g.newRequest();
  okTrue(g.approveOverSlot({ managerUserID: 'U999', leaveID: leaveID, xacNhanCanhBao: true }));
});

t('duyệt / từ chối (bắt buộc lý do) / hủy đơn - có LEAVE_HISTORY', () => {
  const g = moiTruongChuan();
  const n1 = themNgay(5), n2 = themNgay(6);
  const d1 = okTrue(g.submitLeave({ userID: 'U002', ngayNghi: n1, caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'x' }));
  g.newRequest();
  const d2 = okTrue(g.submitLeave({ userID: 'U002', ngayNghi: n2, caNghi: 'CHIEU', loaiNghi: 'Ốm', lyDo: 'y' }));
  g.newRequest();
  okTrue(g.approveLeave({ managerUserID: 'U999', leaveID: d1.data.leaveID, xacNhanCanhBao: true }));
  g.newRequest();
  okFalse(g.rejectLeave({ managerUserID: 'U999', leaveID: d2.data.leaveID, lyDoTuChoi: '' }), 'lý do');
  okTrue(g.rejectLeave({ managerUserID: 'U999', leaveID: d2.data.leaveID, lyDoTuChoi: 'bận đơn hàng' }));
  const hist = g.sheetRows('LEAVE_HISTORY');
  assert.ok(hist.length >= 4, 'LEAVE_HISTORY phải ghi từng thao tác (có ' + hist.length + ')');
});

t('nhân viên chỉ thấy đơn của mình (getMyLeaves)', () => {
  const g = moiTruongChuan();
  okTrue(g.submitLeave({ userID: 'U001', ngayNghi: themNgay(3), caNghi: 'SANG', loaiNghi: 'Có phép', lyDo: 'a' }));
  g.newRequest();
  const kq = okTrue(g.getMyLeaves('U002'));
  assert.strictEqual(kq.data.length, 0, 'U002 không được thấy đơn U001');
});

t('checkIn trong bán kính -> OK + lưu GPS; checkIn lần 2 bị chặn', () => {
  const g = moiTruongChuan();
  okTrue(g.checkIn(Object.assign({ userID: 'U001', ghiChu: '' }, TRONG_XUONG)));
  const cc = g.sheetRows('CHAM_CONG').filter(r => r.UserID === 'U001');
  assert.strictEqual(cc.length, 1);
  assert.ok(cc[0].GioVao, 'phải có giờ vào');
  assert.ok(Number(cc[0].KhoangCachVao) >= 0 && Number(cc[0].KhoangCachVao) <= 400, 'khoảng cách phải trong bán kính');
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'đã chấm vào');
});

t('checkOut khi chưa checkIn -> chặn; checkOut sau checkIn -> OK, tính giờ', () => {
  const g = moiTruongChuan();
  okFalse(g.checkOut(Object.assign({ userID: 'U002' }, TRONG_XUONG)), 'chưa chấm vào');
  g.newRequest();
  okTrue(g.checkIn(Object.assign({ userID: 'U002' }, TRONG_XUONG)));
  g.newRequest();
  okTrue(g.checkOut(Object.assign({ userID: 'U002' }, TRONG_XUONG)));
  const cc = g.sheetRows('CHAM_CONG').filter(r => r.UserID === 'U002')[0];
  assert.ok(cc.GioRa, 'phải có giờ ra');
  assert.strictEqual(cc.TrangThai, 'Hoàn tất');
  g.newRequest();
  okFalse(g.checkOut(Object.assign({ userID: 'U002' }, TRONG_XUONG)), 'đã chấm ra');
});

t('ChoPhepNhanVienChamCong=FALSE -> nhân viên không chấm được', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_CHAM_CONG', 'Key', 'ChoPhepNhanVienChamCong', { Value: 'FALSE' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'tạm khóa');
});

t('tính công V3.2: CSKH vào 08:00 trễ 25p (đã trừ 5p phép); GiaCong vào 08:00 không trễ', () => {
  const g = moiTruongChuan();
  const cskh = g.calcAttendanceForUser_('U001', 'CSKH', ngayThangNay(2), '08:00', '17:30');
  assert.strictEqual(cskh.diTre, true, 'CSKH 08:00 phải trễ');
  assert.strictEqual(cskh.soPhutTre, 25, 'CSKH trễ 25p, nhận ' + cskh.soPhutTre);
  const gc = g.calcAttendanceForUser_('U003', 'GiaCong', ngayThangNay(2), '08:00', '17:30');
  assert.strictEqual(gc.diTre, false, 'GiaCong 08:00 không trễ (ca 08:00)');
});

t('tính công FULL GiaCong 08:00-17:30 = 8h (trừ nghỉ trưa 12:00-13:30)', () => {
  const g = moiTruongChuan();
  const kq = g.calcAttendanceForUser_('U003', 'GiaCong', ngayThangNay(2), '08:00', '17:30');
  assert.strictEqual(kq.soGioLam, 8, 'GiaCong FULL phải 8h, nhận ' + kq.soGioLam);
});

t('LICH_LAM riêng thắng ca phòng ban', () => {
  const g = moiTruongChuan();
  const ngay = ngayThangNay(3);
  g.appendRow('LICH_LAM', {
    LichLamID: 'LL-T1', Ngay: ngay, UserID: 'U001', HoTen: 'Kiều Doan', PhongBan: 'CSKH',
    CaLam: 'FULL', GioBatDau: '09:00', GioKetThuc: '13:00', LaNgayNghi: 'FALSE'
  });
  g.newRequest();
  const kq = g.calcAttendanceForUser_('U001', 'CSKH', ngay, '09:00', '13:00');
  assert.strictEqual(kq.diTre, false, 'theo lịch riêng 09:00 không trễ');
});

t('updateAttendanceByManager: sửa giờ bắt buộc lý do + ghi CHAM_CONG_HISTORY (audit sửa công tay)', () => {
  const g = moiTruongChuan();
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  g.newRequest();
  const cc = g.sheetRows('CHAM_CONG')[0];
  okFalse(g.updateAttendanceByManager({ managerUserID: 'U999', chamCongID: cc.ChamCongID, gioVao: '08:00', lyDo: '' }), 'lý do');
  g.newRequest();
  okTrue(g.updateAttendanceByManager({ managerUserID: 'U999', chamCongID: cc.ChamCongID, gioVao: '08:00', lyDo: 'sửa test - đã xác minh' }));
  const hist = g.sheetRows('CHAM_CONG_HISTORY');
  assert.ok(hist.length >= 1, 'phải có audit log');
});

t('nhân viên thường không sửa được công / không xem được công người khác', () => {
  const g = moiTruongChuan();
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  g.newRequest();
  const cc = g.sheetRows('CHAM_CONG')[0];
  okFalse(g.updateAttendanceByManager({ managerUserID: 'U001', chamCongID: cc.ChamCongID, gioVao: '07:00', lyDo: 'x' }));
  okFalse(g.getAttendanceByDay('U001', ngayThangNay(2), {}));
});

t('tạm ứng: gửi -> duyệt -> đã chi; từ chối bắt buộc lý do', () => {
  const g = moiTruongChuan();
  const d = okTrue(g.submitAdvance({ userID: 'U001', soTien: '500000', lyDo: 'test' }));
  g.newRequest();
  okTrue(g.approveAdvance({ managerUserID: 'U999', tamUngID: d.data.tamUngID }));
  g.newRequest();
  okTrue(g.markAdvancePaid({ managerUserID: 'U999', tamUngID: d.data.tamUngID }));
  g.newRequest();
  const d2 = okTrue(g.submitAdvance({ userID: 'U001', soTien: '100000', lyDo: 'test2' }));
  g.newRequest();
  okFalse(g.rejectAdvance({ managerUserID: 'U999', tamUngID: d2.data.tamUngID, lyDo: '' }), 'lý do');
  okTrue(g.rejectAdvance({ managerUserID: 'U999', tamUngID: d2.data.tamUngID, lyDo: 'chưa tới kỳ' }));
});

t('thưởng phạt: tạo/sửa/xóa mềm', () => {
  const g = moiTruongChuan();
  okTrue(g.createBonusPenalty({ managerUserID: 'U999', targetUserID: 'U001', thang: thangNay(), nam: namNay(), loai: 'Thưởng', soTien: '200000', lyDo: 'test' }));
  const tpID = g.sheetRows('THUONG_PHAT')[0].ThuongPhatID;
  g.newRequest();
  okTrue(g.updateBonusPenalty({ managerUserID: 'U999', thuongPhatID: tpID, soTien: '300000', lyDo: 'test sửa' }));
  g.newRequest();
  okTrue(g.deleteBonusPenalty({ managerUserID: 'U999', thuongPhatID: tpID }));
  const rows = g.sheetRows('THUONG_PHAT');
  assert.strictEqual(rows.length, 1, 'xóa mềm - dòng vẫn còn');
  assert.strictEqual(rows[0].TrangThai, 'Deleted');
});

t('tăng ca QL: tạo chờ duyệt -> duyệt; getOvertimeList NV chỉ thấy của mình', () => {
  const g = moiTruongChuan();
  okTrue(g.createOvertime({ managerUserID: 'U999', targetUserID: 'U001', ngay: ngayThangNay(2), gioBatDau: '17:30', gioKetThuc: '19:00', lyDo: 'test', duyetLuon: false }));
  const tcID = g.sheetRows('TANG_CA')[0].TangCaID;
  g.newRequest();
  okTrue(g.approveOvertime({ managerUserID: 'U999', tangCaID: tcID }));
  g.newRequest();
  const cua2 = okTrue(g.getOvertimeList('U002', {}));
  assert.strictEqual(cua2.data.length, 0, 'U002 không thấy OT của U001');
  const cua1 = okTrue(g.getOvertimeList('U001', {}));
  assert.strictEqual(cua1.data.length, 1);
});

t('lương sơ bộ cũ (getPayrollDraft) vẫn chạy khi mọi flag FALSE', () => {
  const g = moiTruongChuan();
  g.updateRowById('NHAN_VIEN', 'UserID', 'U001', { LuongCoBan: '2600000', HinhThucLuong: 'Theo tháng' });
  themChamCong(g, 'U001', 'Kiều Doan', 'CSKH', ngayThangNay(2), '07:30', '17:30', 8, 0);
  g.newRequest();
  const kq = okTrue(g.getPayrollDraft('U999', thangNay(), namNay(), {}));
  assert.ok(Array.isArray(kq.data.bangLuong), 'phải trả bảng lương');
});

t('cache: sửa qua app -> hiệu lực NGAY trong request sau (invalidate)', () => {
  const g = moiTruongChuan();
  okTrue(g.getGeneralConfig('U999'));
  okTrue(g.updateGeneralConfig({ userID: 'U999', key: 'SoNgayBaoTruoc', value: '3' }));
  g.newRequest();
  const kq = okTrue(g.getGeneralConfig('U999'));
  const dong = kq.data.find(r => r.key === 'SoNgayBaoTruoc');
  assert.strictEqual(String(dong.value), '3', 'giá trị mới phải hiệu lực ngay');
});

t('doGet trả version V5.0-RC2; doPost action lạ báo lỗi rõ', () => {
  const g = moiTruongChuan();
  const v = JSON.parse(g.doGet({})._content);
  assert.strictEqual(v.data.version, 'V5.0-RC2');
  const kq = g.callPost('actionKhongTonTai', {});
  assert.strictEqual(kq.success, false);
  assert.ok(kq.message.indexOf('Không nhận diện') >= 0);
});

module.exports = tests;
