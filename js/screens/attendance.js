async function openChamCong() {
  showScreen('scr-chamcong', 'Chấm công');
  loadChamCong();
}

async function loadChamCong() {
  $('ccBox').innerHTML = '<div class="muted">Đang tải...</div>';
  const res = await api('getTodayAttendance', { userID: user.userID });
  if (!res.success) { $('ccBox').innerHTML = '<div class="alert red">' + escapeHtml(res.message) + '</div>'; return; }
  const d = res.data, cc = d.chamCong;
  let html = '<div class="line">👤 <b>' + escapeHtml(user.hoTen) + '</b> · ' + escapeHtml(user.phongBan) + '</div>' +
    '<div class="line">📅 <b>' + fmtDate(d.ngay) + '</b> · Giờ hiện tại: <b>' + escapeHtml(d.gioHienTai) + '</b></div>';
  if (d.requiredPunches) {
    // Chế độ 4 mốc
    const defaultStatus = d.requiredPunches.length === 0 ? 'Nghỉ' : 'Chưa chấm công';
    html += '<div class="line" style="margin-top:6px">Trạng thái ngày: ' + badgeHtml(cc ? cc.trangThai : defaultStatus, false) + '</div>';
    
    html += '<div style="margin-top:10px; border-top:1px solid #eee; padding-top:8px">';
    html += '<b>Các lượt chấm công hôm nay:</b>';
    
    const labelMap = {
      VAO_SANG: "Vào sáng",
      RA_SANG: "Ra sáng",
      VAO_CHIEU: "Vào chiều",
      RA_CHIEU: "Ra chiều"
    };
    
    d.requiredPunches.forEach(p => {
      const isDone = d.completedPunches.includes(p);
      const isNext = (d.nextPunch === p);
      let timeVal = '';
      if (cc) {
        if (p === 'VAO_SANG') timeVal = cc.vaoSang;
        else if (p === 'RA_SANG') timeVal = cc.raSang;
        else if (p === 'VAO_CHIEU') timeVal = cc.vaoChieu;
        else if (p === 'RA_CHIEU') timeVal = cc.raChieu;
      }
      
      let indicator = '⚪';
      let style = 'color:#666';
      if (isDone) {
        indicator = '🟢';
        style = 'font-weight:bold; color:green';
      } else if (isNext) {
        indicator = '🔵';
        style = 'font-weight:bold; color:#0056b3';
      }
      
      // Hiển thị chi tiết đi trễ về sớm
      let extra = '';
      if (isDone && cc) {
        if (p === 'VAO_SANG' && cc.treSang && Number(cc.treSang) > 0) {
          extra = ' <span class="badge tu-choi">Trễ ' + cc.treSang + 'p</span>';
        } else if (p === 'RA_SANG' && cc.veSomSang && Number(cc.veSomSang) > 0) {
          extra = ' <span class="badge cho-duyet">Sớm ' + cc.veSomSang + 'p</span>';
        } else if (p === 'VAO_CHIEU' && cc.treChieu && Number(cc.treChieu) > 0) {
          extra = ' <span class="badge tu-choi">Trễ ' + cc.treChieu + 'p</span>';
        } else if (p === 'RA_CHIEU' && cc.veSomChieu && Number(cc.veSomChieu) > 0) {
          extra = ' <span class="badge cho-duyet">Sớm ' + cc.veSomChieu + 'p</span>';
        }
      }
      
      html += `<div class="line" style="margin: 4px 0; ${style}">${indicator} ${labelMap[p] || p}: <b>${timeVal || (isNext ? 'chờ chấm...' : 'chưa chấm')}</b>${extra}</div>`;
    });
    
    if (cc && d.attendanceCompleted && d.requiredPunches.length > 0) {
      html += '<div style="margin-top:8px; font-size:0.95em; color:#444">';
      html += `Số giờ hiện diện: <b>${cc.soGioHienDienThucTe || 0}h</b> · Số giờ công: <b>${cc.soGioCongTinhLuong || 0}h</b>`;
      if (Number(cc.soGioTangCaDuocDuyet) > 0) {
        html += ` · Tăng ca: <b>${cc.soGioTangCaDuocDuyet}h</b>`;
      }
      html += '</div>';
    }
    html += '</div>';

    // Render nút hành động tương ứng với lượt tiếp theo
    if (d.attendanceCompleted) {
      if (d.requiredPunches.length === 0) {
        $('ccActionArea').innerHTML = '<div class="alert green">🌴 Hôm nay bạn nghỉ cả ngày (không cần chấm công).</div>';
      } else {
        $('ccActionArea').innerHTML = '<div class="alert green">🎉 Bạn đã hoàn thành chấm công ngày hôm nay.</div>';
      }
    } else if (d.nextPunch) {
      const next = d.nextPunch;
      if (next === 'VAO_SANG') {
        $('ccActionArea').innerHTML = '<button class="btn green" style="width:100%" onclick="doCheckIn()">✅ Chấm vào sáng</button>';
      } else if (next === 'RA_SANG') {
        $('ccActionArea').innerHTML = '<button class="btn orange" style="width:100%" onclick="doCheckOut()">🕔 Chấm ra sáng</button>';
      } else if (next === 'VAO_CHIEU') {
        $('ccActionArea').innerHTML = '<button class="btn green" style="width:100%" onclick="doCheckIn()">✅ Chấm vào chiều</button>';
      } else if (next === 'RA_CHIEU') {
        $('ccActionArea').innerHTML = '<button class="btn orange" style="width:100%" onclick="doCheckOut()">🕔 Chấm ra chiều</button>';
      }
    } else {
      $('ccActionArea').innerHTML = '<div class="alert orange">Hôm nay không có lượt chấm cần thực hiện.</div>';
    }
  } else {
    // Chế độ 2 mốc cũ
    if (cc) {
      html += '<div class="line" style="margin-top:6px">Trạng thái: ' + badgeHtml(cc.trangThai, false) + '</div>' +
        '<div class="line">Giờ vào: <b>' + (cc.gioVao || 'chưa chấm') + '</b>' +
          (cc.diTre ? ' <span class="badge tu-choi">Trễ ' + cc.soPhutTre + 'p</span>' : '') + '</div>' +
        '<div class="line">Giờ ra: <b>' + (cc.gioRa || 'chưa chấm') + '</b>' +
          (cc.veSom ? ' <span class="badge cho-duyet">Sớm ' + cc.soPhutVeSom + 'p</span>' : '') + '</div>';
      if (cc.gioRa) {
        html += '<div class="line">Số giờ làm: <b>' + cc.soGioLam + 'h</b>' +
          (cc.tangCa ? ' · Tăng ca: <b>' + cc.soGioTangCa + 'h</b>' : '') + '</div>';
      }
    } else {
      html += '<div class="alert blue" style="margin-top:8px">Hôm nay bạn chưa chấm công.</div>';
    }
    
    // Nút 2 mốc mặc định
    $('ccActionArea').innerHTML = `
      <button class="btn green" onclick="doCheckIn()">✅ Chấm vào</button>
      <button class="btn orange" onclick="doCheckOut()">🕔 Chấm ra</button>
    `;
  }
  
  if (!d.choPhepChamCong) {
    $('ccActionArea').innerHTML = '<div class="alert orange">Chấm công đang tạm khóa bởi quản lý.</div>';
  }

  // V3.3: thông tin GPS
  gpsCC = d.gps || null;
  if (gpsCC && gpsCC.batBuocGPS) {
    html += gpsCC.daCauHinhToaDo
      ? '<div class="line muted" style="margin-top:6px">📍 Chấm công cần bật định vị GPS (trong bán kính ' + gpsCC.banKinhMet + 'm quanh ' + escapeHtml(gpsCC.tenDiaDiem || 'xưởng') + ').</div>'
      : '<div class="alert orange">📍 Bắt buộc GPS nhưng CHƯA cấu hình tọa độ xưởng. Quản lý vào Cấu hình nhân sự → Vị trí chấm công để thiết lập.</div>';
  }
  $('ccBox').innerHTML = html;
}

function layViTri_() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      resolve({ err: 'Trình duyệt không hỗ trợ định vị GPS. Hãy dùng Chrome/Safari mới hơn.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy) }),
      e => {
        let msg = 'Không lấy được vị trí. Vui lòng bật định vị GPS và thử lại.';
        if (e.code === 1) msg = 'Bạn đã từ chối quyền vị trí. Vào cài đặt trình duyệt, cho phép truy cập vị trí rồi thử lại.';
        else if (e.code === 3) msg = 'Lấy vị trí quá lâu. Vui lòng ra chỗ thoáng hơn và thử lại.';
        resolve({ err: msg });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

async function guiChamCong_(action) {
  toast('Đang lấy vị trí của bạn...');
  const vt = await layViTri_();

  // Nơi làm việc bắt buộc GPS -> không có vị trí thì chặn ngay tại frontend
  // (backend vẫn chặn lần nữa, đây chỉ là lớp báo lỗi sớm cho dễ hiểu)
  if (vt.err && gpsCC && gpsCC.batBuocGPS) { alert(vt.err); return; }
  if (!vt.err) toast('Đã có vị trí, đang chấm công...');

  const res = await api(action, {
    userID: user.userID,
    ghiChu: $('ccGhiChu').value.trim(),
    latitude: vt.err ? '' : vt.lat,
    longitude: vt.err ? '' : vt.lng,
    accuracy: vt.err ? '' : vt.acc
  });
  if (res.success) {
    toast(res.message);
    $('ccGhiChu').value = '';
    if (res.warning) alert('⚠ ' + res.warning);
  } else {
    alert(res.message);
  }
  loadChamCong();
}

function doCheckIn() { guiChamCong_('checkIn'); }

function doCheckOut() { guiChamCong_('checkOut'); }
