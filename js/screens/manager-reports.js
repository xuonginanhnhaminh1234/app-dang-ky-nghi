async function openHRDash() {
  if (!$('hrNgay').value) $('hrNgay').value = todayStr();
  showScreen('scr-hrdash', 'Dashboard nhân sự');
  loadHRDash();
}

async function loadHRDash() {
  $('hrDashBox').innerHTML = '<div class="muted" style="margin-top:12px">Đang tải...</div>';
  const res = await api('getHRDashboard', { userID: user.userID, ngay: $('hrNgay').value });
  if (!res.success) { hrData = null; $('hrDashBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  hrData = res.data;
  const d = hrData, t = d.tongQuan;

  let html = '<div class="stat-grid">' +
    '<div class="stat"><div class="num">' + t.tongActive + '</div><div class="lbl">Nhân viên active</div></div>' +
    '<div class="stat"><div class="num">' + t.daChamVao + '</div><div class="lbl">Đã chấm vào</div></div>' +
    '<div class="stat' + (t.chuaChamVao > 0 ? ' warn' : '') + '"><div class="num">' + t.chuaChamVao + '</div><div class="lbl">Chưa chấm vào</div></div>' +
    '<div class="stat"><div class="num">' + t.daChamRa + '</div><div class="lbl">Đã chấm ra</div></div>' +
    '<div class="stat' + (t.diTre > 0 ? ' warn' : '') + '"><div class="num">' + t.diTre + '</div><div class="lbl">Đi trễ</div></div>' +
    '<div class="stat"><div class="num">' + t.veSom + '</div><div class="lbl">Về sớm</div></div>' +
    '<div class="stat"><div class="num">' + t.nghi + '</div><div class="lbl">Nghỉ (đã duyệt)</div></div>' +
    '<div class="stat"><div class="num">' + t.tangCa + '</div><div class="lbl">Tăng ca</div></div>' +
    '</div>';

  html += '<div class="btn-row">' +
    '<button class="btn small" onclick="copyHRReport()">📋 Copy báo cáo</button>' +
    '<button class="btn small orange" onclick="copyHRDS(\'chuaChamVao\')">📋 Chưa chấm vào</button>' +
    '</div><div class="btn-row">' +
    '<button class="btn small purple" onclick="copyHRDS(\'nghi\')">📋 DS nghỉ</button>' +
    '<button class="btn small red" onclick="copyHRDS(\'diTre\')">📋 DS đi trễ</button>' +
    '</div>';

  if (d.canhBao.length) {
    d.canhBao.forEach(c => { html += '<div class="alert red">⚠ ' + escapeHtml(c) + '</div>'; });
  }

  html += '<div class="section-title">🏢 Theo phòng ban</div><div class="card">';
  Object.keys(d.theoPhongBan).sort().forEach(pb => {
    const p = d.theoPhongBan[pb];
    html += '<div class="line"><b>' + escapeHtml(pb) + '</b>: ' + p.tongActive + ' NV · có mặt <b>' + p.coMat + '</b> · nghỉ ' + p.nghi + ' · chưa chấm ' + p.chuaCham + ' · trễ ' + p.diTre + '</div>';
  });
  html += '</div>';

  function dsCard(tieuDe, ds, dongFn) {
    let h = '<div class="section-title">' + tieuDe + ' (' + ds.length + ')</div><div class="card">';
    if (!ds.length) h += '<div class="muted">Không có ai.</div>';
    ds.forEach(x => { h += '<div class="line">' + dongFn(x) + '</div>'; });
    return h + '</div>';
  }
  html += dsCard('⏳ Chưa chấm vào', d.dsChuaChamVao, x => escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ')');
  html += dsCard('🚪 Đã vào, chưa chấm ra', d.dsChuaChamRa, x => escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ') - vào ' + escapeHtml(x.gioVao));
  html += dsCard('🕒 Đi trễ', d.dsDiTre, x => escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ') - trễ ' + x.soPhutTre + ' phút');
  html += dsCard('🏃 Về sớm', d.dsVeSom, x => escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ') - sớm ' + x.soPhutVeSom + ' phút');
  html += dsCard('📅 Nghỉ hôm nay (đã duyệt)', d.dsNghi, x => escapeHtml(x.hoTen) + ' (' + escapeHtml(x.phongBan) + ') - ' + escapeHtml(tenCaNgan(x.caNghi)) + ' - ' + escapeHtml(x.loaiNghi));

  $('hrDashBox').innerHTML = html;
}

function copyHRReport() {
  if (!hrData) return;
  const d = hrData, t = d.tongQuan;
  let out = '📊 BÁO CÁO NHÂN SỰ HÔM NAY - ' + fmtDate(d.ngay) + '\n\n' +
    'Tổng nhân viên active: ' + t.tongActive + '\n' +
    'Đã chấm vào: ' + t.daChamVao + '\n' +
    'Chưa chấm vào: ' + t.chuaChamVao + '\n' +
    'Đã chấm ra: ' + t.daChamRa + '\n' +
    'Đang nghỉ: ' + t.nghi + '\n' +
    'Đi trễ: ' + t.diTre + '\n';
  Object.keys(d.theoPhongBan).sort().forEach(pb => {
    const p = d.theoPhongBan[pb];
    out += '\n' + pb + ':\n- Có mặt: ' + p.coMat + '\n- Nghỉ: ' + p.nghi + '\n- Chưa chấm: ' + p.chuaCham + '\n- Đi trễ: ' + p.diTre + '\n';
  });
  out += '\nPM lưu ý sắp xếp nhân sự trong ngày.';
  copyText(out, 'báo cáo nhân sự');
}

function copyHRDS(loai) {
  if (!hrData) return;
  const d = hrData;
  let out = '', label = '';
  if (loai === 'chuaChamVao') {
    label = 'danh sách chưa chấm vào';
    out = '⏳ CHƯA CHẤM VÀO - ' + fmtDate(d.ngay) + '\n\n';
    out += d.dsChuaChamVao.length ? d.dsChuaChamVao.map(x => '- ' + x.hoTen + ' (' + x.phongBan + ')').join('\n') : '(Không có ai)';
  } else if (loai === 'nghi') {
    label = 'danh sách nghỉ hôm nay';
    out = '📅 NGHỈ HÔM NAY - ' + fmtDate(d.ngay) + '\n\n';
    out += d.dsNghi.length ? d.dsNghi.map(x => '- ' + x.hoTen + ' (' + x.phongBan + ') - ' + tenCaNgan(x.caNghi) + ' - ' + x.loaiNghi).join('\n') : '(Không có ai nghỉ)';
  } else {
    label = 'danh sách đi trễ';
    out = '🕒 ĐI TRỄ - ' + fmtDate(d.ngay) + '\n\n';
    out += d.dsDiTre.length ? d.dsDiTre.map(x => '- ' + x.hoTen + ' (' + x.phongBan + '): trễ ' + x.soPhutTre + ' phút').join('\n') : '(Không có ai đi trễ)';
  }
  copyText(out, label);
}
