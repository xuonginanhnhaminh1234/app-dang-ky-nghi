async function openTamUngQL() {
  if (!options) await loadOptions();
  fillSelect($('tuqlPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  showScreen('scr-tamungql', 'Duyệt tạm ứng');
  loadTamUngQL();
}

async function loadTamUngQL() {
  $('tamUngQLBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getAllAdvances', {
    userID: user.userID,
    filters: { trangThai: $('tuqlTrangThai').value, phongBan: $('tuqlPhongBan').value }
  });
  if (!res.success) { tuqlData = []; $('tamUngQLBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  tuqlData = res.data;

  let html = '';
  tuqlData.forEach(r => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + escapeHtml(r.hoTen) + ' - ' + fmtMoney(r.soTien) + 'đ</b>' + badgeHtml(r.trangThai, false) + '</div>' +
      '<div class="line">' + escapeHtml(r.phongBan) + ' · đề nghị ' + fmtDate(r.ngayDeNghi) + '</div>' +
      '<div class="line">Lý do: ' + escapeHtml(r.lyDo) + '</div>' +
      (r.ghiChu ? '<div class="line muted">' + escapeHtml(r.ghiChu) + '</div>' : '') +
      (r.trangThai === 'Chờ duyệt'
        ? '<div class="btn-row">' +
          '<button class="btn green small" onclick="duyetTU(\'' + r.tamUngID + '\')">Duyệt</button>' +
          '<button class="btn red small" onclick="tuChoiTU(\'' + r.tamUngID + '\')">Từ chối</button>' +
          '</div>'
        : '') +
      (r.trangThai === 'Đã duyệt' ? '<button class="btn small green" onclick="daChiTU(\'' + r.tamUngID + '\')">💵 Đánh dấu ĐÃ CHI</button>' : '') +
      ((r.trangThai === 'Đã duyệt' || r.trangThai === 'Từ chối' || r.trangThai === 'Đã chi')
        ? '<button class="btn small" style="background:#455a64" onclick="copyTinTamUng(\'' + r.tamUngID + '\')">📋 Copy tin Zalo</button>' : '') +
      '</div>';
  });
  $('tamUngQLBox').innerHTML = html || '<div class="alert blue">Không có đề nghị tạm ứng nào khớp bộ lọc.</div>';
}

async function duyetTU(id) {
  if (!confirm('Duyệt đề nghị tạm ứng này?')) return;
  const res = await api('approveAdvance', { managerUserID: user.userID, tamUngID: id });
  res.success ? toast(res.message) : alert(res.message);
  loadTamUngQL();
}

async function tuChoiTU(id) {
  const lyDo = prompt('Lý do từ chối (bắt buộc):');
  if (lyDo === null) return;
  if (!lyDo.trim()) { alert('Phải nhập lý do.'); return; }
  const res = await api('rejectAdvance', { managerUserID: user.userID, tamUngID: id, lyDo: lyDo.trim() });
  res.success ? toast(res.message) : alert(res.message);
  loadTamUngQL();
}

async function daChiTU(id) {
  if (!confirm('Xác nhận đã chi tiền tạm ứng này?')) return;
  const res = await api('markAdvancePaid', { managerUserID: user.userID, tamUngID: id });
  res.success ? toast(res.message) : alert(res.message);
  loadTamUngQL();
}

function copyTamUngChoDuyet() {
  const ds = tuqlData.filter(r => r.trangThai === 'Chờ duyệt');
  let out = '💵 TẠM ỨNG CHỜ DUYỆT\n\n';
  out += ds.length ? ds.map(r => '- ' + r.hoTen + ' (' + r.phongBan + '): ' + fmtMoney(r.soTien) + 'đ - ' + r.lyDo).join('\n') : '(Không có đề nghị nào)';
  out += '\n\nPM vui lòng vào app duyệt.';
  copyText(out, 'danh sách tạm ứng chờ duyệt');
}

function copyTinTamUng(id) {
  const r = tuqlData.find(x => x.tamUngID === id);
  if (!r) return;
  let out;
  if (r.trangThai === 'Từ chối') {
    out = '❌ TẠM ỨNG CHƯA ĐƯỢC DUYỆT\n\nNhân viên: ' + r.hoTen + '\nSố tiền: ' + fmtMoney(r.soTien) + 'đ\n' +
      (r.ghiChu ? r.ghiChu + '\n' : '') + '\nBạn trao đổi thêm với PM nếu cần nhé.';
  } else {
    out = '✅ TẠM ỨNG ' + (r.trangThai === 'Đã chi' ? 'ĐÃ CHI' : 'ĐÃ ĐƯỢC DUYỆT') + '\n\nNhân viên: ' + r.hoTen +
      '\nSố tiền: ' + fmtMoney(r.soTien) + 'đ\nNgày đề nghị: ' + fmtDate(r.ngayDeNghi) +
      '\n\n' + (r.trangThai === 'Đã chi' ? 'Tiền đã được chi. Vui lòng kiểm tra lại.' : 'Liên hệ quản lý để nhận tiền nhé.');
  }
  copyText(out, 'tin tạm ứng');
}

async function openThuongPhat() {
  if (!options) await loadOptions();
  fillThangNam('tpThang', 'tpNam');
  fillSelect($('tpNhanVien'), options.nhanViens || [], n => n.userID, n => n.hoTen + ' (' + n.phongBan + ')');
  showScreen('scr-thuongphat', 'Thưởng / phạt');
  loadThuongPhat();
}

async function loadThuongPhat() {
  $('thuongPhatBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getBonusPenaltyList', {
    userID: user.userID,
    filters: { thang: Number($('tpThang').value), nam: Number($('tpNam').value) }
  });
  if (!res.success) { tpData = []; $('thuongPhatBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  tpData = res.data;

  let html = '';
  tpData.forEach(r => {
    const mauLoai = (r.loai === 'Thưởng' || r.loai === 'Phụ cấp') ? 'var(--xanh-la)' : 'var(--do)';
    html += '<div class="card">' +
      '<div class="line"><b>' + escapeHtml(r.hoTen) + '</b> (' + escapeHtml(r.phongBan) + ') · <b style="color:' + mauLoai + '">' + escapeHtml(r.loai) + ' ' + fmtMoney(r.soTien) + 'đ</b></div>' +
      '<div class="line">Lý do: ' + escapeHtml(r.lyDo) + '</div>' +
      '<div class="line muted">Tạo lúc ' + escapeHtml(r.thoiGianTao) + '</div>' +
      '<div class="btn-row">' +
        '<button class="btn small" onclick="suaTP(\'' + r.thuongPhatID + '\')">✏️ Sửa tiền</button>' +
        '<button class="btn red small" onclick="xoaTP(\'' + r.thuongPhatID + '\')">Xóa</button>' +
      '</div>' +
      '</div>';
  });
  $('thuongPhatBox').innerHTML = html || '<div class="alert blue">Chưa có khoản nào trong tháng.</div>';
}

async function themThuongPhat() {
  const res = await api('createBonusPenalty', {
    managerUserID: user.userID, targetUserID: $('tpNhanVien').value,
    thang: Number($('tpThang').value), nam: Number($('tpNam').value),
    loai: $('tpLoai').value, soTien: $('tpSoTien').value, lyDo: $('tpLyDo').value.trim()
  });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) { $('tpSoTien').value = ''; $('tpLyDo').value = ''; loadThuongPhat(); }
}

async function suaTP(id) {
  const r = tpData.find(x => x.thuongPhatID === id);
  const v = prompt('Số tiền mới cho khoản "' + r.loai + ' - ' + r.lyDo + '" (hiện tại: ' + fmtMoney(r.soTien) + 'đ):', r.soTien);
  if (v === null) return;
  const res = await api('updateBonusPenalty', { managerUserID: user.userID, thuongPhatID: id, soTien: v });
  res.success ? toast(res.message) : alert(res.message);
  loadThuongPhat();
}

async function xoaTP(id) {
  const lyDo = prompt('Lý do xóa khoản này (ghi vào lịch sử):');
  if (lyDo === null) return;
  const res = await api('deleteBonusPenalty', { managerUserID: user.userID, thuongPhatID: id, lyDo: lyDo.trim() });
  res.success ? toast(res.message) : alert(res.message);
  loadThuongPhat();
}

async function openLuong() {
  if (!options) await loadOptions();
  fillThangNam('blThang', 'blNam');
  fillSelect($('blPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  showScreen('scr-luong', 'Bảng lương sơ bộ');
  loadLuong();
}

async function loadLuong() {
  $('luongBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getPayrollDraft', {
    userID: user.userID, month: Number($('blThang').value), year: Number($('blNam').value),
    filters: { phongBan: $('blPhongBan').value }
  });
  if (!res.success) { $('luongBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  let html = '';
  res.data.bangLuong.forEach(r => {
    html += '<div class="card">' +
      '<h3>' + escapeHtml(r.hoTen) + ' <span class="muted">(' + escapeHtml(r.phongBan) + ' · ' + escapeHtml(r.hinhThucLuong) + ')</span></h3>' +
      '<div class="line">Giờ làm: <b>' + r.tongGioLam + 'h</b> · Tăng ca: ' + r.tongGioTangCa + 'h · Nghỉ CP ' + r.nghiCoPhep + ' / KP ' + r.nghiKhongPhep + '</div>' +
      '<div class="line">Lương gốc: CB ' + fmtMoney(r.luongCoBan) + 'đ · Giờ ' + fmtMoney(r.luongTheoGio) + 'đ/h · PC cố định ' + fmtMoney(r.phuCapCoDinh) + 'đ</div>' +
      '<div class="line">+ Thưởng ' + fmtMoney(r.thuong) + 'đ · + Phụ cấp ' + fmtMoney(r.phuCap) + 'đ</div>' +
      '<div class="line">- Phạt ' + fmtMoney(r.phat) + 'đ · - Khấu trừ ' + fmtMoney(r.khauTru) + 'đ · - Tạm ứng đã chi ' + fmtMoney(r.tamUngDaChi) + 'đ</div>' +
      '<div class="line" style="font-size:16px;margin-top:6px">💰 Tổng tạm tính: <b style="color:var(--xanh-dam)">' + fmtMoney(r.tongTamTinh) + 'đ</b></div>' +
      (r.canhBao ? '<div class="alert orange" style="margin-top:8px">⚠ ' + escapeHtml(r.canhBao) + '</div>' : '') +
      '</div>';
  });
  $('luongBox').innerHTML = html || '<div class="alert blue">Không có nhân viên "Đang làm" nào khớp bộ lọc.</div>';
}
