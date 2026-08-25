// Supabase HR TEST adapter — injected into the existing V5 script before init().
(() => {
  'use strict';

  const CORE_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-api';
  const EXTRA_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-extra-api';
  const HR_DASH_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-dashboard-api';
  const REPORT_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-report-api';
  const ANNOUNCE_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-announcement-api';
  const DASH_V5_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-dashboard-v5-api';
  const PAY_V5_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-payroll-v5-api';
  const LATE_API = 'https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-late-report-api';
  const SESSION_KEY = 'nhaminh_hr_session_test';

  const EXTRA_ACTIONS = new Set([
    'getAttendanceByDay','updateAttendanceByManager','createAttendanceByManager',
    'getPayrollDraft','getWorkSchedule','updateWorkSchedule',
    'getAttendanceConfig','getHRConfig','updateAttendanceConfig','updateHRConfig',
    'getGeneralConfig','updateGeneralConfig','getSlotConfig','updateSlotConfig',
    'getDefaultSlotConfig','updateDefaultSlotConfig','getMinimumStaffConfig','updateMinimumStaffConfig',
    'lockDate','unlockDate','getLockedDates','getModuleConfig','updateModuleConfig'
  ]);
  const REPORT_ACTIONS = new Set(['getLeaveDashboard','getMonthlyLeaveDashboard']);
  const ANNOUNCE_ACTIONS = new Set(['getAnnouncements','markAnnouncementRead','createAnnouncement','deactivateAnnouncement']);
  const DASH_V5_ACTIONS = new Set([
    'getPendingTasks','getBirthdays','getProbationAlerts','getPMDashboard','chotNgay','closePMDay','closeDay',
    'getOwnerDashboard','getKPIToday','updateKPI','getKPIConfig','updateKPIConfig'
  ]);
  const PAY_V5_ACTIONS = new Set([
    'getLockStatus','lockPeriod','lockPayroll','unlockPeriod','getPayrollV5','getLockedPayroll','exportPayrollTSV'
  ]);
  const LATE_ACTIONS = new Set(['getMonthlyLateReport']);

  function getSession(){ return localStorage.getItem(SESSION_KEY) || ''; }
  function setSession(token){ if(token) localStorage.setItem(SESSION_KEY, token); }
  function clearSession(){ localStorage.removeItem(SESSION_KEY); }

  function addDaysISO(days){
    const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+Number(days||0));
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
    const m=Object.fromEntries(p.map(x=>[x.type,x.value])); return m.year+'-'+m.month+'-'+m.day;
  }

  function normalizeRequest(action, data){
    const p={...(data||{})};
    if(action==='updateModuleConfig' && p.enable!==undefined && p.state===undefined) p.state=p.enable;
    if(action==='updateMinimumStaffConfig' && p.soNguoiToiThieu!==undefined && p.nhanSuToiThieu===undefined) p.nhanSuToiThieu=p.soNguoiToiThieu;
    if(action==='chotNgay' && p.lyDoTon && !p.lyDo) p.lyDo=p.lyDoTon;
    return p;
  }

  function normalizeResponse(action, out){
    if(action==='chotNgay' && !out?.success && out?.message && /^Còn\s+\d+\s+việc/.test(out.message)) out.data={...(out.data||{}),needLyDo:true};
    if(!out?.success) return out;
    if((action==='getMyLeaves'||action==='getAllLeaves') && Array.isArray(out.data)) out.data=out.data.map(x=>({...x,thoiGianDangKy:x.thoiGianDangKy||x.ngayTao||'',taoThayNhanVien:x.taoThayNhanVien===true}));
    if(action==='getMinimumStaffConfig' && Array.isArray(out.data)) out.data=out.data.map(x=>({...x,soNguoiToiThieu:x.soNguoiToiThieu??x.nhanSuToiThieu??0}));
    if(action==='getModuleConfig' && Array.isArray(out.data)){
      const isManager=!!(user&&(user.laChuXuong||user.duocQuanLyNhanSu||user.duocSuaCauHinh));
      out.data=out.data.map(x=>{const st=x.trangThai||x.state||x.value||'FALSE';return {...x,trangThai:st,duocDung:st==='TRUE'||(st==='TEST'&&isManager)}});
    }
    if(action==='getBirthdays' && out.data){
      out.data.homNay=Array.isArray(out.data.homNay)?out.data.homNay:[];
      out.data.sapToi=(Array.isArray(out.data.sapToi)?out.data.sapToi:[]).filter(x=>Number(x.conNgay??x.soNgayConLai??999)<=7).map(x=>({...x,conNgay:Number(x.conNgay??x.soNgayConLai??0),ngayMung:x.ngayMung||addDaysISO(Number(x.soNgayConLai||0))}));
    }
    return out;
  }

  async function callSupabase(action,data={},silent=false){
    const endpoint = action==='getHRDashboard' ? HR_DASH_API
      : REPORT_ACTIONS.has(action) ? REPORT_API
      : ANNOUNCE_ACTIONS.has(action) ? ANNOUNCE_API
      : DASH_V5_ACTIONS.has(action) ? DASH_V5_API
      : PAY_V5_ACTIONS.has(action) ? PAY_V5_API
      : LATE_ACTIONS.has(action) ? LATE_API
      : EXTRA_ACTIONS.has(action) ? EXTRA_API
      : CORE_API;
    const payload=normalizeRequest(action,data);
    if(action!=='login'&&action!=='loginFull'&&action!=='health'){const token=getSession();if(token)payload.sessionToken=token;}
    try{
      if(!silent&&typeof showLoading==='function')showLoading(true);
      const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data:payload})});
      let out=await res.json();
      if((action==='login'||action==='loginFull')&&out?.success&&out?.data?.sessionToken)setSession(out.data.sessionToken);
      if(action==='logout'||out?.code==='SESSION_EXPIRED'||out?.code==='NO_SESSION')clearSession();
      return normalizeResponse(action,out);
    }catch(err){return {success:false,message:'Không kết nối được Supabase HR. Kiểm tra mạng rồi thử lại.'};}
    finally{if(!silent&&typeof showLoading==='function')showLoading(false);}
  }

  api=(action,data)=>callSupabase(action,data,false);
  if(typeof apiSilent!=='undefined')apiSilent=(action,data)=>callSupabase(action,data,true);

  const oldLogout=logout;
  logout=async function(){try{const token=getSession();if(token)await callSupabase('logout',{sessionToken:token},true)}catch(_){ }clearSession();oldLogout();};

  // Chưa port: phiếu sửa công V5 và quyết định nhân sự. OT thủ công cố ý không dùng.
  const LEGACY_TEST_HIDE=['mnDieuChinh','mnQuyetDinh','mnTangCa'];
  const oldRenderHome=renderHome;
  renderHome=function(){
    oldRenderHome();
    LEGACY_TEST_HIDE.forEach(id=>{const el=document.getElementById(id);if(el)el.classList.add('hidden')});
    const info=document.getElementById('homeInfo');
    if(info&&!document.getElementById('supabasePilotBadge')){const badge=document.createElement('div');badge.id='supabasePilotBadge';badge.className='alert blue';badge.style.marginTop='10px';badge.textContent='SUPABASE TEST · Chấm công 4 mốc · OT tự tính từ giờ chấm ra';info.parentNode.appendChild(badge);}
  };

  loadChamCong=async function(){
    const box=document.getElementById('ccBox');if(box)box.innerHTML='<div class="muted">Đang tải...</div>';
    const res=await callSupabase('getTodayAttendance',{},false);
    if(!res?.success){if(box)box.innerHTML='<div class="alert red">'+escapeHtml(res?.message||'Lỗi')+'</div>';return}
    const d=res.data||{},map={};(d.punches||[]).forEach(x=>map[x.loai]=x);
    const labels={VAO_SANG:'1. Vào sáng',RA_SANG:'2. Ra trưa',VAO_CHIEU:'3. Vào chiều',RA_CHIEU:'4. Ra chiều'};
    let html='<div class="line">👤 <b>'+escapeHtml(user?.hoTen||'')+'</b> · '+escapeHtml(user?.phongBan||'')+(user?.khuVuc?' / '+escapeHtml(user.khuVuc):'')+'</div>'+'<div class="line">📅 <b>'+fmtDate(d.ngay)+'</b> · Ca: <b>'+escapeHtml(d.caLam||'FULL')+'</b></div>'+'<div class="alert blue">Mốc tiếp theo: <b>'+escapeHtml(d.nextExpectedLabel||'Đã đủ mốc')+'</b></div>';
    ['VAO_SANG','RA_SANG','VAO_CHIEU','RA_CHIEU'].forEach(k=>{html+='<div class="line" style="display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:8px 0"><span>'+labels[k]+'</span><b>'+(map[k]?.gio||'Chưa chấm')+'</b></div>'});
    if(d.chamCong){const ot=Number(d.chamCong.soGioTangCa||0);html+='<div class="line" style="margin-top:8px">Giờ làm hiện có: <b>'+Number(d.chamCong.soGioLam||0).toFixed(2)+'h</b>'+(ot>0?' · OT tự tính: <b>'+ot.toFixed(2)+'h</b>':'')+(d.chamCong.diTre?' · <span class="badge tu-choi">Trễ '+d.chamCong.soPhutTre+'p</span>':'')+(d.chamCong.veSom?' · <span class="badge cho-duyet">Sớm '+d.chamCong.soPhutVeSom+'p</span>':'')+'</div>';}
    gpsCC=d.gps||null;if(d.gps?.daCauHinhToaDo)html+='<div class="line muted">📍 GPS '+d.gps.banKinhMet+'m quanh '+escapeHtml(d.gps.tenDiaDiem||'xưởng')+'</div>';
    if(box)box.innerHTML=html;
  };

  function lateDetailText(row){
    const valid=(row.chiTiet||[]).filter(x=>!x.canKiemTra).map(x=>fmtDate(x.ngay)+': '+Number(x.phutTre||0)+'p');
    const review=(row.chiTiet||[]).filter(x=>x.canKiemTra).map(x=>fmtDate(x.ngay)+': '+Number(x.phutTre||0)+'p ⚠');
    return [...valid,...review].join(' · ');
  }

  if(typeof loadPMDash==='function'){
    const oldLoadPMDash=loadPMDash;
    loadPMDash=async function(){
      await oldLoadPMDash();
      const box=document.getElementById('pmdBox');
      if(!box)return;
      const res=await callSupabase('getMonthlyLateReport',{},true);
      if(!res?.success){
        box.insertAdjacentHTML('beforeend','<div class="alert red" style="margin-top:12px">Không tải được báo cáo đi trễ tháng: '+escapeHtml(res?.message||'Lỗi')+'</div>');
        return;
      }
      const d=res.data||{};
      let html='<div class="card" style="margin-top:12px"><b>⏱ Đi trễ tháng '+escapeHtml(d.thang||'')+'</b>'+
        '<div class="line" style="margin-top:8px">Hợp lệ: <b>'+Number(d.tongLanTreHopLe||0)+' lần</b> · <b>'+Number(d.tongPhutTreHopLe||0)+' phút</b>'+
        (Number(d.tongLanCanKiemTra||0)>0?' · <span class="badge cho-duyet">⚠ '+Number(d.tongLanCanKiemTra||0)+' lần cần kiểm tra</span>':'')+'</div>'+
        '<div class="muted" style="margin-top:4px">Lần trễ trên '+Number(d.nguongCanKiemTraPhut||60)+' phút không cộng vào vi phạm, chỉ gắn cờ để PM kiểm tra.</div>';
      if(!(d.danhSach||[]).length){
        html+='<div class="alert green" style="margin-top:8px">Tháng này chưa có nhân sự đi trễ.</div>';
      }else{
        (d.danhSach||[]).forEach(r=>{
          html+='<details style="margin-top:8px;border-top:1px solid #eee;padding-top:8px"><summary><b>'+escapeHtml(r.hoTen||r.userID)+'</b> · '+escapeHtml(r.phongBan||'')+' — '+Number(r.soLanTre||0)+' lần / '+Number(r.tongPhutTre||0)+' phút'+(Number(r.soLanCanKiemTra||0)>0?' · ⚠ '+Number(r.soLanCanKiemTra||0)+' kiểm tra':'')+'</summary><div class="muted" style="margin-top:6px;line-height:1.55">'+escapeHtml(lateDetailText(r))+'</div></details>';
        });
      }
      html+='</div>';
      box.insertAdjacentHTML('beforeend',html);
    };
  }

  console.log('[NHAMINH HR] Supabase adapter loaded · V5 parity + monthly late report');
})();
