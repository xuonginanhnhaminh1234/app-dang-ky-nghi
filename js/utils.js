function showLoading(on) { $('loading').style.display = on ? 'flex' : 'none'; }

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(s) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
  const p = s.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, n) {
  const p = dateStr.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function badgeHtml(trangThai, vuotSlot) {
  const map = {
    'Chờ duyệt': 'cho-duyet',
    'Đã duyệt': 'da-duyet',
    'Từ chối': 'tu-choi',
    'Đã hủy': 'da-huy',
    'Yêu cầu đặc biệt': 'dac-biet',
    // V3: trạng thái chấm công / tạm ứng / nhân viên
    'Đã chi': 'da-duyet',
    'Hoàn tất': 'da-duyet',
    'Chưa hoàn tất': 'cho-duyet',
    'Quản lý chỉnh': 'dac-biet',
    'Quên chấm vào': 'tu-choi',
    'Quên chấm ra': 'tu-choi',
    'Nghỉ': 'da-huy',
    'Đang làm': 'da-duyet',
    'Tạm nghỉ': 'cho-duyet',
    'Nghỉ việc': 'da-huy'
  };
  let html = '<span class="badge ' + (map[trangThai] || 'da-huy') + '">' + escapeHtml(trangThai) + '</span>';
  if (vuotSlot) html += ' <span class="badge vuot">VƯỢT SLOT</span>';
  return html;
}

function tenCa(maCa) {
  if (!options) return maCa;
  const c = options.caLam.find(x => x.maCa === maCa);
  return c ? (c.tenCa + ' (' + c.gioBatDau + '-' + c.gioKetThuc + ')') : maCa;
}

function tenCaNgan(maCa) {
  if (options) {
    const c = options.caLam.find(x => x.maCa === maCa);
    if (c) return c.tenCa;
  }
  return maCa;
}

function groupByPB(list) {
  const m = {};
  list.forEach(lv => { (m[lv.phongBan] = m[lv.phongBan] || []).push(lv); });
  return m;
}

async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Đã copy ' + label + '. Dán vào Zalo được luôn.');
  } catch (e) {
    // Fallback cho trình duyệt cũ / không cấp quyền clipboard
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Đã copy ' + label + '. Dán vào Zalo được luôn.');
  }
}

function fmtMoney(n) { return (Number(n) || 0).toLocaleString('vi-VN'); }
