async function openNhanVien() {
  if (!options) await loadOptions();
  fillSelect($('nvLocPB'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  fillSelect($('nvPhongBan'), options.phongBans, p => p, p => p);
  showScreen('scr-nhanvien', 'Quản lý nhân viên');
  loadNhanVien();
}

async function loadNhanVien() {
  $('nhanVienBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getEmployees', {
    userID: user.userID,
    filters: { phongBan: $('nvLocPB').value, trangThai: $('nvLocTT').value }
  });
  if (!res.success) { $('nhanVienBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  nvMapData = {};
  let html = '';
  res.data.forEach(nv => {
    nvMapData[nv.userID] = nv;
    const dangLam = nv.trangThaiLamViec === 'Đang làm';
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + escapeHtml(nv.hoTen) + '</b>' + badgeHtml(nv.trangThaiLamViec, false) + '</div>' +
      '<div class="line">' + escapeHtml(nv.phongBan) + (nv.chucVu ? ' · ' + escapeHtml(nv.chucVu) : '') + (nv.soDienThoai ? ' · 📞 ' + escapeHtml(nv.soDienThoai) : '') + '</div>' +
      '<div class="line">Lương: ' + escapeHtml(nv.hinhThucLuong) +
      (nv.luongCoBan ? ' · CB ' + fmtMoney(nv.luongCoBan) + 'đ' : '') +
      (nv.luongTheoGio ? ' · ' + fmtMoney(nv.luongTheoGio) + 'đ/h' : '') +
      (nv.phuCapCoDinh ? ' · PC ' + fmtMoney(nv.phuCapCoDinh) + 'đ' : '') + '</div>' +
      (nv.ngayVaoLam ? '<div class="line muted">Vào làm: ' + fmtDate(nv.ngayVaoLam) + (nv.ngayNghiViec ? ' · Nghỉ việc: ' + fmtDate(nv.ngayNghiViec) : '') + '</div>' : '') +
      '<div class="btn-row">' +
        '<button class="btn small" onclick="suaNV(\'' + nv.userID + '\')">✏️ Sửa</button>' +
        (dangLam ? '<button class="btn red small" onclick="khoaNV(\'' + nv.userID + '\')">🔒 Nghỉ việc</button>' : '') +
      '</div>' +
      '</div>';
  });
  $('nhanVienBox').innerHTML = html || '<div class="alert blue">Chưa có nhân viên nào khớp bộ lọc.</div>';
}

function suaNV(userID) {
  const nv = nvMapData[userID];
  if (!nv) return;
  nvEditID = userID;
  $('nvFormTitle').textContent = '✏️ Sửa: ' + nv.hoTen + ' (' + userID + ')';
  $('nvPinNote').textContent = '(để trống nếu không đổi PIN)';
  $('nvHoTen').value = nv.hoTen;
  $('nvMaPIN').value = '';
  $('nvSDT').value = nv.soDienThoai;
  $('nvPhongBan').value = nv.phongBan;
  $('nvChucVu').value = nv.chucVu;
  $('nvNgayVao').value = nv.ngayVaoLam || '';
  $('nvHinhThuc').value = nv.hinhThucLuong || 'Theo tháng';
  $('nvLuongCB').value = nv.luongCoBan || '';
  $('nvLuongGio').value = nv.luongTheoGio || '';
  $('nvPhuCap').value = nv.phuCapCoDinh || '';
  $('nvSTK').value = nv.soTaiKhoan;
  $('nvNganHang').value = nv.tenNganHang;
  $('nvGhiChu').value = nv.ghiChu;
  $('nvBtnHuySua').classList.remove('hidden');
  window.scrollTo(0, 0);
}

function resetNVForm() {
  nvEditID = null;
  $('nvFormTitle').textContent = '➕ Thêm nhân viên mới';
  $('nvPinNote').textContent = '(bắt buộc khi thêm mới)';
  ['nvHoTen', 'nvMaPIN', 'nvSDT', 'nvChucVu', 'nvNgayVao', 'nvLuongCB', 'nvLuongGio', 'nvPhuCap', 'nvSTK', 'nvNganHang', 'nvGhiChu'].forEach(id => { $(id).value = ''; });
  $('nvBtnHuySua').classList.add('hidden');
}

async function saveNhanVien() {
  const data = {
    managerUserID: user.userID,
    hoTen: $('nvHoTen').value.trim(),
    soDienThoai: $('nvSDT').value.trim(),
    phongBan: $('nvPhongBan').value,
    chucVu: $('nvChucVu').value.trim(),
    ngayVaoLam: $('nvNgayVao').value,
    hinhThucLuong: $('nvHinhThuc').value,
    luongCoBan: $('nvLuongCB').value,
    luongTheoGio: $('nvLuongGio').value,
    phuCapCoDinh: $('nvPhuCap').value,
    soTaiKhoan: $('nvSTK').value.trim(),
    tenNganHang: $('nvNganHang').value.trim(),
    ghiChu: $('nvGhiChu').value.trim()
  };
  const pin = $('nvMaPIN').value.trim();
  if (!data.hoTen) { toast('Nhập họ tên.'); return; }

  let res;
  if (nvEditID) {
    data.targetUserID = nvEditID;
    if (pin) data.maPIN = pin;
    res = await api('updateEmployee', data);
  } else {
    if (!pin) { toast('Nhập mã PIN cho nhân viên mới.'); return; }
    data.maPIN = pin;
    res = await api('createEmployee', data);
  }
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) {
    resetNVForm();
    options = null; // danh sách nhân viên đổi -> nạp lại options
    await loadOptions();
    loadNhanVien();
  }
}

async function khoaNV(userID) {
  const nv = nvMapData[userID];
  if (!confirm('Khóa nhân viên ' + nv.hoTen + ' nghỉ việc?\n- Không đăng nhập được nữa\n- Giữ nguyên toàn bộ lịch sử')) return;
  const res = await api('deactivateEmployee', { managerUserID: user.userID, targetUserID: userID });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) { options = null; await loadOptions(); loadNhanVien(); }
}
