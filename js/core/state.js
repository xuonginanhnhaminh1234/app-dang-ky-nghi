/* =====================================================
 * CẤU HÌNH API (V3.3.2)
 * App gọi qua Netlify Function proxy (cùng domain) nên mobile
 * browser không phải fetch thẳng sang script.google.com.
 * Link Apps Script /exec giờ đặt trong netlify/functions/api.js
 * (hoặc biến môi trường APPS_SCRIPT_URL trên Netlify).
 *
 * LƯU Ý: link /exec đúng có dạng
 *   https://script.google.com/macros/s/AKfycb.../exec
 * KHÔNG phải link library dạng /macros/library/d/...
 * ===================================================== */
const API_URL = '/.netlify/functions/api';

const STORAGE_KEY = 'nghiapp_user';
let user = null;      // user đang đăng nhập
let options = null;   // getLeaveOptions cache

/* ================== TIỆN ÍCH ================== */
function $(id) { return document.getElementById(id); }
// yyyy-MM-dd -> dd/MM/yyyy
/* ================== GỌI API ================== */
/* ================== ĐIỀU HƯỚNG ================== */
/* ================== LOGIN ================== */
$('inpPin').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
/* ================== HOME ================== */
/* ================== ĐĂNG KÝ NGHỈ ================== */
/* ================== LỊCH NGHỈ CỦA TÔI ================== */
/* ================== DASHBOARD ================== */
/* ================== DASHBOARD THÁNG ================== */
let dashData = null;          // dữ liệu dashboard ngày (dùng cho nút copy hôm nay/ngày mai/tuần)
let monthData = null;         // dữ liệu tháng đang xem (dùng cho nút copy)
let monthFilterReady = false; // bộ lọc tháng chỉ khởi tạo 1 lần

/* ---- Copy lịch hôm nay / ngày mai / tuần này ---- */
// Tên ca ngắn gọn cho hiển thị & copy Zalo (không kèm giờ)
/* ---- Copy Zalo ---- */
/* ================== DUYỆT NGHỈ ================== */
/* ---- Copy tin Zalo cho từng đơn ---- */
let duyetList = {}; // map leaveID -> đơn (nạp lại mỗi lần loadDuyet)
/* ================== TẠO ĐƠN THAY NHÂN VIÊN ================== */
/* ================== QUẢN LÝ SLOT ================== */
/* ================== KHÓA NGÀY ================== */
/* ====================================================
 * ============ JS V3: MODULE NHÂN SỰ =================
 * ==================================================== */
// Đổ select tháng/năm, mặc định tháng hiện tại
/* ---------- V3.1 CHẤM CÔNG ---------- */
/* ---- V3.3: GPS khi chấm công ---- */
let gpsCC = null; // thông tin yêu cầu GPS lấy từ getTodayAttendance

// Lấy vị trí hiện tại của điện thoại. Trả {lat, lng, acc} hoặc {err: 'thông báo'}
/* ---------- V3.2 CÔNG CỦA TÔI ---------- */
/* ---------- V3.3 DASHBOARD NHÂN SỰ ---------- */
let hrData = null;
/* ---------- V3.4 BẢNG CÔNG NGÀY ---------- */
let bcnData = null;
/* ---------- V3.5 BẢNG CÔNG THÁNG ---------- */
let bctData = null;
/* ---------- V3.6 QUẢN LÝ NHÂN VIÊN ---------- */
let nvMapData = {};
let nvEditID = null;
/* ---------- V3.7 TẠM ỨNG CỦA TÔI ---------- */
/* ---------- V3.8 TẠM ỨNG (QUẢN LÝ) ---------- */
let tuqlData = [];
/* ---------- V3.9 THƯỞNG / PHẠT ---------- */
let tpData = [];
/* ---------- V3.10 TĂNG CA ---------- */
let otData = [];
/* ---------- V3.11 BẢNG LƯƠNG SƠ BỘ ---------- */
/* ---------- V3.12 CẤU HÌNH NHÂN SỰ ---------- */
/* ---- V3.3: Cấu hình vị trí chấm công ---- */
let vtData = null; // địa điểm đầu tiên trong sheet (DD001)
/* ---- V3.2: Ca làm theo phòng ban ---- */
let caPBData = [];
// Bấm Sửa: đổ dòng đã có lên form phía trên
/* ================== KHỞI ĐỘNG ================== */
