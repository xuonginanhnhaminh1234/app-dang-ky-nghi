async function openBCNgay() {
  if (!options) await loadOptions();
  fillSelect($('bcnPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  fillSelect($('tcNhanVien'), options.nhanViens || [], n => n.userID, n => n.hoTen + ' (' + n.phongBan + ')');
  if (!$('bcnNgay').value) $('bcnNgay').value = todayStr();
  showScreen('scr-bcngay', 'Bảng công ngày');
  loadBCNgay();
}

async function loadBCNgay() {
  $('bcNgayBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getAttendanceByDay', {
    userID: user.userID, ngay: $('bcnNgay').value,
    filters: { phongBan: $('bcnPhongBan').value }
  });
  if (!res.success) { bcnData = null; $('bcNgayBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  bcnData = res.data;

  let html = '<button class="btn small purple" onclick="copyBCNgay()">📋 Copy bảng công ngày</button>';

  if (bcnData.chuaCham.length) {
    html += '<div class="card"><h3>⏳ Chưa có công (' + bcnData.chuaCham.length + ')</h3>';
    bcnData.chuaCham.forEach(x => {
      html += '<div class="line">' + escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ') <span class="muted">- dùng form "Thêm công tay" ở trên</span></div>';
    });
    html += '</div>';
  }

  if (!bcnData.chamCong.length) html += '<div class="alert blue">Chưa có dòng chấm công nào trong ngày.</div>';

  bcnData.chamCong.forEach(c => {
    const id = c.chamCongID;
    let ttSelect = '<select id="bct-' + id + '">';
    ['Chưa hoàn tất', 'Hoàn tất', 'Quên chấm vào', 'Quên chấm ra', 'Quản lý chỉnh', 'Nghỉ'].forEach(t => {
      ttSelect += '<option' + (t === c.trangThai ? ' selected' : '') + '>' + t + '</option>';
    });
    ttSelect += '</select>';
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + escapeHtml(c.hoTen) + '</b>' + badgeHtml(c.trangThai, false) + '</div>' +
      '<div class="line">' + escapeHtml(c.phongBan) + ' · ' + c.soGioLam + 'h' +
      (c.diTre ? ' · <span style="color:var(--do)">trễ ' + c.soPhutTre + 'p</span>' : '') +
      (c.veSom ? ' · <span style="color:var(--cam)">sớm ' + c.soPhutVeSom + 'p</span>' : '') +
      (c.tangCa ? ' · OT ' + c.soGioTangCa + 'h' : '') + '</div>' +
      (c.ghiChuNhanVien ? '<div class="line muted">NV: ' + escapeHtml(c.ghiChuNhanVien) + '</div>' : '') +
      '<div class="filter-grid">' +
        '<div><label>Giờ vào</label><input type="time" id="bcv-' + id + '" value="' + escapeHtml(c.gioVao) + '"></div>' +
        '<div><label>Giờ ra</label><input type="time" id="bcr-' + id + '" value="' + escapeHtml(c.gioRa) + '"></div>' +
      '</div>' +
      '<label>Trạng thái</label>' + ttSelect +
      '<label>Ghi chú quản lý</label><input type="text" id="bcg-' + id + '" value="' + escapeHtml(c.ghiChuQuanLy) + '">' +
      '<button class="btn small green" onclick="suaCong(\'' + id + '\')">💾 Lưu chỉnh sửa</button>' +
      '</div>';
  });
  $('bcNgayBox').innerHTML = html;
}

async function suaCong(id) {
  const lyDo = prompt('Lý do chỉnh sửa công (bắt buộc, sẽ ghi vào lịch sử):');
  if (lyDo === null) return;
  if (!lyDo.trim()) { alert('Phải nhập lý do chỉnh sửa.'); return; }
  const res = await api('updateAttendanceByManager', {
    managerUserID: user.userID, chamCongID: id,
    gioVao: $('bcv-' + id).value, gioRa: $('bcr-' + id).value,
    trangThai: $('bct-' + id).value, ghiChuQuanLy: $('bcg-' + id).value.trim(),
    lyDo: lyDo.trim()
  });
  res.success ? toast(res.message) : alert(res.message);
  loadBCNgay();
}

async function createCongTay() {
  const lyDo = $('tcLyDo').value.trim();
  if (!$('tcNhanVien').value) { toast('Chọn nhân viên.'); return; }
  if (!lyDo) { toast('Nhập lý do thêm công.'); return; }
  const res = await api('createAttendanceByManager', {
    managerUserID: user.userID, targetUserID: $('tcNhanVien').value,
    ngay: $('bcnNgay').value, gioVao: $('tcGioVao').value, gioRa: $('tcGioRa').value,
    trangThai: $('tcTrangThai').value, lyDo: lyDo
  });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) { $('tcLyDo').value = ''; loadBCNgay(); }
}

function copyBCNgay() {
  if (!bcnData) return;
  let out = '🗓 BẢNG CÔNG NGÀY ' + fmtDate(bcnData.ngay) + '\n\n';
  if (!bcnData.chamCong.length) out += '(Chưa có dòng chấm công)\n';
  bcnData.chamCong.forEach(c => {
    out += '- ' + c.hoTen + ' (' + c.phongBan + '): vào ' + (c.gioVao || '--') + ', ra ' + (c.gioRa || '--') + ', ' + c.soGioLam + 'h' +
      (c.diTre ? ', trễ ' + c.soPhutTre + 'p' : '') + (c.veSom ? ', sớm ' + c.soPhutVeSom + 'p' : '') +
      (c.tangCa ? ', OT ' + c.soGioTangCa + 'h' : '') + ' [' + c.trangThai + ']\n';
  });
  if (bcnData.chuaCham.length) {
    out += '\nCHƯA CÓ CÔNG:\n' + bcnData.chuaCham.map(x => '- ' + x.hoTen + ' (' + x.phongBan + ')').join('\n');
  }
  copyText(out, 'bảng công ngày');
}

async function openBCThang() {
  if (!options) await loadOptions();
  fillThangNam('bctThang', 'bctNam');
  fillSelect($('bctPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  showScreen('scr-bcthang', 'Bảng công tháng');
  loadBCThang();
}

async function loadBCThang() {
  $('bcThangBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getMonthlyAttendanceReport', {
    userID: user.userID, month: Number($('bctThang').value), year: Number($('bctNam').value),
    filters: { phongBan: $('bctPhongBan').value }
  });
  if (!res.success) { bctData = null; $('bcThangBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  bctData = res.data;

  let html = '<button class="btn small purple" onclick="copyBCThang()">📋 Copy bảng công tháng</button>';
  if (!bctData.baoCao.length) html += '<div class="alert blue">Không có nhân viên nào khớp bộ lọc.</div>';
  bctData.baoCao.forEach(r => {
    html += '<div class="card">' +
      '<h3>' + escapeHtml(r.hoTen) + ' <span class="muted">(' + escapeHtml(r.phongBan) + ')</span></h3>' +
      '<div class="line">Ngày có công: <b>' + r.soNgayCong + '</b> · Giờ làm: <b>' + r.tongGioLam + 'h</b> · Tăng ca: <b>' + r.tongGioTangCa + 'h</b></div>' +
      '<div class="line">Đi trễ: ' + r.soLanDiTre + ' lần · Về sớm: ' + r.soLanVeSom + ' lần</div>' +
      '<div class="line">Nghỉ: có phép ' + r.nghiCoPhep + ' · không phép ' + r.nghiKhongPhep + ' · ốm ' + r.nghiOm + ' · việc riêng ' + r.nghiViecRieng + '</div>' +
      '<div class="line">Tổng nghỉ quy đổi: <b>' + r.tongNgayNghiQuyDoi + '</b> ngày · Công quy đổi (giờ/8): <b>' + r.soNgayCongQuyDoi + '</b></div>' +
      '</div>';
  });
  $('bcThangBox').innerHTML = html;
}

function copyBCThang() {
  if (!bctData) return;
  let out = '🧾 BẢNG CÔNG THÁNG ' + String(bctData.month).padStart(2, '0') + '/' + bctData.year + '\n\n';
  bctData.baoCao.forEach(r => {
    out += r.hoTen + ' (' + r.phongBan + '): ' + r.soNgayCong + ' ngày công, ' + r.tongGioLam + 'h, OT ' + r.tongGioTangCa + 'h, trễ ' + r.soLanDiTre + ', sớm ' + r.soLanVeSom +
      ', nghỉ CP ' + r.nghiCoPhep + ' / KP ' + r.nghiKhongPhep + ' / ốm ' + r.nghiOm + ' / VR ' + r.nghiViecRieng + '\n';
  });
  copyText(out.trim(), 'bảng công tháng');
}

async function openTangCa() {
  if (!options) await loadOptions();
  fillSelect($('otNhanVien'), options.nhanViens || [], n => n.userID, n => n.hoTen + ' (' + n.phongBan + ')');
  if (!$('otTuNgay').value) {
    $('otTuNgay').value = addDays(todayStr(), -7);
    $('otDenNgay').value = addDays(todayStr(), 7);
  }
  if (!$('otNgay').value) $('otNgay').value = todayStr();
  showScreen('scr-tangca', 'Tăng ca');
  loadTangCa();
}

async function loadTangCa() {
  $('tangCaBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getOvertimeList', {
    userID: user.userID,
    filters: { tuNgay: $('otTuNgay').value, denNgay: $('otDenNgay').value }
  });
  if (!res.success) { otData = []; $('tangCaBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  otData = res.data;

  let html = '';
  otData.forEach(r => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + escapeHtml(r.hoTen) + '</b>' + badgeHtml(r.trangThai, false) + '</div>' +
      '<div class="line">' + escapeHtml(r.phongBan) + ' · ' + fmtDate(r.ngay) + ' · ' + escapeHtml(r.gioBatDau) + '-' + escapeHtml(r.gioKetThuc) + ' (<b>' + r.soGioTangCa + 'h</b>)</div>' +
      '<div class="line">Lý do: ' + escapeHtml(r.lyDo) + '</div>' +
      (r.trangThai === 'Chờ duyệt'
        ? '<div class="btn-row">' +
          '<button class="btn green small" onclick="duyetOT(\'' + r.tangCaID + '\')">Duyệt</button>' +
          '<button class="btn red small" onclick="tuChoiOT(\'' + r.tangCaID + '\')">Từ chối</button>' +
          '</div>'
        : '') +
      '</div>';
  });
  $('tangCaBox').innerHTML = html || '<div class="alert blue">Không có tăng ca nào trong khoảng ngày.</div>';
}

async function taoTangCa() {
  const res = await api('createOvertime', {
    managerUserID: user.userID, targetUserID: $('otNhanVien').value,
    ngay: $('otNgay').value, gioBatDau: $('otGioBD').value, gioKetThuc: $('otGioKT').value,
    lyDo: $('otLyDo').value.trim(), duyetLuon: $('otDuyetLuon').checked
  });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) { $('otLyDo').value = ''; loadTangCa(); }
}

async function duyetOT(id) {
  const res = await api('approveOvertime', { managerUserID: user.userID, tangCaID: id });
  res.success ? toast(res.message) : alert(res.message);
  loadTangCa();
}

async function tuChoiOT(id) {
  const lyDo = prompt('Lý do từ chối tăng ca (bắt buộc):');
  if (lyDo === null) return;
  if (!lyDo.trim()) { alert('Phải nhập lý do.'); return; }
  const res = await api('rejectOvertime', { managerUserID: user.userID, tangCaID: id, lyDo: lyDo.trim() });
  res.success ? toast(res.message) : alert(res.message);
  loadTangCa();
}

function copyTangCa() {
  let out = '🌙 DANH SÁCH TĂNG CA (' + fmtDate($('otTuNgay').value) + ' - ' + fmtDate($('otDenNgay').value) + ')\n\n';
  out += otData.length
    ? otData.map(r => '- ' + r.hoTen + ' (' + r.phongBan + '): ' + fmtDate(r.ngay) + ' ' + r.gioBatDau + '-' + r.gioKetThuc + ' (' + r.soGioTangCa + 'h) [' + r.trangThai + ']').join('\n')
    : '(Không có tăng ca)';
  copyText(out, 'danh sách tăng ca');
}
