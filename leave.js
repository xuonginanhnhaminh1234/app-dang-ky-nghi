function fillSelect(sel, items, valueFn, labelFn, extraFirst) {
  sel.innerHTML = '';
  if (extraFirst) {
    const o = document.createElement('option');
    o.value = extraFirst.value; o.textContent = extraFirst.label;
    sel.appendChild(o);
  }
  items.forEach(it => {
    const o = document.createElement('option');
    o.value = valueFn(it); o.textContent = labelFn(it);
    sel.appendChild(o);
  });
}

function fillLoaiNghiSelects(loaiSel, tinhCongSel) {
  fillSelect(loaiSel, options.loaiNghi, l => l.ten, l => l.ten);
  fillSelect(tinhCongSel, options.tinhCong, t => t, t => t);
  const goiY = () => {
    const l = options.loaiNghi.find(x => x.ten === loaiSel.value);
    if (l) tinhCongSel.value = l.tinhCongGoiY;
  };
  loaiSel.onchange = goiY;
  goiY();
}

async function openDangKy() {
  if (!options) await loadOptions();
  if (!options) return;
  fillSelect($('dkCa'), options.caLam, c => c.maCa, c => c.tenCa + ' (' + c.gioBatDau + ' - ' + c.gioKetThuc + ')');
  fillLoaiNghiSelects($('dkLoai'), $('dkTinhCong'));
  const minNgay = addDays(options.homNay || todayStr(), options.soNgayBaoTruoc);
  $('dkNgay').min = minNgay;
  if (!$('dkNgay').value || $('dkNgay').value < minNgay) $('dkNgay').value = minNgay;
  $('dkHanBaoTruoc').textContent = 'Phải đăng ký trước ít nhất ' + options.soNgayBaoTruoc + ' ngày.';
  $('dkHetSlotBox').classList.add('hidden');
  $('dkKetQua').innerHTML = '';
  showScreen('scr-dangky', 'Đăng ký nghỉ');
}

async function submitDangKy(forceSpecial) {
  const data = {
    userID: user.userID,
    ngayNghi: $('dkNgay').value,
    caNghi: $('dkCa').value,
    loaiNghi: $('dkLoai').value,
    lyDo: $('dkLyDo').value.trim(),
    tinhCong: $('dkTinhCong').value,
    forceSpecialRequest: forceSpecial === true
  };
  if (!data.ngayNghi) { toast('Vui lòng chọn ngày nghỉ.'); return; }
  if (!data.lyDo) { toast('Vui lòng nhập lý do nghỉ.'); return; }

  const res = await api('submitLeave', data);

  if (res.success) {
    $('dkHetSlotBox').classList.add('hidden');
    let html = '<div class="alert green">' + escapeHtml(res.message) + '</div>';
    if (res.warning) html += '<div class="alert orange">⚠ ' + escapeHtml(res.warning) + '</div>';
    $('dkKetQua').innerHTML = html;
    $('dkLyDo').value = '';
    toast(res.message);
    return;
  }

  // Hết slot -> hiện nút gửi yêu cầu đặc biệt
  if (res.data && res.data.hetSlot) {
    $('dkKetQua').innerHTML = '';
    $('dkHetSlotMsg').textContent = res.message + (res.data.canSpecialRequest
      ? ' Bạn có thể gửi yêu cầu đặc biệt để quản lý xem xét.'
      : ' Hiện không cho phép gửi yêu cầu đặc biệt.');
    $('dkHetSlotBox').classList.remove('hidden');
    $('dkHetSlotBox').querySelector('.btn').classList.toggle('hidden', !res.data.canSpecialRequest);
    return;
  }

  $('dkHetSlotBox').classList.add('hidden');
  $('dkKetQua').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>';
}

async function openMyLeaves() {
  showScreen('scr-mylist', 'Lịch nghỉ của tôi');
  $('myListBox').innerHTML = '<div class="muted" style="margin-top:16px">Đang tải...</div>';
  const res = await api('getMyLeaves', { userID: user.userID });
  if (!res.success) { $('myListBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  const list = res.data;
  if (!list.length) { $('myListBox').innerHTML = '<div class="alert blue">Bạn chưa có đơn nghỉ nào.</div>'; return; }

  let html = '';
  list.forEach(lv => {
    const huyDuoc = (lv.trangThai === 'Chờ duyệt' || lv.trangThai === 'Yêu cầu đặc biệt');
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b>' + fmtDate(lv.ngayNghi) + '</b>' + badgeHtml(lv.trangThai, lv.vuotSlot) +
      '</div>' +
      '<div class="line">Ca: <b>' + escapeHtml(tenCa(lv.caNghi)) + '</b></div>' +
      '<div class="line">Loại: <b>' + escapeHtml(lv.loaiNghi) + '</b> · Tính công: <b>' + escapeHtml(lv.tinhCong) + '</b></div>' +
      '<div class="line">Lý do: ' + escapeHtml(lv.lyDo) + '</div>' +
      '<div class="line muted">Đăng ký lúc: ' + escapeHtml(lv.thoiGianDangKy) + '</div>' +
      (lv.nguoiDuyet ? '<div class="line muted">Người duyệt: ' + escapeHtml(lv.nguoiDuyet) + ' lúc ' + escapeHtml(lv.thoiGianDuyet) + '</div>' : '') +
      (lv.lyDoTuChoi ? '<div class="alert red" style="margin-top:8px">Lý do từ chối: ' + escapeHtml(lv.lyDoTuChoi) + '</div>' : '') +
      (lv.taoThayNhanVien ? '<div class="line muted">Đơn do quản lý tạo thay.</div>' : '') +
      (huyDuoc ? '<button class="btn red small" onclick="huyDonCuaToi(\'' + lv.leaveID + '\')">Hủy đơn này</button>' : '') +
      '</div>';
  });
  $('myListBox').innerHTML = html;
}

async function huyDonCuaToi(leaveID) {
  if (!confirm('Bạn chắc chắn muốn hủy đơn nghỉ này?')) return;
  const res = await api('cancelMyLeave', { userID: user.userID, leaveID: leaveID });
  toast(res.message);
  if (res.success) openMyLeaves();
}
