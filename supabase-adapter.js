// Supabase HR TEST adapter — loaded after the existing V5 index.html
// Keeps the current UI but replaces the Apps Script/Netlify API transport.
(() => {
  'use strict';

  const CORE_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-api';
  const EXTRA_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-extra-api';
  const SESSION_KEY = 'nhaminh_hr_session_test';

  const EXTRA_ACTIONS = new Set([
    'getAttendanceByDay','updateAttendanceByManager','createAttendanceByManager',
    'getHRDashboard','getPayrollDraft','getWorkSchedule','updateWorkSchedule',
    'getAttendanceConfig','getHRConfig','updateAttendanceConfig','updateHRConfig',
    'getGeneralConfig','updateGeneralConfig',
    'getSlotConfig','updateSlotConfig','getDefaultSlotConfig','updateDefaultSlotConfig',
    'getMinimumStaffConfig','updateMinimumStaffConfig',
    'lockDate','unlockDate','getLockedDates','getModuleConfig','updateModuleConfig'
  ]);

  const CORE_ACTIONS = new Set([
    'health','login','loginFull','refreshFull','refreshUser','logout','getLeaveOptions',
    'getTodayAttendance','checkIn','checkOut','getMyAttendance','getMonthlyAttendanceReport',
    'getAttendanceHistory','submitLeave','getMyLeaves','cancelMyLeave','getAllLeaves',
    'approveLeave','approveOverSlot','rejectLeave','cancelLeaveByManager','createLeaveForEmployee',
    'getEmployees','getEmployeeDetail','createEmployee','updateEmployee','deactivateEmployee',
    'submitAdvance','getMyAdvances','getAllAdvances','approveAdvance','rejectAdvance','markAdvancePaid',
    'getBonusPenaltyList','createBonusPenalty','updateBonusPenalty','deleteBonusPenalty',
    'getOvertimeList','createOvertime','submitOvertimeRequest','approveOvertime','rejectOvertime','cancelMyOvertime',
    'getDepartmentShiftConfig','updateDepartmentShiftConfig',
    'getAttendanceLocationConfig','updateAttendanceLocationConfig','setCurrentLocationAsWorkshop'
  ]);

  function getSession() {
    return localStorage.getItem(SESSION_KEY) || '';
  }
  function setSession(token) {
    if (token) localStorage.setItem(SESSION_KEY, token);
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  async function callSupabase(action, data = {}) {
    const endpoint = EXTRA_ACTIONS.has(action) ? EXTRA_API : CORE_API;
    const payload = { ...(data || {}) };
    if (action !== 'login' && action !== 'loginFull' && action !== 'health') {
      const token = getSession();
      if (token) payload.sessionToken = token;
    }

    try {
      if (typeof showLoading === 'function') showLoading(true);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, data: payload })
      });
      const out = await res.json();

      if ((action === 'login' || action === 'loginFull') && out?.success && out?.data?.sessionToken) {
        setSession(out.data.sessionToken);
      }
      if (action === 'logout') clearSession();
      if (out?.code === 'SESSION_EXPIRED' || out?.code === 'NO_SESSION') clearSession();
      return out;
    } catch (err) {
      return { success:false, message:'Không kết nối được Supabase HR. Kiểm tra mạng rồi thử lại.' };
    } finally {
      if (typeof showLoading === 'function') showLoading(false);
    }
  }

  // Replace global API function used by the existing V5 UI.
  window.api = callSupabase;
  try { api = callSupabase; } catch (_) {}

  // Preserve the old logout UI behavior but revoke the Supabase session too.
  const oldLogout = window.logout;
  window.logout = async function() {
    try {
      const token = getSession();
      if (token) await callSupabase('logout', { sessionToken: token });
    } catch (_) {}
    clearSession();
    if (typeof oldLogout === 'function') oldLogout();
  };
  try { logout = window.logout; } catch (_) {}

  // Current Supabase pilot intentionally enables only migrated/stable modules.
  // Hide legacy V4/V5 modules that are not migrated yet so TEST users don't hit dead routes.
  const SUPPORTED_MENU_IDS = new Set([
    'mnDashboard','mnDuyet','mnTaoThay','mnSlot','mnKhoa','mnHRDash','mnNhanVien',
    'mnBCNgay','mnBCThang','mnTangCa','mnTamUngQL','mnThuongPhat','mnLuong','mnCauHinhNS'
  ]);
  const LEGACY_TEST_HIDE = [
    'mnThongBao','mnPMDash','mnDieuChinh','mnQuyetDinh','mnChotKy','mnOwner','mnPending','mnBirthday','mnTBQL'
  ];

  const oldRenderHome = window.renderHome;
  if (typeof oldRenderHome === 'function') {
    window.renderHome = function() {
      oldRenderHome();
      LEGACY_TEST_HIDE.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const info = document.getElementById('homeInfo');
      if (info && !document.getElementById('supabasePilotBadge')) {
        const b = document.createElement('div');
        b.id = 'supabasePilotBadge';
        b.className = 'alert blue';
        b.style.marginTop = '10px';
        b.textContent = 'SUPABASE TEST · Chấm công 4 mốc · Production cũ chưa bị thay đổi';
        info.parentNode.appendChild(b);
      }
    };
    try { renderHome = window.renderHome; } catch (_) {}
  }

  // Improve the existing attendance card to explicitly show all 4 Supabase punches.
  const oldLoadChamCong = window.loadChamCong;
  window.loadChamCong = async function() {
    const box = document.getElementById('ccBox');
    if (box) box.innerHTML = '<div class="muted">Đang tải...</div>';
    const res = await callSupabase('getTodayAttendance', {});
    if (!res?.success) {
      if (box) box.innerHTML = '<div class="alert red">' + (typeof escapeHtml==='function'?escapeHtml(res?.message||'Lỗi'):String(res?.message||'Lỗi')) + '</div>';
      return;
    }
    const d=res.data||{}, p=d.punches||[];
    const map={}; p.forEach(x=>map[x.loai]=x);
    const esc = typeof escapeHtml==='function' ? escapeHtml : (x=>String(x||''));
    const label={VAO_SANG:'1. Vào sáng',RA_SANG:'2. Ra trưa',VAO_CHIEU:'3. Vào chiều',RA_CHIEU:'4. Ra chiều'};
    let html='<div class="line">👤 <b>'+esc(window.user?.hoTen||'')+'</b> · '+esc(window.user?.phongBan||'')+'</div>'+
      '<div class="line">📅 <b>'+(typeof fmtDate==='function'?fmtDate(d.ngay):esc(d.ngay))+'</b> · Ca: <b>'+esc(d.caLam||'FULL')+'</b></div>'+
      '<div class="alert blue">Mốc tiếp theo: <b>'+esc(d.nextExpectedLabel||'Đã đủ mốc')+'</b></div>';
    ['VAO_SANG','RA_SANG','VAO_CHIEU','RA_CHIEU'].forEach(k=>{
      html += '<div class="line" style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0"><span>'+label[k]+'</span><b>'+(map[k]?.gio||'Chưa chấm')+'</b></div>';
    });
    if(d.chamCong){
      html += '<div class="line" style="margin-top:8px">Giờ làm hiện có: <b>'+Number(d.chamCong.soGioLam||0).toFixed(2)+'h</b>'+
        (d.chamCong.diTre?' · <span class="badge tu-choi">Trễ '+d.chamCong.soPhutTre+'p</span>':'')+
        (d.chamCong.veSom?' · <span class="badge cho-duyet">Sớm '+d.chamCong.soPhutVeSom+'p</span>':'')+'</div>';
    }
    window.gpsCC=d.gps||null;
    if(d.gps?.daCauHinhToaDo) html += '<div class="line muted">📍 GPS '+d.gps.banKinhMet+'m quanh '+esc(d.gps.tenDiaDiem||'xưởng')+'</div>';
    if(box) box.innerHTML=html;
  };
  try { loadChamCong = window.loadChamCong; } catch (_) {}

  console.log('[NHAMINH HR] Supabase adapter loaded');
})();
