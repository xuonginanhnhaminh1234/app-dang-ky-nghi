async function openSlot() {
  if (!options) await loadOptions();
  fillSelect($('slPhongBan'), options.phongBans, p => p, p => p);
  if (!$('slNgay').value) $('slNgay').value = todayStr();
  showScreen('scr-slot', 'Quản lý slot');
  loadSlotLists();
}

async function saveSlotConfig() {
  const data = {
    userID: user.userID,
    ngay: $('slNgay').value,
    phongBan: $('slPhongBan').value,
    caNghi: $('slCa').value,
    soLuongToiDa: $('slSoLuong').value,
    ghiChu: $('slGhiChu').value.trim()
  };
  if (!data.ngay) { toast('Chọn ngày.'); return; }
  if (data.soLuongToiDa === '') { toast('Nhập số lượng tối đa.'); return; }
  const res = await api('updateSlotConfig', data);
  toast(res.message);
  if (res.success) loadSlotLists();
}

async function loadSlotLists() {
  // 1. Slot riêng theo ngày
  const resSlot = await api('getSlotConfig', { userID: user.userID, filters: { tuNgay: todayStr() } });
  let html = '<div class="card"><h3>Slot riêng đã cấu hình (từ hôm nay)</h3>';
  if (resSlot.success && resSlot.data.length) {
    resSlot.data.forEach(r => {
      html += '<div class="line">📌 <b>' + fmtDate(r.ngay) + '</b> · ' + escapeHtml(r.phongBan) + ' · ' + r.caNghi +
        ' · tối đa <b>' + r.soLuongToiDa + '</b>' + (r.ghiChu ? ' · ' + escapeHtml(r.ghiChu) : '') + '</div>';
    });
  } else {
    html += '<div class="muted">Chưa có slot riêng nào.</div>';
  }
  html += '</div>';
  $('slotListBox').innerHTML = html;

  // 2. Slot mặc định
  const resDef = await api('getDefaultSlotConfig', { userID: user.userID });
  let h2 = '<div class="card"><h3>Slot mặc định</h3>';
  if (resDef.success) {
    resDef.data.forEach(r => {
      h2 += '<div class="line" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>' + escapeHtml(r.phongBan) + ' · ' + r.caNghi + ' · tối đa <b>' + r.soLuongToiDa + '</b></span>' +
        (user.duocSuaCauHinh ? '<button class="btn small" style="width:auto;margin:0;padding:6px 14px" onclick="suaSlotMacDinh(\'' + r.phongBan + '\',\'' + r.caNghi + '\',' + r.soLuongToiDa + ')">Sửa</button>' : '') +
        '</div>';
    });
  }
  h2 += '</div>';
  $('slotDefaultBox').innerHTML = h2;

  // 3. Nhân sự tối thiểu
  const resMin = await api('getMinimumStaffConfig', { userID: user.userID });
  let h3 = '<div class="card"><h3>Nhân sự tối thiểu (người đi làm)</h3>';
  if (resMin.success) {
    resMin.data.forEach(r => {
      h3 += '<div class="line" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span>' + escapeHtml(r.phongBan) + ' · ' + r.caNghi + ' · tối thiểu <b>' + r.soNguoiToiThieu + '</b></span>' +
        (user.duocSuaCauHinh ? '<button class="btn small" style="width:auto;margin:0;padding:6px 14px" onclick="suaMinStaff(\'' + r.phongBan + '\',\'' + r.caNghi + '\',' + r.soNguoiToiThieu + ')">Sửa</button>' : '') +
        '</div>';
    });
  }
  h3 += '</div>';
  $('minStaffBox').innerHTML = h3;

  // 4. Cấu hình chung
  const resCfg = await api('getGeneralConfig', { userID: user.userID });
  let h4 = '<div class="card"><h3>Cấu hình chung</h3>';
  if (resCfg.success) {
    resCfg.data.forEach(r => {
      h4 += '<div class="line" style="display:flex;justify-content:space-between;align-items:center">' +
        '<span><b>' + escapeHtml(r.key) + '</b> = ' + escapeHtml(r.value) + '</span>' +
        (user.duocSuaCauHinh ? '<button class="btn small" style="width:auto;margin:0;padding:6px 14px" onclick="suaCauHinhChung(\'' + r.key + '\',\'' + escapeHtml(r.value) + '\')">Sửa</button>' : '') +
        '</div>' +
        (r.ghiChu ? '<div class="muted">' + escapeHtml(r.ghiChu) + '</div>' : '');
    });
  }
  h4 += '</div>';
  $('generalCfgBox').innerHTML = h4;
}

async function suaSlotMacDinh(phongBan, caNghi, hienTai) {
  const v = prompt('Slot mặc định ' + phongBan + ' ca ' + caNghi + ' (hiện tại: ' + hienTai + '):', hienTai);
  if (v === null) return;
  const res = await api('updateDefaultSlotConfig', { userID: user.userID, phongBan, caNghi, soLuongToiDa: v });
  toast(res.message);
  if (res.success) loadSlotLists();
}

async function suaMinStaff(phongBan, caNghi, hienTai) {
  const v = prompt('Nhân sự tối thiểu ' + phongBan + ' ca ' + caNghi + ' (hiện tại: ' + hienTai + '):', hienTai);
  if (v === null) return;
  const res = await api('updateMinimumStaffConfig', { userID: user.userID, phongBan, caNghi, soNguoiToiThieu: v });
  toast(res.message);
  if (res.success) loadSlotLists();
}

async function suaCauHinhChung(key, hienTai) {
  const v = prompt('Giá trị mới cho ' + key + ' (hiện tại: ' + hienTai + '):', hienTai);
  if (v === null) return;
  const res = await api('updateGeneralConfig', { userID: user.userID, key, value: v.trim() });
  toast(res.message);
  if (res.success) { loadSlotLists(); options = null; } // reset cache options để lấy SoNgayBaoTruoc mới
}

async function openKhoa() {
  if (!options) await loadOptions();
  fillSelect($('khPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Toàn xưởng' });
  if (!$('khNgay').value) $('khNgay').value = todayStr();
  showScreen('scr-khoa', 'Khóa ngày');
  loadKhoaList();
}

async function doLockDate() {
  const data = {
    userID: user.userID,
    ngay: $('khNgay').value,
    phongBan: $('khPhongBan').value,
    caNghi: $('khCa').value,
    lyDoKhoa: $('khLyDo').value.trim()
  };
  if (!data.ngay) { toast('Chọn ngày khóa.'); return; }
  const phamVi = (data.phongBan || 'Toàn xưởng') + ' - ' + (data.caNghi ? 'ca ' + data.caNghi : 'cả ngày');
  if (!confirm('Khóa ' + phamVi + ' ngày ' + fmtDate(data.ngay) + '?')) return;
  const res = await api('lockDate', data);
  toast(res.message);
  if (res.success) { $('khLyDo').value = ''; loadKhoaList(); }
}

async function loadKhoaList() {
  const res = await api('getLockedDates', { userID: user.userID });
  let html = '<div class="card"><h3>Ngày đang khóa</h3>';
  if (res.success && res.data.length) {
    res.data.forEach(r => {
      html += '<div class="line" style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
        '<span>🔒 <b>' + fmtDate(r.ngay) + '</b> · ' + (r.phongBan ? escapeHtml(r.phongBan) : 'Toàn xưởng') +
        ' · ' + (r.caNghi ? 'ca ' + r.caNghi : 'cả ngày') +
        (r.lyDoKhoa ? '<br><span class="muted">' + escapeHtml(r.lyDoKhoa) + '</span>' : '') + '</span>' +
        '<button class="btn small green" style="width:auto;margin:0;padding:6px 12px" ' +
          'onclick="doUnlock(\'' + r.ngay + '\',\'' + escapeHtml(r.phongBan) + '\',\'' + r.caNghi + '\')">Mở khóa</button>' +
        '</div>';
    });
  } else {
    html += '<div class="muted">Không có ngày nào đang khóa.</div>';
  }
  html += '</div>';
  $('khoaListBox').innerHTML = html;
}

async function doUnlock(ngay, phongBan, caNghi) {
  if (!confirm('Mở khóa ' + (phongBan || 'toàn xưởng') + ' ' + (caNghi ? 'ca ' + caNghi : 'cả ngày') + ' ngày ' + fmtDate(ngay) + '?')) return;
  const res = await api('unlockDate', { userID: user.userID, ngay, phongBan, caNghi });
  toast(res.message);
  loadKhoaList();
}

async function openCauHinhNS() {
  if (!options) await loadOptions();
  fillSelect($('capbPhongBan'), options.phongBans, p => p, p => p);
  showScreen('scr-cauhinhns', 'Cấu hình nhân sự');
  loadViTriCC();
  loadCaPhongBan();
  loadCauHinhNS();
}

async function loadViTriCC() {
  $('vtHienTai').innerHTML = '<div class="muted">Đang tải...</div>';
  const res = await api('getAttendanceLocationConfig', { userID: user.userID });
  if (!res.success) {
    vtData = null;
    $('vtHienTai').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>';
    return;
  }
  vtData = res.data.length ? res.data[0] : null;

  if (!vtData) {
    $('vtHienTai').innerHTML = '<div class="alert orange">Chưa có địa điểm nào. Chạy setupSheets() để tạo dòng mẫu, hoặc điền form rồi bấm Lưu để tạo mới.</div>';
    return;
  }

  const daCoToaDo = vtData.viDo && vtData.kinhDo;
  $('vtHienTai').innerHTML = daCoToaDo
    ? '<div class="alert green">✅ <b>' + escapeHtml(vtData.tenDiaDiem) + '</b>: (' + escapeHtml(vtData.viDo) + ', ' + escapeHtml(vtData.kinhDo) + ')' +
      ' · bán kính <b>' + escapeHtml(vtData.banKinhMet || '400') + 'm</b>' +
      ' · ' + (vtData.batBuocGPS ? 'bắt buộc GPS' : 'KHÔNG bắt buộc GPS') +
      (vtData.choPhepChamCongNgoaiViTri ? ' · cho phép chấm ngoài vị trí' : '') +
      (vtData.thoiGianCapNhat ? '<br><span class="muted">Cập nhật: ' + escapeHtml(vtData.thoiGianCapNhat) + '</span>' : '') +
      '</div>'
    : '<div class="alert orange">⚠ Chưa có tọa độ xưởng — nhân viên sẽ KHÔNG chấm công được khi đang bắt buộc GPS. Đứng tại xưởng và bấm nút bên dưới.</div>';

  // Đổ dữ liệu hiện tại lên form
  $('vtTen').value = vtData.tenDiaDiem;
  $('vtViDo').value = vtData.viDo;
  $('vtKinhDo').value = vtData.kinhDo;
  $('vtBanKinh').value = vtData.banKinhMet || 400;
  $('vtBatBuoc').checked = vtData.batBuocGPS;
  $('vtNgoai').checked = vtData.choPhepChamCongNgoaiViTri;
}

async function layViTriLamXuong() {
  toast('Đang lấy vị trí của bạn...');
  const vt = await layViTri_();
  if (vt.err) { alert(vt.err); return; }
  if (!confirm('Dùng vị trí hiện tại làm vị trí xưởng?\n\nTọa độ: ' + vt.lat.toFixed(6) + ', ' + vt.lng.toFixed(6) + '\nSai số GPS: ±' + vt.acc + 'm\n\nNên đứng giữa xưởng khi bấm nút này.')) return;
  const res = await api('setCurrentLocationAsWorkshop', {
    userID: user.userID,
    latitude: vt.lat, longitude: vt.lng, accuracy: vt.acc,
    diaDiemID: vtData ? vtData.diaDiemID : 'DD001'
  });
  res.success ? toast(res.message) : alert(res.message);
  loadViTriCC();
}

async function saveViTriCC() {
  const res = await api('updateAttendanceLocationConfig', {
    userID: user.userID,
    diaDiemID: vtData ? vtData.diaDiemID : 'DD001',
    tenDiaDiem: $('vtTen').value.trim() || 'Xưởng chính',
    viDo: $('vtViDo').value.trim(),
    kinhDo: $('vtKinhDo').value.trim(),
    banKinhMet: $('vtBanKinh').value || 400,
    batBuocGPS: $('vtBatBuoc').checked,
    choPhepChamCongNgoaiViTri: $('vtNgoai').checked,
    trangThai: 'Active'
  });
  res.success ? toast(res.message) : alert(res.message);
  loadViTriCC();
}

async function loadCaPhongBan() {
  $('caPhongBanBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải ca phòng ban...</div>';
  const res = await api('getDepartmentShiftConfig', { userID: user.userID });
  if (!res.success) { caPBData = []; $('caPhongBanBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  caPBData = res.data;

  let html = '<div class="card"><h3>Ca đang cấu hình</h3>';
  if (!caPBData.length) {
    html += '<div class="alert orange">Chưa có dòng nào trong CAU_HINH_CA_PHONG_BAN — app đang dùng giờ chung toàn xưởng. Chạy setupSheets() để tạo dữ liệu mẫu, hoặc thêm bằng form trên.</div>';
  }
  caPBData.forEach((r, i) => {
    const tat = r.trangThai !== 'Active';
    html += '<div class="line" style="display:flex;justify-content:space-between;align-items:center;gap:8px' + (tat ? ';opacity:.5' : '') + '">' +
      '<span><b>' + escapeHtml(r.phongBan) + '</b> · ' + escapeHtml(r.caLam) + ': <b>' + escapeHtml(r.gioBatDau) + ' - ' + escapeHtml(r.gioKetThuc) + '</b>' +
      (r.gioNghiTruaBatDau ? '<br><span class="muted">Nghỉ trưa ' + escapeHtml(r.gioNghiTruaBatDau) + '-' + escapeHtml(r.gioNghiTruaKetThuc) + '</span>' : '') +
      '<span class="muted"> · trễ ' + escapeHtml(r.phutChoPhepTre || '0') + 'p / sớm ' + escapeHtml(r.phutChoPhepVeSom || '0') + 'p</span>' +
      (tat ? ' <span class="badge da-huy">Tắt</span>' : '') + '</span>' +
      '<span style="display:flex;gap:6px;flex-shrink:0">' +
        '<button class="btn small" style="width:auto;margin:0;padding:6px 12px" onclick="suaCaPB(' + i + ')">Sửa</button>' +
        '<button class="btn small ' + (tat ? 'green' : 'gray') + '" style="width:auto;margin:0;padding:6px 12px" onclick="batTatCaPB(' + i + ')">' + (tat ? 'Bật' : 'Tắt') + '</button>' +
      '</span>' +
      '</div>';
  });
  html += '</div>';
  $('caPhongBanBox').innerHTML = html;
}

function suaCaPB(i) {
  const r = caPBData[i];
  if (!r) return;
  $('capbPhongBan').value = r.phongBan;
  $('capbCa').value = r.caLam;
  $('capbBD').value = r.gioBatDau;
  $('capbKT').value = r.gioKetThuc;
  $('capbTruaBD').value = r.gioNghiTruaBatDau;
  $('capbTruaKT').value = r.gioNghiTruaKetThuc;
  $('capbTre').value = r.phutChoPhepTre;
  $('capbSom').value = r.phutChoPhepVeSom;
  $('capbOT').value = r.tinhTangCaSau;
  toast('Đã đổ dữ liệu ' + r.phongBan + ' ca ' + r.caLam + ' lên form. Sửa xong bấm Lưu.');
  window.scrollTo(0, 0);
}

async function saveCaPhongBan() {
  if (!$('capbBD').value || !$('capbKT').value) { toast('Nhập đủ giờ bắt đầu và kết thúc.'); return; }
  const res = await api('updateDepartmentShiftConfig', {
    userID: user.userID,
    phongBan: $('capbPhongBan').value,
    caLam: $('capbCa').value,
    gioBatDau: $('capbBD').value,
    gioKetThuc: $('capbKT').value,
    gioNghiTruaBatDau: $('capbTruaBD').value,
    gioNghiTruaKetThuc: $('capbTruaKT').value,
    phutChoPhepTre: $('capbTre').value,
    phutChoPhepVeSom: $('capbSom').value,
    tinhTangCaSau: $('capbOT').value,
    trangThai: 'Active'
  });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) loadCaPhongBan();
}

async function batTatCaPB(i) {
  const r = caPBData[i];
  if (!r) return;
  const moi = r.trangThai === 'Active' ? 'Inactive' : 'Active';
  if (!confirm((moi === 'Inactive' ? 'TẮT' : 'BẬT') + ' ca ' + r.caLam + ' của ' + r.phongBan + '?\n(Tắt = phòng ban này quay về dùng giờ chung toàn xưởng cho ca đó)')) return;
  const res = await api('updateDepartmentShiftConfig', {
    userID: user.userID,
    phongBan: r.phongBan, caLam: r.caLam,
    gioBatDau: r.gioBatDau, gioKetThuc: r.gioKetThuc,
    gioNghiTruaBatDau: r.gioNghiTruaBatDau, gioNghiTruaKetThuc: r.gioNghiTruaKetThuc,
    phutChoPhepTre: r.phutChoPhepTre, phutChoPhepVeSom: r.phutChoPhepVeSom,
    tinhTangCaSau: r.tinhTangCaSau, ghiChu: r.ghiChu,
    trangThai: moi
  });
  res.success ? toast(res.message) : alert(res.message);
  loadCaPhongBan();
}

async function loadCauHinhNS() {
  $('cauHinhNSBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getAttendanceConfig', { userID: user.userID });
  if (!res.success) { $('cauHinhNSBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  let html = '<div class="card"><h3>⚙️ Cấu hình chấm công</h3>' +
    '<p class="muted">Giờ ca, phút cho phép trễ/sớm, giờ tính tăng ca, làm tròn công, bật/tắt chấm công.</p>';
  res.data.forEach(r => {
    html += '<div class="line" style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +
      '<span><b>' + escapeHtml(r.key) + '</b> = ' + escapeHtml(r.value) +
      (r.ghiChu ? '<br><span class="muted">' + escapeHtml(r.ghiChu) + '</span>' : '') + '</span>' +
      (user.duocQuanLyNhanSu
        ? '<button class="btn small" style="width:auto;margin:0;padding:6px 14px" onclick="suaCauHinhNS(\'' + r.key + '\',\'' + escapeHtml(r.value) + '\')">Sửa</button>'
        : '') +
      '</div>';
  });
  html += '</div>';
  $('cauHinhNSBox').innerHTML = html;
}

async function suaCauHinhNS(key, hienTai) {
  const v = prompt('Giá trị mới cho ' + key + ' (hiện tại: ' + hienTai + '):', hienTai);
  if (v === null) return;
  const res = await api('updateAttendanceConfig', { userID: user.userID, key: key, value: v.trim() });
  res.success ? toast(res.message) : alert(res.message);
  loadCauHinhNS();
}
