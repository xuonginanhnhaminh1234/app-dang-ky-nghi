async function openTamUngToi() {
  showScreen('scr-tamungtoi', 'Tạm ứng của tôi');
  loadTamUngToi();
}

async function guiTamUng() {
  const res = await api('submitAdvance', { userID: user.userID, soTien: $('tuSoTien').value, lyDo: $('tuLyDo').value.trim() });
  res.success ? toast(res.message) : alert(res.message);
  if (res.success) { $('tuSoTien').value = ''; $('tuLyDo').value = ''; loadTamUngToi(); }
}

async function loadTamUngToi() {
  $('tamUngToiBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getMyAdvances', { userID: user.userID });
  if (!res.success) { $('tamUngToiBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  let html = '';
  res.data.forEach(r => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + fmtMoney(r.soTien) + 'đ</b>' + badgeHtml(r.trangThai, false) + '</div>' +
      '<div class="line">Ngày đề nghị: ' + fmtDate(r.ngayDeNghi) + '</div>' +
      '<div class="line">Lý do: ' + escapeHtml(r.lyDo) + '</div>' +
      (r.ghiChu ? '<div class="line muted">' + escapeHtml(r.ghiChu) + '</div>' : '') +
      '</div>';
  });
  $('tamUngToiBox').innerHTML = html || '<div class="alert blue">Bạn chưa có đề nghị tạm ứng nào.</div>';
}
