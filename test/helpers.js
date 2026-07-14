'use strict';
const assert = require('assert');
const { taoMoiTruong } = require('./harness');

function okTrue(res, msg) {
  assert.ok(res && res.success === true, (msg || 'phải success=true') + ' | nhận: ' + JSON.stringify(res && res.message));
  return res;
}
function okFalse(res, chuaTuKhoa, msg) {
  assert.ok(res && res.success === false, (msg || 'phải success=false') + ' | nhận: ' + JSON.stringify(res));
  if (chuaTuKhoa) {
    assert.ok(String(res.message).indexOf(chuaTuKhoa) >= 0,
      (msg || '') + ' message phải chứa "' + chuaTuKhoa + '" | nhận: ' + res.message);
  }
  return res;
}

/** Ngày trong THÁNG HIỆN TẠI (dd = 1..28 luôn hợp lệ). */
function ngayThangNay(dd) {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0');
}
function thangNay() { const d = new Date(); return d.getMonth() + 1; }
function namNay() { const d = new Date(); return d.getFullYear(); }
function homNay() { const d = new Date(); return ngayThangNay(d.getDate()); }
function themNgay(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Môi trường chuẩn: setup xong + cấu hình chủ xưởng U999 + tọa độ xưởng hợp lệ. */
function moiTruongChuan() {
  const g = taoMoiTruong();
  // Chủ xưởng = U999 (quản lý mẫu)
  g.updateRowById('CAU_HINH_CHUNG', 'Key', 'ChuXuongUserID', { Value: 'U999' });
  // Địa điểm chấm công hợp lệ (DD001 mẫu đang trống tọa độ)
  g.updateRowById('CAU_HINH_DIA_DIEM_CHAM_CONG', 'DiaDiemID', 'DD001', {
    ViDo: '10.776530', KinhDo: '106.700981', BanKinhMet: '400', BatBuocGPS: 'TRUE', TrangThai: 'Active'
  });
  g.newRequest();
  return g;
}

/** Bật 1 loạt flag = TRUE. */
function batFlags(g, dsFlag) {
  dsFlag.forEach(m => {
    const kq = g.updateModuleConfig({ userID: 'U999', module: m, enable: 'TRUE' });
    if (!kq.success) throw new Error('Không bật được flag ' + m + ': ' + kq.message);
  });
  g.newRequest();
}

/** Thêm 1 dòng chấm công hoàn tất trực tiếp (dữ liệu nền cho test lương/bảng công). */
function themChamCong(g, userID, hoTen, phongBan, ngay, gioVao, gioRa, soGio, soGioOT) {
  g.appendRow('CHAM_CONG', {
    ChamCongID: 'CC-TEST-' + userID + '-' + ngay,
    UserID: userID, HoTen: hoTen, PhongBan: phongBan, Ngay: ngay,
    GioVao: gioVao, GioRa: gioRa, CaLam: 'FULL',
    SoGioLam: String(soGio), DiTre: 'FALSE', SoPhutTre: '0',
    VeSom: 'FALSE', SoPhutVeSom: '0',
    TangCa: soGioOT > 0 ? 'TRUE' : 'FALSE', SoGioTangCa: String(soGioOT || 0),
    TrangThai: 'Hoàn tất', ThoiGianTao: ngay + ' 08:00:00', ThoiGianCapNhat: ngay + ' 18:00:00'
  });
}

// Tọa độ: trong xưởng / ngoài xưởng (cách ~5km)
const TRONG_XUONG = { latitude: 10.776530, longitude: 106.700981, accuracy: 20 };
const NGOAI_XUONG = { latitude: 10.820000, longitude: 106.700981, accuracy: 20 };

module.exports = {
  assert, taoMoiTruong, okTrue, okFalse, moiTruongChuan, batFlags, themChamCong,
  ngayThangNay, thangNay, namNay, homNay, themNgay, TRONG_XUONG, NGOAI_XUONG
};
