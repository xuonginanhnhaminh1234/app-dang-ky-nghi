async function openDashboard() {
  showScreen('scr-dashboard', 'Dashboard quản lý');
  $('dashBox').innerHTML = '<div class="muted" style="margin-top:16px">Đang tải...</div>';
  const res = await api('getLeaveDashboard', { userID: user.userID });
  if (!res.success) { $('dashBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  const d = res.data;
  dashData = d; // giữ lại cho các nút copy Zalo
  const tk = d.thongKe;

  let html =
    '<div class="stat-grid">' +
      '<div class="stat"><div class="num">' + tk.tongHomNay + '</div><div class="lbl">Nghỉ hôm nay</div></div>' +
      '<div class="stat"><div class="num">' + tk.tongNgayMai + '</div><div class="lbl">Nghỉ ngày mai</div></div>' +
      '<div class="stat' + (tk.choDuyet > 0 ? ' warn' : '') + '"><div class="num">' + tk.choDuyet + '</div><div class="lbl">Chờ duyệt</div></div>' +
      '<div class="stat"><div class="num">' + tk.daDuyet + '</div><div class="lbl">Đã duyệt (sắp tới)</div></div>' +
      '<div class="stat"><div class="num">' + tk.tuChoi + '</div><div class="lbl">Từ chối (sắp tới)</div></div>' +
      '<div class="stat' + (tk.yeuCauDacBiet > 0 ? ' warn' : '') + '"><div class="num">' + tk.yeuCauDacBiet + '</div><div class="lbl">Yêu cầu đặc biệt</div></div>' +
    '</div>';

  // Copy lịch gửi Zalo
  html += '<div class="btn-row">' +
    '<button class="btn small" onclick="copyDashSchedule(\'homNay\')">📋 Copy hôm nay</button>' +
    '<button class="btn small" onclick="copyDashSchedule(\'ngayMai\')">📋 Copy ngày mai</button>' +
    '<button class="btn small" onclick="copyDashSchedule(\'tuanNay\')">📋 Copy tuần này</button>' +
    '</div>';

  // Cảnh báo
  if (d.canhBao.length) {
    html += '<div class="section-title">⚠ Cảnh báo</div>';
    d.canhBao.forEach(c => { html += '<div class="alert red">' + escapeHtml(c) + '</div>'; });
  }

  // Nhóm theo phòng ban
  function nhomTheoPB(danhSach) {
    let h = '';
    d.phongBans.forEach(pb => {
      h += '<div class="pb-name">' + escapeHtml(pb) + ':</div>';
      const items = danhSach.filter(x => x.phongBan === pb);
      if (!items.length) { h += '<div class="pb-empty">Không có ai nghỉ</div>'; return; }
      items.forEach(lv => {
        h += '<div class="pb-item">' + escapeHtml(lv.hoTen) + ' - ' + escapeHtml(tenCa(lv.caNghi)) +
          ' - ' + badgeHtml(lv.trangThai, lv.vuotSlot) +
          (danhSach === d.tuanNay.danhSach ? ' <span class="muted">(' + fmtDate(lv.ngayNghi) + ')</span>' : '') +
          '</div>';
      });
    });
    return h;
  }

  html += '<div class="section-title">📅 Hôm nay ai nghỉ? (' + fmtDate(d.homNay.ngay) + ')</div><div class="card pb-group">' + nhomTheoPB(d.homNay.danhSach) + '</div>';
  html += '<div class="section-title">📅 Ngày mai ai nghỉ? (' + fmtDate(d.ngayMai.ngay) + ')</div><div class="card pb-group">' + nhomTheoPB(d.ngayMai.danhSach) + '</div>';
  html += '<div class="section-title">📅 Tuần này ai nghỉ? (' + fmtDate(d.tuanNay.tuNgay) + ' - ' + fmtDate(d.tuanNay.denNgay) + ')</div><div class="card pb-group">' + nhomTheoPB(d.tuanNay.danhSach) + '</div>';

  // Bảng slot
  if (d.slotInfo.length) {
    html += '<div class="section-title">🎚️ Slot hôm nay & ngày mai</div>' +
      '<table class="slot-table"><tr><th>Ngày</th><th>Phòng ban</th><th>Ca</th><th>Đã dùng / Tối đa</th><th>Còn</th></tr>';
    d.slotInfo.forEach(s => {
      html += '<tr><td>' + fmtDate(s.ngay) + '</td><td>' + escapeHtml(s.phongBan) + '</td><td>' + s.ca + '</td>' +
        '<td class="' + (s.vuot ? 'vuot' : '') + '">' + s.daDung + '/' + s.gioiHan + (s.vuot ? ' ⚠' : '') + '</td>' +
        '<td>' + s.conLai + '</td></tr>';
    });
    html += '</table>';
  }

  $('dashBox').innerHTML = html;
  setupMonthFilters(d.phongBans);
}

function copyDashSchedule(loai) {
  if (!dashData) return;
  const d = dashData;
  let out = '', label = '';

  // Ghép 1 nhóm đơn theo phòng ban vào out
  function themNhom(danhSach) {
    if (!danhSach.length) { out += '(Không có ai nghỉ)\n'; return; }
    const m = groupByPB(danhSach);
    Object.keys(m).sort().forEach(pb => {
      out += pb + ':\n';
      m[pb].forEach(lv => {
        out += '- ' + lv.hoTen + ' - ' + tenCaNgan(lv.caNghi) + ' - ' + lv.trangThai +
          (lv.vuotSlot ? ' (vượt slot)' : '') + '\n';
      });
    });
  }

  if (loai === 'homNay') {
    label = 'lịch nghỉ hôm nay';
    out = '📆 LỊCH NGHỈ HÔM NAY (' + fmtDate(d.homNay.ngay) + ')\n\n';
    themNhom(d.homNay.danhSach);
  } else if (loai === 'ngayMai') {
    label = 'lịch nghỉ ngày mai';
    out = '📆 LỊCH NGHỈ NGÀY MAI (' + fmtDate(d.ngayMai.ngay) + ')\n\n';
    themNhom(d.ngayMai.danhSach);
  } else {
    label = 'lịch nghỉ tuần này';
    out = '📆 LỊCH NGHỈ TUẦN NÀY (' + fmtDate(d.tuanNay.tuNgay) + ' - ' + fmtDate(d.tuanNay.denNgay) + ')\n\n';
    if (!d.tuanNay.danhSach.length) {
      out += '(Không có ai nghỉ)\n';
    } else {
      // Tuần: nhóm theo ngày rồi theo phòng ban
      const theoNgay = {};
      d.tuanNay.danhSach.forEach(lv => { (theoNgay[lv.ngayNghi] = theoNgay[lv.ngayNghi] || []).push(lv); });
      Object.keys(theoNgay).sort().forEach(ngay => {
        out += fmtDate(ngay) + '\n';
        themNhom(theoNgay[ngay]);
        out += '\n';
      });
    }
  }

  out = out.replace(/\s+$/, '') + '\n\nPM lưu ý theo dõi và sắp xếp nhân sự.';
  copyText(out, label);
}

function setupMonthFilters(phongBans) {
  if (monthFilterReady) return;
  monthFilterReady = true;
  const now = new Date();
  const thangs = [1,2,3,4,5,6,7,8,9,10,11,12];
  fillSelect($('thThang'), thangs, t => t, t => 'Tháng ' + t);
  $('thThang').value = String(now.getMonth() + 1);
  const nams = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  fillSelect($('thNam'), nams, n => n, n => 'Năm ' + n);
  $('thNam').value = String(now.getFullYear());
  fillSelect($('thPhongBan'), phongBans || [], p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  fillSelect($('thTrangThai'),
    ['Chờ duyệt', 'Đã duyệt', 'Yêu cầu đặc biệt', 'Từ chối', 'Đã hủy'],
    t => t, t => t, { value: '', label: 'Tất cả trạng thái' });
}

async function loadMonthDashboard() {
  $('monthBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getMonthlyLeaveDashboard', {
    userID: user.userID,
    month: Number($('thThang').value),
    year: Number($('thNam').value),
    filters: { phongBan: $('thPhongBan').value, trangThai: $('thTrangThai').value }
  });
  if (!res.success) {
    monthData = null;
    $('monthBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>';
    return;
  }
  monthData = res.data;
  renderMonthDashboard();
}

function renderMonthDashboard() {
  const d = monthData;
  const tk = d.thongKeTrangThai;
  const tenThang = String(d.month).padStart(2, '0') + '/' + d.year;

  // Thống kê tháng
  let html =
    '<div class="section-title">📊 Thống kê tháng ' + tenThang + '</div>' +
    '<div class="stat-grid">' +
      '<div class="stat"><div class="num">' + tk.tongLuotNghi + '</div><div class="lbl">Tổng lượt nghỉ</div></div>' +
      '<div class="stat' + (tk.choDuyet > 0 ? ' warn' : '') + '"><div class="num">' + tk.choDuyet + '</div><div class="lbl">Chờ duyệt</div></div>' +
      '<div class="stat"><div class="num">' + tk.daDuyet + '</div><div class="lbl">Đã duyệt</div></div>' +
      '<div class="stat' + (tk.yeuCauDacBiet > 0 ? ' warn' : '') + '"><div class="num">' + tk.yeuCauDacBiet + '</div><div class="lbl">Yêu cầu đặc biệt</div></div>' +
      '<div class="stat"><div class="num">' + tk.tuChoi + '</div><div class="lbl">Từ chối</div></div>' +
      '<div class="stat"><div class="num">' + tk.daHuy + '</div><div class="lbl">Đã hủy</div></div>' +
    '</div>';

  // Nút copy Zalo
  html += '<div class="btn-row">' +
    '<button class="btn small" onclick="copyMonthSchedule()">📋 Copy lịch nghỉ tháng</button>' +
    '<button class="btn small orange" onclick="copyMonthStats()">📋 Copy thống kê tháng</button>' +
    '</div>';

  // Cảnh báo tháng
  if (d.canhBao.length) {
    html += '<div class="section-title">⚠ Cảnh báo trong tháng</div>';
    d.canhBao.forEach(c => { html += '<div class="alert red">⚠ ' + escapeHtml(c) + '</div>'; });
  }

  // Danh sách theo ngày (chỉ ngày có đơn)
  html += '<div class="section-title">📆 Lịch nghỉ tháng ' + tenThang + '</div>';
  if (!d.danhSachTheoNgay.length) {
    html += '<div class="alert blue">Không có đơn nghỉ nào khớp bộ lọc trong tháng này.</div>';
  }
  d.danhSachTheoNgay.forEach(ng => {
    html += '<div class="card pb-group"><b>' + fmtDate(ng.ngay) + '</b>';
    const m = groupByPB(ng.danhSach);
    Object.keys(m).sort().forEach(pb => {
      html += '<div class="pb-name">' + escapeHtml(pb) + ':</div>';
      m[pb].forEach(lv => {
        html += '<div class="pb-item">' + escapeHtml(lv.hoTen) + ' - ' + escapeHtml(tenCaNgan(lv.caNghi)) +
          ' - ' + badgeHtml(lv.trangThai, lv.vuotSlot) + '</div>';
      });
    });
    html += '</div>';
  });

  // Thống kê theo phòng ban
  const pbs = Object.keys(d.thongKePhongBan).sort();
  if (pbs.length) {
    html += '<div class="section-title">🏢 Theo phòng ban (lượt nghỉ)</div><div class="card">';
    pbs.forEach(pb => {
      html += '<div class="line">' + escapeHtml(pb) + ': <b>' + d.thongKePhongBan[pb] + ' lượt</b></div>';
    });
    html += '</div>';
  }

  // Top nhân viên nghỉ nhiều
  if (d.thongKeNhanVien.length) {
    html += '<div class="section-title">👤 Top nhân viên nghỉ nhiều</div>' +
      '<table class="slot-table"><tr><th>#</th><th>Nhân viên</th><th>Phòng ban</th><th>Lượt</th><th>Số ngày</th></tr>';
    d.thongKeNhanVien.slice(0, 10).forEach((nv, i) => {
      html += '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(nv.hoTen) + '</td><td>' + escapeHtml(nv.phongBan) +
        '</td><td>' + nv.soLuot + '</td><td>' + nv.soNgayQuyDoi + '</td></tr>';
    });
    html += '</table><p class="muted" style="margin-top:6px">Quy đổi: ca sáng/chiều = 0.5 ngày, cả ngày = 1 ngày. Chỉ tính đơn Chờ duyệt / Đã duyệt / Yêu cầu đặc biệt.</p>';
  }

  $('monthBox').innerHTML = html;
}

function copyMonthSchedule() {
  if (!monthData) return;
  const d = monthData;
  const tenThang = String(d.month).padStart(2, '0') + '/' + d.year;
  let out = '📆 LỊCH NGHỈ THÁNG ' + tenThang + '\n\n';

  if (!d.danhSachTheoNgay.length) {
    out += '(Không có ai nghỉ trong tháng này)\n\n';
  }
  d.danhSachTheoNgay.forEach(ng => {
    out += fmtDate(ng.ngay) + '\n';
    const m = groupByPB(ng.danhSach);
    Object.keys(m).sort().forEach(pb => {
      out += pb + ':\n';
      m[pb].forEach(lv => {
        out += '- ' + lv.hoTen + ' - ' + tenCaNgan(lv.caNghi) + ' - ' + lv.trangThai +
          (lv.vuotSlot ? ' (vượt slot)' : '') + '\n';
      });
    });
    out += '\n';
  });

  out += 'TỔNG HỢP:\n';
  Object.keys(d.thongKePhongBan).sort().forEach(pb => {
    out += pb + ': ' + d.thongKePhongBan[pb] + ' lượt\n';
  });
  out += '\nPM lưu ý theo dõi và sắp xếp nhân sự theo lịch trên.';

  copyText(out, 'lịch nghỉ tháng');
}

function copyMonthStats() {
  if (!monthData) return;
  const d = monthData;
  const tk = d.thongKeTrangThai;
  const tenThang = String(d.month).padStart(2, '0') + '/' + d.year;

  let out = '📊 THỐNG KÊ NGHỈ THÁNG ' + tenThang + '\n' +
    'Tổng lượt nghỉ: ' + tk.tongLuotNghi + '\n' +
    'Chờ duyệt: ' + tk.choDuyet + '\n' +
    'Đã duyệt: ' + tk.daDuyet + '\n' +
    'Yêu cầu đặc biệt: ' + tk.yeuCauDacBiet + '\n' +
    'Từ chối: ' + tk.tuChoi + '\n' +
    'Đã hủy: ' + tk.daHuy + '\n';

  const pbs = Object.keys(d.thongKePhongBan).sort();
  if (pbs.length) {
    out += '\nTHEO PHÒNG BAN:\n';
    pbs.forEach(pb => { out += pb + ': ' + d.thongKePhongBan[pb] + ' lượt\n'; });
  }

  if (d.thongKeNhanVien.length) {
    out += '\nTOP NHÂN VIÊN NGHỈ NHIỀU:\n';
    d.thongKeNhanVien.slice(0, 10).forEach((nv, i) => {
      out += (i + 1) + '. ' + nv.hoTen + ' (' + nv.phongBan + '): ' + nv.soLuot + ' lượt - ' + nv.soNgayQuyDoi + ' ngày\n';
    });
  }

  if (d.canhBao.length) {
    out += '\nCẢNH BÁO:\n';
    d.canhBao.forEach(c => { out += '⚠ ' + c + '\n'; });
  }

  copyText(out.trim(), 'thống kê nghỉ tháng');
}

async function openDuyet() {
  if (!options) await loadOptions();
  showScreen('scr-duyet', 'Duyệt nghỉ');

  // Chuẩn bị bộ lọc (chỉ set lần đầu)
  if (!$('flTuNgay').value) {
    $('flTuNgay').value = todayStr();
    $('flDenNgay').value = addDays(todayStr(), 30);
  }
  fillSelect($('flPhongBan'), options.phongBans, p => p, p => p, { value: '', label: 'Tất cả phòng ban' });
  fillSelect($('flTrangThai'),
    ['Chờ duyệt', 'Yêu cầu đặc biệt', 'Đã duyệt', 'Từ chối', 'Đã hủy'],
    t => t, t => t, { value: '', label: 'Tất cả trạng thái' });
  fillSelect($('flNhanVien'), options.nhanViens || [], n => n.userID, n => n.hoTen + ' (' + n.phongBan + ')', { value: '', label: 'Tất cả nhân viên' });

  loadDuyet();
}

async function loadDuyet() {
  $('duyetBox').innerHTML = '<div class="muted" style="margin-top:16px">Đang tải...</div>';
  const res = await api('getAllLeaves', {
    userID: user.userID,
    filters: {
      tuNgay: $('flTuNgay').value,
      denNgay: $('flDenNgay').value,
      phongBan: $('flPhongBan').value,
      trangThai: $('flTrangThai').value,
      targetUserID: $('flNhanVien').value
    }
  });
  if (!res.success) { $('duyetBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }

  const list = res.data;
  if (!list.length) { $('duyetBox').innerHTML = '<div class="alert blue">Không có đơn nào khớp bộ lọc.</div>'; return; }

  // Giữ lại dữ liệu đơn để nút Copy Zalo tra theo leaveID
  duyetList = {};
  list.forEach(lv => { duyetList[lv.leaveID] = lv; });

  let html = '';
  list.forEach(lv => {
    const choXuLy = (lv.trangThai === 'Chờ duyệt' || lv.trangThai === 'Yêu cầu đặc biệt');
    const daDuyet = (lv.trangThai === 'Đã duyệt');
    const nhanCopy = {
      'Chờ duyệt': '📋 Copy tin đăng ký',
      'Yêu cầu đặc biệt': '📋 Copy tin đăng ký',
      'Đã duyệt': '📋 Copy tin đã duyệt',
      'Từ chối': '📋 Copy tin từ chối',
      'Đã hủy': '📋 Copy tin hủy'
    }[lv.trangThai] || '📋 Copy Zalo';

    let tinhCongSelect = '<select id="tc-' + lv.leaveID + '">';
    options.tinhCong.forEach(t => {
      tinhCongSelect += '<option value="' + t + '"' + (t === lv.tinhCong ? ' selected' : '') + '>' + t + '</option>';
    });
    tinhCongSelect += '</select>';

    html += '<div class="card">' +
      '<div style="display:flex;justify-content:space-between;align-items:center">' +
        '<b>' + escapeHtml(lv.hoTen) + '</b>' + badgeHtml(lv.trangThai, lv.vuotSlot) +
      '</div>' +
      '<div class="line">' + escapeHtml(lv.phongBan) + ' · <b>' + fmtDate(lv.ngayNghi) + '</b> · ' + escapeHtml(tenCa(lv.caNghi)) + '</div>' +
      '<div class="line">Loại: <b>' + escapeHtml(lv.loaiNghi) + '</b> · Lý do: ' + escapeHtml(lv.lyDo) + '</div>' +
      '<div class="line muted">Đăng ký: ' + escapeHtml(lv.thoiGianDangKy) + (lv.taoThayNhanVien ? ' · do QL tạo thay' : '') + '</div>' +
      (lv.lyDoTuChoi ? '<div class="line" style="color:var(--do)">Từ chối: ' + escapeHtml(lv.lyDoTuChoi) + '</div>' : '') +
      (choXuLy
        ? '<label>Tính công</label>' + tinhCongSelect +
          '<div class="btn-row">' +
            '<button class="btn green small" onclick="duyetDon(\'' + lv.leaveID + '\', false)">Duyệt</button>' +
            '<button class="btn purple small" onclick="duyetVuotSlot(\'' + lv.leaveID + '\')">Duyệt vượt slot</button>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button class="btn red small" onclick="tuChoiDon(\'' + lv.leaveID + '\')">Từ chối</button>' +
            '<button class="btn gray small" onclick="huyDonQL(\'' + lv.leaveID + '\')">Hủy</button>' +
          '</div>'
        : (daDuyet ? '<button class="btn gray small" onclick="huyDonQL(\'' + lv.leaveID + '\')">Hủy đơn đã duyệt</button>' : '')) +
      '<button class="btn small" style="background:#455a64" onclick="copyLeaveMsg(\'' + lv.leaveID + '\')">' + nhanCopy + '</button>' +
      '</div>';
  });
  $('duyetBox').innerHTML = html;
}

function copyLeaveMsg(leaveID) {
  const lv = duyetList[leaveID];
  if (!lv) { toast('Không tìm thấy dữ liệu đơn, bấm Lọc / Tải lại rồi thử lại.'); return; }
  const ngay = fmtDate(lv.ngayNghi);
  const ca = tenCaNgan(lv.caNghi);
  let out = '';

  if (lv.trangThai === 'Chờ duyệt' || lv.trangThai === 'Yêu cầu đặc biệt') {
    out = '📌 CÓ ĐƠN ĐĂNG KÝ NGHỈ MỚI\n\n' +
      (lv.trangThai === 'Yêu cầu đặc biệt' ? 'Loại đơn: YÊU CẦU ĐẶC BIỆT (hết slot)\n' : '') +
      'Nhân viên: ' + lv.hoTen + '\n' +
      'Phòng ban: ' + lv.phongBan + '\n' +
      'Ngày nghỉ: ' + ngay + '\n' +
      'Ca nghỉ: ' + ca + '\n' +
      'Loại nghỉ: ' + lv.loaiNghi + '\n' +
      'Lý do: ' + lv.lyDo + '\n\n' +
      'PM vui lòng kiểm tra và duyệt trên app.';
    copyText(out, 'tin đăng ký');
  } else if (lv.trangThai === 'Đã duyệt') {
    out = '✅ ĐƠN NGHỈ ĐÃ ĐƯỢC DUYỆT\n\n' +
      'Nhân viên: ' + lv.hoTen + '\n' +
      'Ngày nghỉ: ' + ngay + '\n' +
      'Ca nghỉ: ' + ca + '\n' +
      'Loại nghỉ: ' + lv.loaiNghi + '\n' +
      'Tính công: ' + lv.tinhCong + '\n' +
      (lv.vuotSlot ? 'Lưu ý: đơn được duyệt VƯỢT SLOT.\n' : '') +
      '\nBạn lưu ý sắp xếp công việc/bàn giao trước khi nghỉ nhé.';
    copyText(out, 'tin đã duyệt');
  } else if (lv.trangThai === 'Từ chối') {
    out = '❌ ĐƠN NGHỈ CHƯA ĐƯỢC DUYỆT\n\n' +
      'Nhân viên: ' + lv.hoTen + '\n' +
      'Ngày nghỉ: ' + ngay + '\n' +
      'Ca nghỉ: ' + ca + '\n' +
      'Lý do từ chối: ' + lv.lyDoTuChoi + '\n\n' +
      'Bạn trao đổi thêm với PM nếu cần nhé.';
    copyText(out, 'tin từ chối');
  } else if (lv.trangThai === 'Đã hủy') {
    out = '⚠️ ĐƠN NGHỈ ĐÃ ĐƯỢC HỦY\n\n' +
      'Nhân viên: ' + lv.hoTen + '\n' +
      'Ngày nghỉ: ' + ngay + '\n' +
      'Ca nghỉ: ' + ca + '\n' +
      'Trạng thái: Đã hủy\n\n' +
      'PM và nhân viên lưu ý cập nhật lại lịch làm việc.';
    copyText(out, 'tin hủy');
  }
}

function layTinhCong(leaveID) {
  const sel = $('tc-' + leaveID);
  return sel ? sel.value : '';
}

async function duyetDon(leaveID, xacNhanCanhBao) {
  const res = await api('approveLeave', {
    managerUserID: user.userID,
    leaveID: leaveID,
    tinhCong: layTinhCong(leaveID),
    xacNhanCanhBao: xacNhanCanhBao === true
  });

  if (res.success) {
    toast(res.message);
    if (res.warning) alert('⚠ ' + res.warning);
    loadDuyet();
    return;
  }
  // Cần xác nhận cảnh báo nhân sự tối thiểu
  if (res.data && res.data.needConfirm) {
    if (confirm('⚠ ' + res.warning + '\n\nVẫn muốn duyệt?')) duyetDon(leaveID, true);
    return;
  }
  // Slot đầy -> gợi ý duyệt vượt slot
  if (res.data && res.data.needOverSlot) {
    if (confirm(res.message + '\n\nDuyệt VƯỢT SLOT luôn?')) duyetVuotSlot(leaveID);
    return;
  }
  alert(res.message);
}

async function duyetVuotSlot(leaveID) {
  if (!confirm('Duyệt VƯỢT SLOT sẽ vượt giới hạn người nghỉ của ca. Tiếp tục?')) return;
  const res = await api('approveOverSlot', {
    managerUserID: user.userID,
    leaveID: leaveID,
    tinhCong: layTinhCong(leaveID)
  });
  toast(res.message);
  if (res.success && res.warning) alert('⚠ ' + res.warning);
  if (!res.success) alert(res.message);
  loadDuyet();
}

async function tuChoiDon(leaveID) {
  const lyDo = prompt('Nhập lý do từ chối (bắt buộc):');
  if (lyDo === null) return;
  if (!lyDo.trim()) { alert('Phải nhập lý do từ chối.'); return; }
  const res = await api('rejectLeave', { managerUserID: user.userID, leaveID: leaveID, lyDoTuChoi: lyDo.trim() });
  toast(res.message);
  if (!res.success) alert(res.message);
  loadDuyet();
}

async function huyDonQL(leaveID) {
  if (!confirm('Hủy đơn này? Slot sẽ được trả lại.')) return;
  const res = await api('cancelLeaveByManager', { managerUserID: user.userID, leaveID: leaveID });
  toast(res.message);
  if (!res.success) alert(res.message);
  loadDuyet();
}

async function openTaoThay() {
  if (!options) await loadOptions();
  fillSelect($('ttNhanVien'), options.nhanViens || [], n => n.userID, n => n.hoTen + ' (' + n.phongBan + ')');
  fillSelect($('ttCa'), options.caLam, c => c.maCa, c => c.tenCa + ' (' + c.gioBatDau + ' - ' + c.gioKetThuc + ')');
  fillLoaiNghiSelects($('ttLoai'), $('ttTinhCong'));
  if (!$('ttNgay').value) $('ttNgay').value = todayStr();
  $('ttKetQua').innerHTML = '';
  showScreen('scr-taothay', 'Tạo đơn thay NV');
}

async function submitTaoThay() {
  const data = {
    managerUserID: user.userID,
    targetUserID: $('ttNhanVien').value,
    ngayNghi: $('ttNgay').value,
    caNghi: $('ttCa').value,
    loaiNghi: $('ttLoai').value,
    lyDo: $('ttLyDo').value.trim(),
    tinhCong: $('ttTinhCong').value,
    ghiChu: $('ttGhiChu').value.trim(),
    trangThaiBanDau: $('ttTrangThai').value,
    allowOverSlot: $('ttVuotSlot').checked
  };
  if (!data.targetUserID) { toast('Vui lòng chọn nhân viên.'); return; }
  if (!data.ngayNghi) { toast('Vui lòng chọn ngày nghỉ.'); return; }
  if (!data.lyDo) { toast('Vui lòng nhập lý do.'); return; }

  const res = await api('createLeaveForEmployee', data);
  if (res.success) {
    let html = '<div class="alert green">' + escapeHtml(res.message) + '</div>';
    if (res.warning) html += '<div class="alert orange">⚠ ' + escapeHtml(res.warning) + '</div>';
    $('ttKetQua').innerHTML = html;
    $('ttLyDo').value = '';
    toast(res.message);
  } else {
    $('ttKetQua').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>';
  }
}
