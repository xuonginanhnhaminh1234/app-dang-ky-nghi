import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { BackgroundGeolocation } from '@capgo/background-geolocation';

const HR_API='https://jegxhnwjrzcpgsrxnawd.supabase.co/functions/v1/hr-api';
const WORKSHOP={lat:15.1182955,lng:108.7838916,radius:200};
const REMIND_AFTER_MIN=5;
const statusEl=document.getElementById('status')!;
const setupEl=document.getElementById('setup')!;
const pinEl=document.getElementById('pin') as HTMLInputElement;
const activateEl=document.getElementById('activate') as HTMLButtonElement;
const frame=document.getElementById('hr') as HTMLIFrameElement;

type UserCtx={userID?:string;phongBan?:string;khuVuc?:string;hoTen?:string};
type SlotKey='VAO_SANG'|'RA_SANG'|'VAO_CHIEU'|'RA_CHIEU';
const SLOT:Record<SlotKey,number>={VAO_SANG:1,RA_SANG:2,VAO_CHIEU:3,RA_CHIEU:4};
let ctx:UserCtx|null=null,session='',inside=false;

function setStatus(s:string){statusEl.textContent=s;}
function shiftFor(u:UserCtx|null){const pb=(u?.phongBan||'').toLowerCase(),kv=(u?.khuVuc||'').toLowerCase();if(kv==='canin'||pb==='cskh'||pb==='kythuat')return{VAO_SANG:'07:30',RA_SANG:'11:30',VAO_CHIEU:'13:30',RA_CHIEU:'17:30'};return{VAO_SANG:'08:00',RA_SANG:'12:00',VAO_CHIEU:'14:00',RA_CHIEU:'18:00'};}
function hav(a:number,b:number,c:number,d:number){const R=6371000,r=(x:number)=>x*Math.PI/180,x=r(c-a),y=r(d-b),q=Math.sin(x/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function nid(date:Date,slot:SlotKey){return(date.getFullYear()%100)*1000000+(date.getMonth()+1)*10000+date.getDate()*100+SLOT[slot];}
function atTime(date:Date,hhmm:string){const[h,m]=hhmm.split(':').map(Number),x=new Date(date);x.setHours(h,m+REMIND_AFTER_MIN,0,0);return x;}
async function api(action:string,data:any={}){const res=await fetch(HR_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});return res.json();}
async function saveAuth(){await Preferences.set({key:'hr_reminder_session',value:session});await Preferences.set({key:'hr_reminder_user',value:JSON.stringify(ctx||{})});}
async function loadAuth(){session=(await Preferences.get({key:'hr_reminder_session'})).value||'';const u=(await Preferences.get({key:'hr_reminder_user'})).value;ctx=u?JSON.parse(u):null;}
async function cancelAll(){const p=await LocalNotifications.getPending();const ours=p.notifications.filter(n=>n.extra?.nhaminhAttendance===true);if(ours.length)await LocalNotifications.cancel({notifications:ours.map(n=>({id:n.id}))});}
async function cancelSlot(slot:SlotKey){try{await LocalNotifications.cancel({notifications:[{id:nid(new Date(),slot)}]});}catch{}}

async function scheduleWeek(){
  if(!inside||!ctx?.userID)return;await cancelAll();const times=shiftFor(ctx),now=new Date(),notes:any[]=[];
  const label:Record<SlotKey,string>={VAO_SANG:'vào sáng',RA_SANG:'ra trưa',VAO_CHIEU:'vào chiều',RA_CHIEU:'ra chiều'};
  for(let add=0;add<7;add++){const day=new Date(now);day.setDate(day.getDate()+add);day.setHours(0,0,0,0);(Object.keys(SLOT) as SlotKey[]).forEach(slot=>{const at=atTime(day,(times as any)[slot]);if(at<=now)return;notes.push({id:nid(day,slot),title:'⏰ Nhắc chấm công',body:`Bạn đang ở xưởng. Nếu chưa chấm ${label[slot]}, hãy chấm công ngay.`,schedule:{at,allowWhileIdle:true},extra:{nhaminhAttendance:true,slot,userID:ctx!.userID}});});}
  if(notes.length)await LocalNotifications.schedule({notifications:notes});setStatus(`✅ Đang nhắc · ${ctx.hoTen||ctx.userID}`);
}

async function syncPunches(){
  if(!session||!ctx?.userID||!inside)return;
  try{const out=await api('getTodayAttendance',{sessionToken:session});if(!out?.success){if(out?.code==='SESSION_EXPIRED'||out?.code==='NO_SESSION'){session='';ctx=null;setupEl.style.display='block';setStatus('⚠ Phiên nhắc hết hạn · nhập PIN lại');}return;}const done=new Set((out.data?.punches||[]).map((x:any)=>x.loai));for(const s of Object.keys(SLOT) as SlotKey[])if(done.has(s))await cancelSlot(s);}catch(e){console.error(e);}
}

async function activate(){
  const pin=pinEl.value.trim();if(!pin)return;activateEl.disabled=true;setStatus('Đang bật nhắc…');
  try{const out=await api('loginFull',{pin});if(!out?.success)throw new Error(out?.message||'PIN không đúng');const d=out.data||{};session=d.sessionToken||d.token||'';const u=d.user||d.profile||d;ctx={userID:u.userID||u.user_code||u.maNhanVien,hoTen:u.hoTen||u.full_name||u.ten,phongBan:u.phongBan||u.department,khuVuc:u.khuVuc||u.work_area};if(!session||!ctx.userID)throw new Error('Không lấy được phiên đăng nhập.');await saveAuth();pinEl.value='';setupEl.style.display='none';await checkInsideNow();await syncPunches();}
  catch(e:any){alert(e.message||String(e));setStatus('⚠ Chưa bật nhắc');}finally{activateEl.disabled=false;}
}

async function checkInsideNow(){try{const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:30000});inside=hav(p.coords.latitude,p.coords.longitude,WORKSHOP.lat,WORKSHOP.lng)<=WORKSHOP.radius;if(inside){await scheduleWeek();await syncPunches();}else{await cancelAll();setStatus('📍 Ngoài khu vực xưởng · không nhắc');}}catch{setStatus('⚠ Hãy cấp quyền Vị trí: Luôn luôn');}}

async function init(){
  await loadAuth();setupEl.style.display=session&&ctx?.userID?'none':'block';activateEl.addEventListener('click',activate);
  await LocalNotifications.requestPermissions();await Geolocation.requestPermissions();
  try{const exact=await LocalNotifications.checkExactNotificationSetting();if(exact.exact_alarm!=='granted')await LocalNotifications.changeExactNotificationSetting();}catch{}
  try{await BackgroundGeolocation.setupGeofencing({backgroundLocation:true,notifyOnEntry:true,notifyOnExit:true} as any);try{await BackgroundGeolocation.removeGeofence({identifier:'NHAMINH_WORKSHOP'} as any);}catch{}await BackgroundGeolocation.addGeofence({identifier:'NHAMINH_WORKSHOP',latitude:WORKSHOP.lat,longitude:WORKSHOP.lng,radius:WORKSHOP.radius,payload:{kind:'attendance'}} as any);await BackgroundGeolocation.addListener('geofenceTransition' as any,async(ev:any)=>{if(ev.identifier!=='NHAMINH_WORKSHOP')return;const t=String(ev.transition||'').toLowerCase();if(t.includes('enter')){inside=true;await scheduleWeek();await syncPunches();}if(t.includes('exit')){inside=false;await cancelAll();setStatus('📍 Đã rời xưởng · hủy nhắc');}});}catch(e){console.error(e);}
  await LocalNotifications.addListener('localNotificationActionPerformed',()=>frame.focus());await checkInsideNow();
  setInterval(()=>{if(document.visibilityState==='visible')syncPunches();},5000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){checkInsideNow();syncPunches();}});
}
init();
