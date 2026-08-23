import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BackgroundGeolocation } from '@capgo/background-geolocation';

const HR_ORIGIN = 'https://nhaminh-hr-tt.xuonginanhnhaminh.workers.dev';
const WORKSHOP = { lat: 15.1182955, lng: 108.7838916, radius: 200 };
const REMIND_AFTER_MIN = 5;
const statusEl = document.getElementById('status')!;
const frame = document.getElementById('hr') as HTMLIFrameElement;

type UserCtx = { userID?: string; phongBan?: string; khuVuc?: string; hoTen?: string };
let ctx: UserCtx | null = null;
let inside = false;

const SLOT = {
  VAO_SANG: 1,
  RA_SANG: 2,
  VAO_CHIEU: 3,
  RA_CHIEU: 4,
} as const;

type SlotKey = keyof typeof SLOT;

type ShiftTimes = Record<SlotKey, string>;

function setStatus(s: string) { statusEl.textContent = s; }

function shiftFor(u: UserCtx | null): ShiftTimes {
  const pb = (u?.phongBan || '').toLowerCase();
  const kv = (u?.khuVuc || '').toLowerCase();
  // Cán/In giữ giờ riêng 07:30-11:30 / 13:30-17:30.
  if (kv === 'canin' || pb === 'cskh' || pb === 'kythuat') {
    return { VAO_SANG:'07:30', RA_SANG:'11:30', VAO_CHIEU:'13:30', RA_CHIEU:'17:30' };
  }
  // Gia công còn lại.
  return { VAO_SANG:'08:00', RA_SANG:'12:00', VAO_CHIEU:'14:00', RA_CHIEU:'18:00' };
}

function haversine(aLat:number,aLng:number,bLat:number,bLng:number) {
  const R=6371000, rad=(x:number)=>x*Math.PI/180;
  const dLat=rad(bLat-aLat), dLng=rad(bLng-aLng);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

function notificationId(date: Date, slot: SlotKey) {
  const y=date.getFullYear()%100, m=date.getMonth()+1, d=date.getDate();
  return y*1000000 + m*10000 + d*100 + SLOT[slot];
}

function atTime(date: Date, hhmm: string) {
  const [h,m]=hhmm.split(':').map(Number);
  const x=new Date(date);
  x.setHours(h,m+REMIND_AFTER_MIN,0,0);
  return x;
}

async function cancelAllScheduled() {
  const pending=await LocalNotifications.getPending();
  const ours=pending.notifications.filter(n => n.extra?.nhaminhAttendance === true);
  if (ours.length) await LocalNotifications.cancel({notifications:ours.map(n=>({id:n.id}))});
}

async function scheduleWeek() {
  if (!inside || !ctx?.userID) return;
  await cancelAllScheduled();
  const times=shiftFor(ctx);
  const now=new Date();
  const notes:any[]=[];
  for(let add=0;add<7;add++){
    const day=new Date(now); day.setDate(day.getDate()+add); day.setHours(0,0,0,0);
    (Object.keys(SLOT) as SlotKey[]).forEach(slot=>{
      const at=atTime(day,times[slot]);
      if(at<=now) return;
      const label:Record<SlotKey,string>={
        VAO_SANG:'vào sáng', RA_SANG:'ra trưa', VAO_CHIEU:'vào chiều', RA_CHIEU:'ra chiều'
      };
      notes.push({
        id:notificationId(day,slot),
        title:'⏰ Nhắc chấm công',
        body:`Bạn đang ở xưởng. Nếu chưa chấm ${label[slot]}, hãy chấm công ngay.`,
        schedule:{at},
        extra:{nhaminhAttendance:true,slot,userID:ctx!.userID}
      });
    });
  }
  if(notes.length) await LocalNotifications.schedule({notifications:notes});
  setStatus(`✅ Nhắc chấm công đang bật · ${ctx.hoTen || ctx.userID}`);
}

async function cancelTodaySlot(slot: SlotKey) {
  const id=notificationId(new Date(),slot);
  try { await LocalNotifications.cancel({notifications:[{id}]}); } catch (_) {}
}

function slotFromPunchAction(action:string):SlotKey {
  const h=new Date().getHours();
  if(action==='checkIn') return h<12?'VAO_SANG':'VAO_CHIEU';
  return h<13?'RA_SANG':'RA_CHIEU';
}

async function checkInsideNow() {
  try{
    const p=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:30000});
    inside=haversine(p.coords.latitude,p.coords.longitude,WORKSHOP.lat,WORKSHOP.lng)<=WORKSHOP.radius;
    if(inside) await scheduleWeek(); else { await cancelAllScheduled(); setStatus('📍 Ngoài khu vực xưởng · không nhắc'); }
  }catch(e){
    setStatus('⚠ Chưa lấy được GPS nền. Mở quyền Vị trí: Luôn luôn.');
  }
}

async function initNative() {
  try{
    await LocalNotifications.requestPermissions();
    await Geolocation.requestPermissions();

    await BackgroundGeolocation.setupGeofencing({
      backgroundLocation:true,
      notifyOnEntry:true,
      notifyOnExit:true
    } as any);
    try { await BackgroundGeolocation.removeGeofence({identifier:'NHAMINH_WORKSHOP'} as any); } catch (_) {}
    await BackgroundGeolocation.addGeofence({
      identifier:'NHAMINH_WORKSHOP',
      latitude:WORKSHOP.lat,
      longitude:WORKSHOP.lng,
      radius:WORKSHOP.radius,
      payload:{kind:'attendance'}
    } as any);

    await BackgroundGeolocation.addListener('geofenceTransition' as any, async (ev:any)=>{
      if(ev.identifier!=='NHAMINH_WORKSHOP') return;
      const tr=String(ev.transition||'').toLowerCase();
      if(tr.includes('enter')) { inside=true; await scheduleWeek(); }
      if(tr.includes('exit')) { inside=false; await cancelAllScheduled(); setStatus('📍 Đã rời xưởng · hủy nhắc'); }
    });

    await LocalNotifications.addListener('localNotificationActionPerformed',()=>{
      frame.focus();
    });

    await checkInsideNow();
  }catch(e){
    console.error(e);
    setStatus('⚠ Chưa bật được nhắc nền. Kiểm tra quyền Vị trí và Thông báo.');
  }
}

window.addEventListener('message', async (ev:MessageEvent)=>{
  if(ev.origin!==HR_ORIGIN) return;
  const m=ev.data||{};
  if(m.type==='NHAMINH_NATIVE_CONTEXT'){
    ctx=m.user||null;
    if(inside) await scheduleWeek();
  }
  if(m.type==='NHAMINH_NATIVE_PUNCH' && m.action){
    await cancelTodaySlot(slotFromPunchAction(String(m.action)));
  }
});

initNative();
