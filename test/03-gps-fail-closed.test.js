/**
 * 03 - GPS FAIL-CLOSED ĐƠN GIẢN (V5.0-RC2, quyết định 13/07/2026):
 * A. không địa điểm Active -> chặn; dữ liệu sai -> chặn; bán kính <=0 -> chặn;
 * B. không GPS -> chặn; C. accuracy > 500 -> chặn;
 * D. ngoài bán kính -> chặn; trong bán kính -> cho.
 * KHÔNG còn lớp ngoại lệ / chế độ khẩn cấp.
 */
'use strict';
const { assert, okTrue, okFalse, taoMoiTruong, moiTruongChuan, TRONG_XUONG, NGOAI_XUONG } = require('./helpers');

const tests = [];
const t = (ten, fn) => tests.push({ ten, fn });

t('A1. Không có dòng địa điểm Active -> chặn "Chưa cấu hình"', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', { TrangThai: 'Inactive' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'Chưa cấu hình địa điểm');
});

t('A2. ViDo/KinhDo sai định dạng -> chặn "không hợp lệ" (không fallback)', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', { ViDo: 'abc' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'không hợp lệ');
});

t('A3. BanKinhMet = 0 -> dòng không hợp lệ -> chặn', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', { BanKinhMet: '0' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'không hợp lệ');
});

t('A4. BatBuocGPS = FALSE -> dòng không hợp lệ -> chặn (hết đường tắt)', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', { BatBuocGPS: 'FALSE' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'không hợp lệ');
});

t('A5. Mặc định sau setup (tọa độ trống) -> chặn (đúng fail-closed, không phải fail-open V3.3)', () => {
  const g = taoMoiTruong(); // KHÔNG set tọa độ
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)), 'không hợp lệ');
});

t('B. Không gửi GPS -> chặn "Không lấy được vị trí"', () => {
  const g = moiTruongChuan();
  okFalse(g.checkIn({ userID: 'U001', latitude: '', longitude: '', accuracy: '' }), 'Không lấy được vị trí');
});

t('C. Accuracy > 500m -> chặn "Độ chính xác"', () => {
  const g = moiTruongChuan();
  okFalse(g.checkIn({ userID: 'U001', latitude: 10.776530, longitude: 106.700981, accuracy: 800 }), 'Độ chính xác');
});

t('D1. Ngoài bán kính -> chặn "ngoài khu vực" kèm khoảng cách', () => {
  const g = moiTruongChuan();
  const kq = okFalse(g.checkIn(Object.assign({ userID: 'U001' }, NGOAI_XUONG)), 'ngoài khu vực');
  assert.ok(/\d+m/.test(kq.message), 'thông báo phải kèm khoảng cách mét');
});

t('D2. Trong bán kính -> CHO chấm, lưu đủ tọa độ + khoảng cách', () => {
  const g = moiTruongChuan();
  const kq = okTrue(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)));
  assert.ok(kq.message.indexOf('cách xưởng') >= 0);
  const cc = g.sheetRows('CHAM_CONG')[0];
  assert.ok(cc.ViDoVao && cc.KinhDoVao && cc.DoChinhXacVao !== '', 'phải lưu GPS vào');
});

t('validateAttendanceLocation_ không còn trường ngoaiLe trong kết quả', () => {
  const g = moiTruongChuan();
  g.newRequest();
  const kq = g.validateAttendanceLocation_(10.776530, 106.700981, 20);
  assert.strictEqual(kq.ok, true);
  assert.ok(!('ngoaiLe' in kq), 'kết quả validate không được còn trường ngoaiLe');
});

t('getTodayAttendance: khối gps gọn (không còn cheDoKhanCap/coNgoaiLe), batBuocGPS luôn true', () => {
  const g = moiTruongChuan();
  const kq = okTrue(g.getTodayAttendance('U001'));
  const gps = kq.data.gps;
  assert.strictEqual(gps.batBuocGPS, true);
  assert.strictEqual(gps.daCauHinhToaDo, true);
  assert.ok(!('cheDoKhanCap' in gps) && !('coNgoaiLe' in gps), 'gps payload không còn trường ngoại lệ');
});

t('Trường hợp đặc biệt: PM sửa công tay được (có audit) dù NV bị chặn GPS', () => {
  const g = moiTruongChuan();
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', { TrangThai: 'Inactive' });
  g.newRequest();
  okFalse(g.checkIn(Object.assign({ userID: 'U001' }, TRONG_XUONG)));
  g.newRequest();
  // PM thêm công tay - van xử lý đặc biệt duy nhất của RC2
  okTrue(g.createAttendanceByManager({
    managerUserID: 'U999', targetUserID: 'U001',
    ngay: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
    gioVao: '07:30', gioRa: '17:30', lyDo: 'NV đi giao hàng - PM xác nhận'
  }));
  const hist = g.sheetRows('CHAM_CONG_HISTORY');
  assert.ok(hist.length >= 1, 'sửa công tay phải có audit');
});

module.exports = tests;
