function fillThangNam(idThang, idNam) {
  if ($(idThang).options.length) return; // chỉ đổ 1 lần
  const now = new Date();
  fillSelect($(idThang), [1,2,3,4,5,6,7,8,9,10,11,12], t => t, t => 'Tháng ' + t);
  $(idThang).value = String(now.getMonth() + 1);
  fillSelect($(idNam), [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1], n => n, n => 'Năm ' + n);
  $(idNam).value = String(now.getFullYear());
}

async function openCongToi() {
  fillThangNam('ctThang', 'ctNam');
  showScreen('scr-congtoi', 'Công của tôi');
  loadCongToi();
}

async function loadCongToi() {
  $('congToiBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getMyAttendance', { userID: user.userID, month: Number($('ctThang').value), year: Number($('ctNam').value) });
  if (!res.success) { $('congToiBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  const d = res.data, t = d.tongHop;

  let html = '<div class="card"><h3>📊 Tổng hợp tháng ' + d.month + '/' + d.year + '</h3>' +
    '<div class="line">Số ngày có công: <b>' + t.soNgayCong + '</b> · Tổng giờ làm: <b>' + t.tongGioLam + 'h</b></div>' +
    '<div class="line">Tăng ca: <b>' + t.tongGioTangCa + 'h</b> · Đi trễ: <b>' + t.soLanDiTre + '</b> lần · Về sớm: <b>' + t.soLanVeSom + '</b> lần</div>' +
    '<div class="line">Nghỉ có phép: <b>' + t.nghiCoPhep + '</b> ngày · Không phép: <b>' + t.nghiKhongPhep + '</b> · Ốm: <b>' + t.nghiOm + '</b> · Việc riêng: <b>' + t.nghiViecRieng + '</b></div>' +
    '</div>';

  if (!d.chamCong.length) {
    html += '<div class="alert blue">Chưa có ngày công nào trong tháng.</div>';
  }
  d.chamCong.forEach(c => {
    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><b>' + fmtDate(c.ngay) + '</b>' + badgeHtml(c.trangThai, false) + '</div>' +
      '<div class="line">Vào <b>' + (c.gioVao || '--') + '</b> · Ra <b>' + (c.gioRa || '--') + '</b> · <b>' + c.soGioLam + 'h</b>' +
      (c.diTre ? ' · <span style="color:var(--do)">trễ ' + c.soPhutTre + 'p</span>' : '') +
      (c.veSom ? ' · <span style="color:var(--cam)">sớm ' + c.soPhutVeSom + 'p</span>' : '') +
      (c.tangCa ? ' · OT ' + c.soGioTangCa + 'h' : '') + '</div>' +
      (c.ghiChuNhanVien ? '<div class="line muted">NV: ' + escapeHtml(c.ghiChuNhanVien) + '</div>' : '') +
      (c.ghiChuQuanLy ? '<div class="line muted">QL: ' + escapeHtml(c.ghiChuQuanLy) + '</div>' : '') +
      '</div>';
  });

  if (d.nghi.length) {
    html += '<div class="section-title">📅 Ngày nghỉ đã duyệt trong tháng</div><div class="card">';
    d.nghi.forEach(lv => {
      html += '<div class="line">' + fmtDate(lv.ngayNghi) + ' - ' + escapeHtml(tenCaNgan(lv.caNghi)) + ' - ' + escapeHtml(lv.loaiNghi) + '</div>';
    });
    html += '</div>';
  }
  $('congToiBox').innerHTML = html;
}
