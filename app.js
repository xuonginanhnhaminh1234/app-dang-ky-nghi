function showScreen(id, title) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  const isLogin = (id === 'scr-login');
  $('topbar').classList.toggle('hidden', isLogin);
  $('btnBack').style.visibility = (id === 'scr-home') ? 'hidden' : 'visible';
  $('topTitle').textContent = title || 'Nhân Sự Nhà Mình';
  window.scrollTo(0, 0);
}

function goHome() { renderHome(); }

function logout() {
  localStorage.removeItem(STORAGE_KEY);
  user = null;
  options = null;
  $('inpPin').value = '';
  showScreen('scr-login');
}

async function doLogin() {
  const pin = $('inpPin').value.trim();
  $('loginErr').classList.add('hidden');
  if (!pin) { toast('Vui lòng nhập mã PIN.'); return; }

  const res = await api('login', { pin: pin });
  if (!res.success) {
    $('loginErr').textContent = res.message;
    $('loginErr').classList.remove('hidden');
    return;
  }
  user = res.data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  await loadOptions();
  renderHome();
}

async function loadOptions() {
  const res = await api('getLeaveOptions', { userID: user.userID });
  if (res.success) options = res.data;
  else toast(res.message);
}

function renderHome() {
  $('homeHello').textContent = 'Xin chào, ' + user.hoTen + ' 👋';
  $('homeInfo').innerHTML = 'Phòng ban: <b>' + escapeHtml(user.phongBan) + '</b> · Vai trò: <b>' + escapeHtml(user.vaiTro) + '</b>';
  $('mnDashboard').classList.toggle('hidden', !user.duocXemDashboard);
  $('mnDuyet').classList.toggle('hidden', !user.duocDuyetNghi);
  $('mnTaoThay').classList.toggle('hidden', !user.duocDuyetNghi);
  $('mnSlot').classList.toggle('hidden', !user.duocSuaCauHinh);
  $('mnKhoa').classList.toggle('hidden', !user.duocSuaCauHinh);

  // V3: các nút nhân sự (quyền mới, tài khoản cũ chưa refresh thì coi như false)
  const qlNS = user.duocQuanLyNhanSu === true;
  const suaCong = user.duocSuaCong === true;
  const xemLuong = user.duocXemBangLuong === true;
  const duyetTU = user.duocDuyetTamUng === true;
  const chotLuong = user.duocChotLuong === true;
  $('mnHRDash').classList.toggle('hidden', !user.duocXemDashboard);
  $('mnNhanVien').classList.toggle('hidden', !qlNS);
  $('mnBCNgay').classList.toggle('hidden', !suaCong);
  $('mnBCThang').classList.toggle('hidden', !suaCong);
  $('mnTangCa').classList.toggle('hidden', !suaCong);
  $('mnTamUngQL').classList.toggle('hidden', !duyetTU);
  $('mnThuongPhat').classList.toggle('hidden', !chotLuong);
  $('mnLuong').classList.toggle('hidden', !xemLuong);
  $('mnCauHinhNS').classList.toggle('hidden', !qlNS);

  // Ẩn nhãn "QUẢN LÝ" nếu không có nút quản lý nào
  const coQuanLy = user.duocXemDashboard || user.duocDuyetNghi || user.duocSuaCauHinh ||
    qlNS || suaCong || xemLuong || duyetTU || chotLuong;
  $('lblQuanLy').classList.toggle('hidden', !coQuanLy);

  showScreen('scr-home', 'Trang chính');
}


(async function init() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) { showScreen('scr-login'); return; }
  try { user = JSON.parse(saved); } catch (e) { logout(); return; }

  // Làm mới thông tin user (phòng khi bị đổi quyền / khóa tài khoản)
  const res = await api('refreshUser', { userID: user.userID });
  if (res.success) {
    user = res.data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    await loadOptions();
    renderHome();
  } else {
    logout();
    if (res.message && res.message.indexOf('máy chủ') < 0) toast(res.message);
  }
})();
