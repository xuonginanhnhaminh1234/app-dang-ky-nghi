// Supabase HR TEST adapter — injected into the existing V5 script before init().
(() => {
  'use strict';

  const CORE_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-api';
  const EXTRA_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-extra-api';
  const SESSION_KEY = 'nhaminh_hr_session_test';

  const EXTRA_ACTIONS = new Set([
    'getAttendanceByDay','updateAttendanceByManager','createAttendanceByManager',
    'getHRDashboard','getPayrollDraft','getWorkSchedule','updateWorkSchedule',
    'getAttendanceConfig','getHRConfig','updateAttendanceConfig','updateHRConfig',
    'getGeneralConfig','updateGeneralConfig','getSlotConfig','updateSlotConfig',
    'getDefaultSlotConfig','updateDefaultSlotConfig','getMinimumStaffConfig','updateMinimumStaffConfig',
    'lockDate','unlockDate','getLockedDates','getModuleConfig','updateModuleConfig'
  ]);

  function getSession(){ return localStorage.getItem(SESSION_KEY) || ''; }
  function setSession(token){ if(token) localStorage.setItem(SESSION_KEY, token); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  async function callSupabase(action, data = {}, silent = false){
    const endpoint = EXTRA_ACTIONS.has(action) ? EXTRA_API : CORE_API;
    const payload = { ...(data || {}) };
    if(action !== 'login' && action !== 'loginFull' && action !== 'health'){
      const token = getSession();
      if(token) payload.sessionToken = token;
    }
    try{
      if(!silent && typeof showLoading === 'function') showLoading(true);
      const res = await fetch(endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({action, data:payload})
      });
      const out = await res.json();
      if((action === 'login' || action === 'loginFull') && out?.success && out?.data?.sessionToken) setSession(out.data.sessionToken);
      if(action === 'logout' || out?.code === 'SESSION_EXPIRED' || out?.code === 'NO_SESSION') clearSession();
      return out;
    }catch(err){
      return {success:false,message:'Không kết nối được Supabase HR. Kiểm tra mạng rồi thử lại.'};
    }finally{
      if(!silent && typeof showLoading === 'function') showLoading(false);
    }
  }

  api = (action,data) => callSupabase(action,data,false);
  if(typeof apiSilent !== 'undefined') apiSilent = (action,data) => callSupabase(action,data,true);

  const oldLogout = logout;
  logout = async function(){
    try{ const token=getSession(); if(token) await callSupabase('logout',{sessionToken:token},true); }catch(_){ }
    clearSession();
    oldLogout();
  };

  const LEGACY_TEST_HIDE = ['mnThongBao','mnPMDash','mnDieuChinh','mnQuyetDinh','mnChotKy','mnOwner','mnPending','mnBirthday','mnTBQL'];
  const oldRenderHome = renderHome;
  renderHome = function(){
    oldRenderHome();
    LEGACY_TEST_HIDE.forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('hidden'); });
    const info=document.getElementById('homeInfo');
    if(info && !document.getElementById('supabasePilotBadge')){
      const badge=document.createElement('div');
      badge.id='supabasePilotBadge'; badge.className='alert blue'; badge.style.marginTop='10px';
      badge.textContent='SUPABASE TEST · Chấm công 4 mốc · Production cũ chưa bị thay đổi';
      info.parentNode.appendChild(badge);
    }
  };

  loadChamCong = async function(){
    const box=document.getElementById('ccBox');
    if(box) box.innerHTML='<div class="muted">Đang tải...</div>';
    const res=await callSupabase('getTodayAttendance',{},false);
    if(!res?.success){ if(box) box.innerHTML='<div class="alert red">'+escapeHtml(res?.message||'Lỗi')+'</div>'; return; }
    const d=res.data||{}, map={}; (d.punches||[]).forEach(x=>map[x.loai]=x);
    const labels={VAO_SANG:'1. Vào sáng',RA_SANG:'2. Ra trưa',VAO_CHIEU:'3. Vào chiều',RA_CHIEU:'4. Ra chiều'};
    let html='<div class="line">👤 <b>'+escapeHtml(user?.hoTen||'')+'</b> · '+escapeHtml(user?.phongBan||'')+(user?.khuVuc?' / '+escapeHtml(user.khuVuc):'')+'</div>'+ 
      '<div class="line">📅 <b>'+fmtDate(d.ngay)+'</b> · Ca: <b>'+escapeHtml(d.caLam||'FULL')+'</b></div>'+ 
      '<div class="alert blue">Mốc tiếp theo: <b>'+escapeHtml(d.nextExpectedLabel||'Đã đủ mốc')+'</b></div>';
    ['VAO_SANG','RA_SANG','VAO_CHIEU','RA_CHIEU'].forEach(k=>{
      html += '<div class="line" style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0"><span>'+labels[k]+'</span><b>'+(map[k]?.gio||'Chưa chấm')+'</b></div>';
    });
    if(d.chamCong){
      html += '<div class="line" style="margin-top:8px">Giờ làm hiện có: <b>'+Number(d.chamCong.soGioLam||0).toFixed(2)+'h</b>'+
        (d.chamCong.diTre?' · <span class="badge tu-choi">Trễ '+d.chamCong.soPhutTre+'p</span>':'')+
        (d.chamCong.veSom?' · <span class="badge cho-duyet">Sớm '+d.chamCong.soPhutVeSom+'p</span>':'')+'</div>';
    }
    gpsCC=d.gps||null;
    if(d.gps?.daCauHinhToaDo) html += '<div class="line muted">📍 GPS '+d.gps.banKinhMet+'m quanh '+escapeHtml(d.gps.tenDiaDiem||'xưởng')+'</div>';
    if(box) box.innerHTML=html;
  };

  console.log('[NHAMINH HR] Supabase adapter loaded');
})();
