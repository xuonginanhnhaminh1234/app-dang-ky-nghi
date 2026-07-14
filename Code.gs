/*******************************************************
 * APP ĐĂNG KÝ NGHỈ - XƯỞNG IN ẢNH
 * Backend: Google Apps Script REST API + Google Sheets
 *
 * Cách dùng:
 * 1. Dán toàn bộ file này vào Apps Script của 1 Google Sheet mới.
 * 2. Chạy hàm setupSheets() 1 lần để tạo sheet + dữ liệu mẫu.
 * 3. Deploy > New deployment > Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. Lấy link /exec dán vào biến API_URL trong index.html.
 *******************************************************/

// ================== HẰNG SỐ CHUNG ==================

// Phiên bản backend - mở link /exec trên trình duyệt sẽ thấy số này.
// Nếu app báo "Không nhận diện được action" với action mới, mở /exec kiểm tra:
// thấy version cũ nghĩa là chưa Deploy New Version sau khi dán code.
var APP_VERSION = 'V5.0-RC2';

var TIMEZONE = 'Asia/Ho_Chi_Minh';

var TEN_SHEET = {
  // ----- Sheet cũ (app nghỉ) - KHÔNG ĐỔI TÊN -----
  USERS: 'USERS',
  LICH_NGHI: 'LICH_NGHI',
  CA_LAM: 'CA_LAM',
  CAU_HINH_SLOT: 'CAU_HINH_SLOT',
  CAU_HINH_MAC_DINH: 'CAU_HINH_MAC_DINH',
  NGAY_KHOA: 'NGAY_KHOA',
  CAU_HINH_CHUNG: 'CAU_HINH_CHUNG',
  LEAVE_HISTORY: 'LEAVE_HISTORY',
  NHAN_SU_TOI_THIEU: 'NHAN_SU_TOI_THIEU',
  // ----- Sheet mới V3 (nhân sự) -----
  NHAN_VIEN: 'NHAN_VIEN',
  CHAM_CONG: 'CHAM_CONG',
  CHAM_CONG_HISTORY: 'CHAM_CONG_HISTORY',
  CAU_HINH_CHAM_CONG: 'CAU_HINH_CHAM_CONG',
  LICH_LAM: 'LICH_LAM',
  TANG_CA: 'TANG_CA',
  TAM_UNG: 'TAM_UNG',
  THUONG_PHAT: 'THUONG_PHAT',
  QUYEN_NHAN_SU: 'QUYEN_NHAN_SU',
  // V3.2: giờ làm theo phòng ban
  CAU_HINH_CA_PHONG_BAN: 'CAU_HINH_CA_PHONG_BAN',
  // V3.3: vị trí chấm công GPS
  CAU_HINH_DIA_DIEM_CHAM_CONG: 'CAU_HINH_DIA_DIEM_CHAM_CONG',
  // V4.0: các module mới (tạo bằng setupSheetsV4, KHÔNG dùng setupSheets cũ)
  CAU_HINH_MODULE: 'CAU_HINH_MODULE',
  DOI_CA: 'DOI_CA',
  VE_SOM: 'VE_SOM',
  THONG_BAO: 'THONG_BAO',
  THONG_BAO_DA_DOC: 'THONG_BAO_DA_DOC',
  CHOT_KY: 'CHOT_KY',
  BANG_LUONG: 'BANG_LUONG',
  // V5.0 Production (tạo bằng setupSheetsV5)
  // (V5.0-RC2: NGOAI_LE_GPS đã GỠ theo quyết định 13/07/2026 - GPS chỉ còn fail-closed đơn giản,
  //  trường hợp đặc biệt PM sửa công tay có audit)
  KPI_NGAY: 'KPI_NGAY',
  CAU_HINH_KPI: 'CAU_HINH_KPI',
  CHAM_CONG_EVENT: 'CHAM_CONG_EVENT',
  DIEU_CHINH_CONG: 'DIEU_CHINH_CONG',
  LICH_SU_LUONG: 'LICH_SU_LUONG',
  QUYET_DINH_NHAN_SU: 'QUYET_DINH_NHAN_SU',
  CAU_HINH_CONG_CHUAN: 'CAU_HINH_CONG_CHUAN',
  // RC2 fix: RC1 thiếu khai báo key này -> sheet phiên PM bị tạo tên "undefined"
  PHIEN_XU_LY_PM: 'PHIEN_XU_LY_PM'
};

var TRANG_THAI = {
  CHO_DUYET: 'Chờ duyệt',
  DA_DUYET: 'Đã duyệt',
  TU_CHOI: 'Từ chối',
  DA_HUY: 'Đã hủy',
  YEU_CAU_DAC_BIET: 'Yêu cầu đặc biệt'
};

// Các trạng thái CHIẾM slot (Từ chối / Đã hủy không chiếm slot)
var TRANG_THAI_CHIEM_SLOT = [
  TRANG_THAI.CHO_DUYET,
  TRANG_THAI.DA_DUYET,
  TRANG_THAI.YEU_CAU_DAC_BIET
];

var CA_HOP_LE = ['SANG', 'CHIEU', 'FULL'];

// Gợi ý tính công mặc định theo loại nghỉ
var GOI_Y_TINH_CONG = {
  'Có phép': 'Tính phép',
  'Không phép': 'Trừ công',
  'Ốm': 'Chờ quyết định',
  'Việc riêng': 'Trừ công',
  'Khác': 'Chờ quyết định'
};

var DS_LOAI_NGHI = ['Có phép', 'Không phép', 'Ốm', 'Việc riêng', 'Khác'];
var DS_TINH_CONG = ['Tính phép', 'Trừ công', 'Không tính công', 'Chờ quyết định'];

// Nếu phòng ban/ca chưa cấu hình slot ở đâu cả thì coi như không giới hạn
var SLOT_KHONG_GIOI_HAN = 999;

// ================== ENTRY POINT ==================

/**
 * doGet: dùng để kiểm tra API còn sống hay không.
 */
function doGet(e) {
  return jsonOut({
    success: true,
    message: 'API Nhân Sự Nhà Mình đang hoạt động. Hãy gọi bằng POST.',
    data: { version: APP_VERSION, time: nowStr_() }
  });
}

/**
 * doPost: nhận JSON dạng { action: '...', data: {...} }
 * Frontend gửi Content-Type: text/plain;charset=utf-8 để tránh CORS preflight.
 */
function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ success: false, message: 'Dữ liệu gửi lên không hợp lệ (không phải JSON).' });
  }

  var action = req.action || '';
  var data = req.data || {};
  var batDau = Date.now(); // V3.3.3: đo thời gian xử lý từng action

  try {
    switch (action) {
      // ----- Auth -----
      case 'login':                    return jsonOut(loginUser(data.pin));
      case 'refreshUser':              return jsonOut(refreshUser(data.userID));
      // V3.3.3: gộp login/refresh + options thành 1 lượt gọi (API cũ vẫn giữ nguyên)
      case 'loginFull':                return jsonOut(loginFull(data.pin));
      case 'refreshFull':              return jsonOut(refreshFull(data.userID));

      // ----- Nhân viên -----
      case 'getLeaveOptions':          return jsonOut(getLeaveOptions(data.userID));
      case 'submitLeave':              return jsonOut(submitLeave(data));
      case 'getMyLeaves':              return jsonOut(getMyLeaves(data.userID));
      case 'cancelMyLeave':            return jsonOut(cancelMyLeave(data));

      // ----- PM / Quản lý -----
      case 'getAllLeaves':             return jsonOut(getAllLeaves(data.userID, data.filters || {}));
      case 'approveLeave':             return jsonOut(approveLeave(data));
      case 'rejectLeave':              return jsonOut(rejectLeave(data));
      case 'cancelLeaveByManager':     return jsonOut(cancelLeaveByManager(data));
      case 'approveOverSlot':          return jsonOut(approveOverSlot(data));
      case 'createLeaveForEmployee':   return jsonOut(createLeaveForEmployee(data));
      case 'getLeaveDashboard':        return jsonOut(getLeaveDashboard(data.userID));
      case 'getMonthlyLeaveDashboard': return jsonOut(getMonthlyLeaveDashboard(data.userID, data.month, data.year, data.filters || {}));

      // ----- Cấu hình -----
      case 'getSlotConfig':            return jsonOut(getSlotConfig(data.userID, data.filters || {}));
      case 'updateSlotConfig':         return jsonOut(updateSlotConfig(data));
      case 'getDefaultSlotConfig':     return jsonOut(getDefaultSlotConfig(data.userID));
      case 'updateDefaultSlotConfig':  return jsonOut(updateDefaultSlotConfig(data));
      case 'lockDate':                 return jsonOut(lockDate(data));
      case 'unlockDate':               return jsonOut(unlockDate(data));
      case 'getLockedDates':           return jsonOut(getLockedDates(data.userID));
      case 'getGeneralConfig':         return jsonOut(getGeneralConfig(data.userID));
      case 'updateGeneralConfig':      return jsonOut(updateGeneralConfig(data));
      case 'getMinimumStaffConfig':    return jsonOut(getMinimumStaffConfig(data.userID));
      case 'updateMinimumStaffConfig': return jsonOut(updateMinimumStaffConfig(data));

      // ----- V3: Chấm công -----
      case 'getTodayAttendance':         return jsonOut(getTodayAttendance(data.userID));
      case 'checkIn':                    return jsonOut(checkIn(data));
      case 'checkOut':                   return jsonOut(checkOut(data));
      case 'getMyAttendance':            return jsonOut(getMyAttendance(data.userID, data.month, data.year));
      case 'getAttendanceByDay':         return jsonOut(getAttendanceByDay(data.userID, data.ngay, data.filters || {}));
      case 'updateAttendanceByManager':  return jsonOut(updateAttendanceByManager(data));
      case 'createAttendanceByManager':  return jsonOut(createAttendanceByManager(data));
      case 'getMonthlyAttendanceReport': return jsonOut(getMonthlyAttendanceReport(data.userID, data.month, data.year, data.filters || {}));
      case 'getAttendanceHistory':       return jsonOut(getAttendanceHistory(data.userID, data.chamCongID));

      // ----- V3: Hồ sơ nhân viên -----
      case 'getEmployees':        return jsonOut(getEmployees(data.userID, data.filters || {}));
      case 'getEmployeeDetail':   return jsonOut(getEmployeeDetail(data.userID, data.targetUserID));
      case 'createEmployee':      return jsonOut(createEmployee(data));
      case 'updateEmployee':      return jsonOut(updateEmployee(data));
      case 'deactivateEmployee':  return jsonOut(deactivateEmployee(data));

      // ----- V3: Dashboard nhân sự -----
      case 'getHRDashboard':      return jsonOut(getHRDashboard(data.userID, data.ngay));

      // ----- V3: Cấu hình chấm công (getHRConfig/updateHRConfig là alias) -----
      case 'getAttendanceConfig':    return jsonOut(getAttendanceConfig(data.userID));
      case 'updateAttendanceConfig': return jsonOut(updateAttendanceConfig(data));
      case 'getHRConfig':            return jsonOut(getAttendanceConfig(data.userID));
      case 'updateHRConfig':         return jsonOut(updateAttendanceConfig(data));

      // ----- V3.2: Cấu hình ca theo phòng ban -----
      case 'getDepartmentShiftConfig':    return jsonOut(getDepartmentShiftConfig(data.userID));
      case 'updateDepartmentShiftConfig': return jsonOut(updateDepartmentShiftConfig(data));

      // ----- V3.3: Vị trí chấm công GPS -----
      case 'getAttendanceLocationConfig':    return jsonOut(getAttendanceLocationConfig(data.userID));
      case 'updateAttendanceLocationConfig': return jsonOut(updateAttendanceLocationConfig(data));
      case 'setCurrentLocationAsWorkshop':   return jsonOut(setCurrentLocationAsWorkshop(data));

      // ----- V5.0 P1: KPI + Dashboard PM + Chốt ngày -----
      case 'getKPIToday':      return jsonOut(getKPIToday(data.userID, data.ngay));
      case 'updateKPI':        return jsonOut(updateKPI(data));
      case 'getKPIConfig':     return jsonOut(getKPIConfig(data.userID));
      case 'updateKPIConfig':  return jsonOut(updateKPIConfig(data));
      case 'getPMDashboard':   return jsonOut(getPMDashboard(data.userID));
      case 'chotNgay':         return jsonOut(chotNgay(data));

      // ----- V5.0 P1: Đổi ca theo ngày -----
      case 'submitShiftChange':   return jsonOut(submitShiftChange(data));
      case 'getMyShiftChanges':   return jsonOut(getMyShiftChanges(data.userID));
      case 'getAllShiftChanges':  return jsonOut(getAllShiftChanges(data.userID, data.filters || {}));
      case 'approveShiftChange':  return jsonOut(approveShiftChange(data));
      case 'rejectShiftChange':   return jsonOut(rejectShiftChange(data));
      case 'cancelMyShiftChange': return jsonOut(cancelMyShiftChange(data));

      // ----- V5.0 P1: Xin về sớm -----
      case 'submitEarlyLeave':   return jsonOut(submitEarlyLeave(data));
      case 'getMyEarlyLeaves':   return jsonOut(getMyEarlyLeaves(data.userID));
      case 'getAllEarlyLeaves':  return jsonOut(getAllEarlyLeaves(data.userID, data.filters || {}));
      case 'approveEarlyLeave':  return jsonOut(approveEarlyLeave(data));
      case 'rejectEarlyLeave':   return jsonOut(rejectEarlyLeave(data));
      case 'cancelMyEarlyLeave': return jsonOut(cancelMyEarlyLeave(data));

      // ----- V5.0 P1: Nhân viên tự đăng ký tăng ca -----
      case 'submitOvertimeRequest': return jsonOut(submitOvertimeRequest(data));
      case 'cancelMyOvertime':      return jsonOut(cancelMyOvertime(data));

      // ----- V5.0 P2: Phiếu điều chỉnh công 2 cấp -----
      case 'createAdjustment':  return jsonOut(createAdjustment(data));
      case 'getAdjustments':    return jsonOut(getAdjustments(data.userID, data.filters || {}));
      case 'approveAdjustment': return jsonOut(approveAdjustment(data));
      case 'rejectAdjustment':  return jsonOut(rejectAdjustment(data));
      case 'voidAdjustment':    return jsonOut(voidAdjustment(data));

      // ----- V5.0 P3: Lương & quyết định nhân sự -----
      case 'createDecision':    return jsonOut(createDecision(data));
      case 'getDecisions':      return jsonOut(getDecisions(data.userID, data.filters || {}));
      case 'approveDecision':   return jsonOut(approveDecision(data));
      case 'rejectDecision':    return jsonOut(rejectDecision(data));
      case 'getSalaryHistory':  return jsonOut(getSalaryHistory(data.userID, data.targetUserID));
      case 'getPayrollV5':      return jsonOut(getPayrollV5(data.userID, data.month, data.year, data.filters || {}));

      // ----- V5.0 P4: Chốt công/lương + ký nhận + dashboard chủ -----
      case 'lockPeriod':             return jsonOut(lockPeriod(data));
      case 'unlockPeriod':           return jsonOut(unlockPeriod(data));
      case 'getLockStatus':          return jsonOut(getLockStatus(data.userID, data.month, data.year));
      case 'lockPayroll':            return jsonOut(lockPayroll(data));
      case 'getLockedPayroll':       return jsonOut(getLockedPayroll(data.userID, data.month, data.year));
      case 'exportPayrollTSV':       return jsonOut(exportPayrollTSV(data.userID, data.month, data.year));
      case 'getMyPayslip':           return jsonOut(getMyPayslip(data.userID, data.month, data.year));
      case 'confirmSalaryReceived':  return jsonOut(confirmSalaryReceived(data));
      case 'getOwnerDashboard':      return jsonOut(getOwnerDashboard(data.userID));

      // (V5.0-RC2: 6 API ngoại lệ GPS của V4.0.2 đã GỠ - GPS chỉ còn fail-closed đơn giản.
      //  Trường hợp đặc biệt: PM sửa công tay qua updateAttendanceByManager/createAdjustment - có audit.)

      // ----- V4.0 Đợt 1: Feature flags -----
      case 'getModuleConfig':    return jsonOut(getModuleConfig(data.userID));
      case 'updateModuleConfig': return jsonOut(updateModuleConfig(data));

      // ----- V4.0 Đợt 1: Trung tâm việc cần xử lý -----
      case 'getPendingTasks': return jsonOut(getPendingTasks(data.userID));

      // ----- V4.0 Đợt 1: Sinh nhật & hết thử việc -----
      case 'getBirthdays':       return jsonOut(getBirthdays(data.userID));
      case 'getProbationAlerts': return jsonOut(getProbationAlerts(data.userID));

      // ----- V4.0 Đợt 1: Thông báo nội bộ -----
      case 'createAnnouncement':     return jsonOut(createAnnouncement(data));
      case 'getAnnouncements':       return jsonOut(getAnnouncements(data.userID, data.xemTatCa === true));
      case 'markAnnouncementRead':   return jsonOut(markAnnouncementRead(data));
      case 'deactivateAnnouncement': return jsonOut(deactivateAnnouncement(data));

      // ----- V3: Tạm ứng -----
      case 'submitAdvance':    return jsonOut(submitAdvance(data));
      case 'getMyAdvances':    return jsonOut(getMyAdvances(data.userID));
      case 'getAllAdvances':   return jsonOut(getAllAdvances(data.userID, data.filters || {}));
      case 'approveAdvance':   return jsonOut(approveAdvance(data));
      case 'rejectAdvance':    return jsonOut(rejectAdvance(data));
      case 'markAdvancePaid':  return jsonOut(markAdvancePaid(data));

      // ----- V3: Thưởng / phạt -----
      case 'createBonusPenalty':  return jsonOut(createBonusPenalty(data));
      case 'getBonusPenaltyList': return jsonOut(getBonusPenaltyList(data.userID, data.filters || {}));
      case 'updateBonusPenalty':  return jsonOut(updateBonusPenalty(data));
      case 'deleteBonusPenalty':  return jsonOut(deleteBonusPenalty(data));

      // ----- V3: Lương sơ bộ -----
      case 'getPayrollDraft': return jsonOut(getPayrollDraft(data.userID, data.month, data.year, data.filters || {}));

      // ----- V3: Tăng ca -----
      case 'createOvertime':   return jsonOut(createOvertime(data));
      case 'approveOvertime':  return jsonOut(approveOvertime(data));
      case 'rejectOvertime':   return jsonOut(rejectOvertime(data));
      case 'getOvertimeList':  return jsonOut(getOvertimeList(data.userID, data.filters || {}));

      // ----- V3: Lịch làm (nền cho V4, chưa có màn hình riêng) -----
      case 'getWorkSchedule':    return jsonOut(getWorkSchedule(data.userID, data.filters || {}));
      case 'updateWorkSchedule': return jsonOut(updateWorkSchedule(data));

      default:
        return jsonOut({
          success: false,
          message: 'Không nhận diện được action: ' + action + ' (backend ' + APP_VERSION + ')'
        });
    }
  } catch (err) {
    return jsonOut({ success: false, message: 'Lỗi hệ thống: ' + err.message });
  } finally {
    // V3.3.3: log hiệu năng - xem trong Apps Script > Executions (hoặc Cloud Logs)
    // để biết action nào chậm. finally chạy cả khi đã return trong switch.
    console.log('[PERF] action=' + action + ' ms=' + (Date.now() - batDau));
  }
}

/**
 * Trả JSON chuẩn cho frontend.
 */
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================== SETUP SHEETS ==================

/**
 * Chạy 1 lần để tạo toàn bộ sheet + header + dữ liệu mẫu.
 * Sheet nào đã tồn tại thì giữ nguyên, không xóa dữ liệu.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TIMEZONE);

  var dinhNghia = [
    {
      name: TEN_SHEET.USERS,
      headers: ['UserID', 'HoTen', 'MaPIN', 'PhongBan', 'VaiTro', 'DuocXemDashboard', 'DuocDuyetNghi', 'DuocSuaCauHinh', 'TrangThai'],
      sample: [
        ['U001', 'Kiều Doan', '1111', 'CSKH', 'NhanVien', 'FALSE', 'FALSE', 'FALSE', 'Active'],
        ['U002', 'Phúc Hậu', '2222', 'KyThuat', 'NhanVien', 'FALSE', 'FALSE', 'FALSE', 'Active'],
        ['U003', 'Mai', '3333', 'GiaCong', 'NhanVien', 'FALSE', 'FALSE', 'FALSE', 'Active'],
        ['U999', 'Quản lý', '9999', 'QuanLy', 'QuanLy', 'TRUE', 'TRUE', 'TRUE', 'Active']
      ]
    },
    {
      name: TEN_SHEET.LICH_NGHI,
      headers: ['LeaveID', 'UserID', 'HoTen', 'PhongBan', 'NgayNghi', 'CaNghi', 'LoaiNghi', 'LyDo', 'TinhCong', 'TrangThai', 'LaYeuCauDacBiet', 'VuotSlot', 'ThoiGianDangKy', 'NguoiTao', 'TaoThayNhanVien', 'NguoiDuyet', 'ThoiGianDuyet', 'LyDoTuChoi', 'GhiChu'],
      sample: []
    },
    {
      name: TEN_SHEET.CA_LAM,
      headers: ['MaCa', 'TenCa', 'GioBatDau', 'GioKetThuc', 'TrangThai'],
      sample: [
        ['SANG', 'Ca sáng', '07:30', '11:30', 'Active'],
        ['CHIEU', 'Ca chiều', '13:30', '17:30', 'Active'],
        ['FULL', 'Cả ngày', '07:30', '17:30', 'Active']
      ]
    },
    {
      name: TEN_SHEET.CAU_HINH_SLOT,
      headers: ['Ngay', 'PhongBan', 'CaNghi', 'SoLuongToiDa', 'GhiChu', 'CapNhatLanCuoi', 'NguoiCapNhat'],
      sample: []
    },
    {
      name: TEN_SHEET.CAU_HINH_MAC_DINH,
      headers: ['PhongBan', 'CaNghi', 'SoLuongToiDa', 'TrangThai'],
      sample: [
        ['CSKH', 'SANG', '1', 'Active'],
        ['CSKH', 'CHIEU', '1', 'Active'],
        ['KyThuat', 'SANG', '1', 'Active'],
        ['KyThuat', 'CHIEU', '1', 'Active'],
        ['GiaCong', 'SANG', '2', 'Active'],
        ['GiaCong', 'CHIEU', '2', 'Active']
      ]
    },
    {
      name: TEN_SHEET.NGAY_KHOA,
      headers: ['Ngay', 'PhongBan', 'CaNghi', 'LyDoKhoa', 'TrangThai', 'NguoiKhoa', 'ThoiGianKhoa'],
      sample: []
    },
    {
      name: TEN_SHEET.CAU_HINH_CHUNG,
      headers: ['Key', 'Value', 'GhiChu'],
      sample: [
        ['SoNgayBaoTruoc', '2', 'Số ngày tối thiểu phải đăng ký trước'],
        ['ChoPhepYeuCauDacBiet', 'TRUE', 'Cho gửi yêu cầu đặc biệt khi hết slot']
      ]
    },
    {
      name: TEN_SHEET.LEAVE_HISTORY,
      headers: ['LogID', 'LeaveID', 'UserID', 'HoTen', 'HanhDong', 'TrangThaiTruoc', 'TrangThaiSau', 'ThoiGian', 'GhiChu'],
      sample: []
    },
    {
      name: TEN_SHEET.NHAN_SU_TOI_THIEU,
      headers: ['PhongBan', 'CaNghi', 'SoNguoiToiThieu', 'TrangThai'],
      sample: [
        ['CSKH', 'SANG', '3', 'Active'],
        ['CSKH', 'CHIEU', '3', 'Active'],
        ['KyThuat', 'SANG', '1', 'Active'],
        ['KyThuat', 'CHIEU', '1', 'Active'],
        ['GiaCong', 'SANG', '5', 'Active'],
        ['GiaCong', 'CHIEU', '5', 'Active']
      ]
    },

    // ================== SHEET MỚI V3 (NHÂN SỰ) ==================
    {
      name: TEN_SHEET.NHAN_VIEN,
      headers: ['UserID', 'HoTen', 'SoDienThoai', 'PhongBan', 'ChucVu', 'NgayVaoLam', 'NgayNghiViec', 'HinhThucLuong', 'LuongCoBan', 'LuongTheoGio', 'PhuCapCoDinh', 'SoTaiKhoan', 'TenNganHang', 'TrangThaiLamViec', 'GhiChu', 'ThoiGianTao', 'ThoiGianCapNhat'],
      sample: []
    },
    {
      // V3.3: 8 cột GPS nằm CUỐI danh sách - sheet CHAM_CONG đã có dữ liệu
      // sẽ chỉ được nối thêm cột vào cuối, không đụng dữ liệu cũ.
      name: TEN_SHEET.CHAM_CONG,
      headers: ['ChamCongID', 'UserID', 'HoTen', 'PhongBan', 'Ngay', 'GioVao', 'GioRa', 'CaLam', 'SoGioLam', 'DiTre', 'SoPhutTre', 'VeSom', 'SoPhutVeSom', 'TangCa', 'SoGioTangCa', 'TrangThai', 'GhiChuNhanVien', 'GhiChuQuanLy', 'NguoiSuaCuoi', 'ThoiGianTao', 'ThoiGianCapNhat', 'ViDoVao', 'KinhDoVao', 'DoChinhXacVao', 'KhoangCachVao', 'ViDoRa', 'KinhDoRa', 'DoChinhXacRa', 'KhoangCachRa'],
      sample: []
    },
    {
      name: TEN_SHEET.CHAM_CONG_HISTORY,
      headers: ['LogID', 'ChamCongID', 'UserID', 'HoTen', 'HanhDong', 'GiaTriCu', 'GiaTriMoi', 'NguoiThucHien', 'ThoiGian', 'GhiChu'],
      sample: []
    },
    {
      name: TEN_SHEET.CAU_HINH_CHAM_CONG,
      headers: ['Key', 'Value', 'GhiChu'],
      sample: [
        ['GioVaoSang', '07:30', 'Giờ bắt đầu ca sáng'],
        ['GioRaSang', '11:30', 'Giờ kết thúc ca sáng'],
        ['GioVaoChieu', '13:30', 'Giờ bắt đầu ca chiều'],
        ['GioRaChieu', '17:30', 'Giờ kết thúc ca chiều'],
        ['PhutChoPhepTre', '5', 'Số phút cho phép đi trễ'],
        ['PhutChoPhepVeSom', '5', 'Số phút cho phép về sớm'],
        ['TinhTangCaSau', '17:30', 'Sau giờ này tính tăng ca'],
        ['GioNghiTruaBatDau', '11:30', 'Bắt đầu nghỉ trưa'],
        ['GioNghiTruaKetThuc', '13:30', 'Kết thúc nghỉ trưa'],
        ['LamTronGioCong', '0.25', 'Làm tròn giờ công theo 0.25 giờ'],
        ['ChoPhepNhanVienChamCong', 'TRUE', 'Bật/tắt chấm công nhân viên'],
        ['YeuCauGhiChuKhiSuaCong', 'TRUE', 'Quản lý sửa công phải nhập lý do']
      ]
    },
    {
      name: TEN_SHEET.LICH_LAM,
      headers: ['LichLamID', 'Ngay', 'UserID', 'HoTen', 'PhongBan', 'CaLam', 'GioBatDau', 'GioKetThuc', 'LaNgayNghi', 'GhiChu', 'NguoiTao', 'ThoiGianTao', 'ThoiGianCapNhat'],
      sample: []
    },
    {
      name: TEN_SHEET.TANG_CA,
      headers: ['TangCaID', 'UserID', 'HoTen', 'PhongBan', 'Ngay', 'GioBatDau', 'GioKetThuc', 'SoGioTangCa', 'LyDo', 'TrangThai', 'NguoiDuyet', 'ThoiGianDuyet', 'GhiChu'],
      sample: []
    },
    {
      name: TEN_SHEET.TAM_UNG,
      headers: ['TamUngID', 'UserID', 'HoTen', 'PhongBan', 'NgayDeNghi', 'SoTien', 'LyDo', 'TrangThai', 'NguoiDuyet', 'ThoiGianDuyet', 'GhiChu'],
      sample: []
    },
    {
      // Có thêm cột TrangThai (Active/Deleted) để "xóa mềm", không mất lịch sử
      name: TEN_SHEET.THUONG_PHAT,
      headers: ['ThuongPhatID', 'UserID', 'HoTen', 'PhongBan', 'Thang', 'Nam', 'Loai', 'SoTien', 'LyDo', 'NguoiTao', 'ThoiGianTao', 'GhiChu', 'TrangThai'],
      sample: []
    },
    {
      // Quyền nhân sự để RIÊNG, không thêm cột vào USERS.
      // User không có dòng ở đây thì quyền nhân sự = theo DuocSuaCauHinh trong USERS (chủ xưởng có toàn quyền).
      name: TEN_SHEET.QUYEN_NHAN_SU,
      headers: ['UserID', 'DuocQuanLyNhanSu', 'DuocSuaCong', 'DuocXemBangLuong', 'DuocDuyetTamUng', 'DuocChotLuong', 'TrangThai'],
      sample: []
    },
    {
      // V3.2: giờ làm theo phòng ban. Ưu tiên: LICH_LAM riêng -> sheet này -> CAU_HINH_CHAM_CONG chung.
      // Đổi giờ phòng ban nào chỉ cần sửa sheet này (hoặc sửa trong app), không sửa code.
      name: TEN_SHEET.CAU_HINH_CA_PHONG_BAN,
      headers: ['PhongBan', 'CaLam', 'GioBatDau', 'GioKetThuc', 'GioNghiTruaBatDau', 'GioNghiTruaKetThuc', 'PhutChoPhepTre', 'PhutChoPhepVeSom', 'TinhTangCaSau', 'TrangThai', 'GhiChu'],
      sample: [
        ['CSKH', 'SANG', '07:30', '11:30', '', '', '5', '5', '17:30', 'Active', ''],
        ['CSKH', 'CHIEU', '13:30', '17:30', '', '', '5', '5', '17:30', 'Active', ''],
        ['CSKH', 'FULL', '07:30', '17:30', '11:30', '13:30', '5', '5', '17:30', 'Active', ''],
        ['KyThuat', 'SANG', '07:30', '11:30', '', '', '5', '5', '17:30', 'Active', ''],
        ['KyThuat', 'CHIEU', '13:30', '17:30', '', '', '5', '5', '17:30', 'Active', ''],
        ['KyThuat', 'FULL', '07:30', '17:30', '11:30', '13:30', '5', '5', '17:30', 'Active', ''],
        ['GiaCong', 'SANG', '08:00', '12:00', '', '', '5', '5', '17:30', 'Active', ''],
        ['GiaCong', 'CHIEU', '13:30', '17:30', '', '', '5', '5', '17:30', 'Active', ''],
        ['GiaCong', 'FULL', '08:00', '17:30', '12:00', '13:30', '5', '5', '17:30', 'Active', '']
      ]
    },
    {
      // V3.3: vị trí chấm công GPS. ViDo/KinhDo để trống -> quản lý vào app
      // bấm "Lấy vị trí hiện tại làm vị trí xưởng" để thiết lập, không hard-code trong code.
      name: TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG,
      headers: ['DiaDiemID', 'TenDiaDiem', 'ViDo', 'KinhDo', 'BanKinhMet', 'BatBuocGPS', 'ChoPhepChamCongNgoaiViTri', 'TrangThai', 'GhiChu', 'ThoiGianTao', 'ThoiGianCapNhat'],
      sample: [
        ['DD001', 'Xưởng chính', '', '', '400', 'TRUE', 'FALSE', 'Active', 'Vị trí chấm công chính của xưởng', '', '']
      ]
    }
  ];

  dinhNghia.forEach(function (dn) {
    ensureSheetSafe_(ss, dn);
  });

  // NHAN_VIEN còn trống -> tạo hồ sơ mặc định từ USERS (chỉ THÊM dòng, không sửa gì)
  seedNhanVienTuUsers_();

  Logger.log('setupSheets() hoàn tất. AN TOÀN: chỉ tạo sheet/cột còn thiếu, không xóa hay ghi đè dữ liệu.');
}

/**
 * Đảm bảo 1 sheet tồn tại đúng cấu trúc - AN TOÀN VỚI DỮ LIỆU THẬT:
 * - Sheet CHƯA có -> tạo mới + header + dữ liệu mẫu.
 * - Sheet ĐÃ có   -> tuyệt đối không clear / không xóa dòng / không ghi đè;
 *                    chỉ bổ sung header cột còn thiếu vào CUỐI (nếu có).
 */
function ensureSheetSafe_(ss, dn) {
  var sh = ss.getSheetByName(dn.name);

  if (!sh) {
    sh = ss.insertSheet(dn.name);
    // Ép dạng text để ngày & PIN không bị Google tự đổi định dạng (chỉ áp cho sheet MỚI TẠO)
    sh.getRange(1, 1, 2000, dn.headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, dn.headers.length).setValues([dn.headers]).setFontWeight('bold');
    if (dn.sample && dn.sample.length > 0) {
      sh.getRange(2, 1, dn.sample.length, dn.headers.length).setValues(dn.sample);
    }
    sh.setFrozenRows(1);
    return;
  }

  // Sheet đã tồn tại: chỉ thêm header còn thiếu ở cuối, không đụng gì khác
  var lastCol = sh.getLastColumn();
  var hienCo = [];
  if (lastCol > 0) {
    hienCo = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return normalizeStr_(h); });
  }
  dn.headers.forEach(function (h) {
    if (hienCo.indexOf(h) < 0) {
      var col = hienCo.length + 1;
      sh.getRange(1, col).setValue(h).setFontWeight('bold');
      hienCo.push(h);
    }
  });
}

/**
 * Tạo hồ sơ NHAN_VIEN mặc định từ USERS khi NHAN_VIEN còn trống.
 * Chỉ THÊM dòng mới vào NHAN_VIEN, không đụng USERS hay bất kỳ sheet nào khác.
 */
function seedNhanVienTuUsers_() {
  var sh = getSheet_(TEN_SHEET.NHAN_VIEN);
  if (sh.getLastRow() > 1) return; // đã có dữ liệu -> giữ nguyên
  getSheetData(TEN_SHEET.USERS).forEach(function (u) {
    appendRow(TEN_SHEET.NHAN_VIEN, {
      UserID: normalizeStr_(u.UserID),
      HoTen: normalizeStr_(u.HoTen),
      PhongBan: normalizeStr_(u.PhongBan),
      HinhThucLuong: 'Theo tháng',
      TrangThaiLamViec: isActive_(u.TrangThai) ? 'Đang làm' : 'Nghỉ việc',
      ThoiGianTao: nowStr_()
    });
  });
}

// ================== HELPER: SHEET ==================

function getSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Không tìm thấy sheet "' + name + '". Hãy chạy setupSheets() trước.');
  return sh;
}

// ================== V3.3.3: CACHE 2 TẦNG KHI ĐỌC SHEET ==================
// Tầng 1: memo trong CÙNG 1 request (mỗi sheet chỉ đọc 1 lần dù hàm nào gọi lại).
// Tầng 2: CacheService cho các sheet ÍT THAY ĐỔI (danh sách bên dưới),
//         TTL 5 phút; mọi lần app GHI vào sheet đều tự xóa cache nên dữ liệu
//         sửa QUA APP luôn mới. Sửa tay trực tiếp trên Google Sheet thì có thể
//         trễ tối đa 5 phút.
// Sheet giao dịch (LICH_NGHI, CHAM_CONG, TAM_UNG...) KHÔNG cache tầng 2.

var _memoSheetData = {}; // memo theo từng lần chạy (Apps Script mỗi request 1 process)

var SHEETS_CO_CACHE = {
  USERS: 1,
  NHAN_VIEN: 1,
  CA_LAM: 1,
  CAU_HINH_CA_PHONG_BAN: 1,
  CAU_HINH_DIA_DIEM_CHAM_CONG: 1,
  CAU_HINH_CHUNG: 1,
  CAU_HINH_CHAM_CONG: 1,
  CAU_HINH_MAC_DINH: 1,
  NHAN_SU_TOI_THIEU: 1,
  QUYEN_NHAN_SU: 1,
  // V4.0
  CAU_HINH_MODULE: 1,
  THONG_BAO: 1,
  // V5.0 (đổi qua app tự xóa cache; KPI_NGAY/QUYET_DINH/DIEU_CHINH là dữ liệu giao dịch -> KHÔNG cache)
  CAU_HINH_KPI: 1,
  CAU_HINH_CONG_CHUAN: 1,
  LICH_SU_LUONG: 1
};
var CACHE_TTL_GIAY = 300;

/**
 * Chuẩn hóa 1 ô về kiểu chuỗi/số an toàn để so sánh và cache JSON.
 * Ô kiểu Date của Sheets -> chuỗi ('yyyy-MM-dd', 'HH:mm' hoặc 'yyyy-MM-dd HH:mm:ss').
 */
function cellToStr_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (v.getFullYear() < 1902) return Utilities.formatDate(v, TIMEZONE, 'HH:mm'); // ô kiểu giờ
    if (Utilities.formatDate(v, TIMEZONE, 'HH:mm:ss') === '00:00:00') {
      return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd'); // ô kiểu ngày
    }
    return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  }
  return v;
}

/**
 * Đọc toàn bộ sheet thành mảng object theo header dòng 1 (có cache 2 tầng).
 */
function getSheetData(sheetName) {
  // Tầng 1: memo trong request
  if (_memoSheetData[sheetName]) return _memoSheetData[sheetName];

  // Tầng 2: CacheService cho sheet ít đổi
  var dungCache = SHEETS_CO_CACHE[sheetName] === 1;
  if (dungCache) {
    try {
      var cached = CacheService.getScriptCache().get('sheet_' + sheetName);
      if (cached) {
        var rows = JSON.parse(cached);
        _memoSheetData[sheetName] = rows;
        return rows;
      }
    } catch (e) { /* cache lỗi -> đọc sheet thật */ }
  }

  // Đọc sheet thật
  var sh = getSheet_(sheetName);
  var values = sh.getDataRange().getValues();
  var out = [];
  if (values.length >= 2) {
    var headers = values[0];
    for (var i = 1; i < values.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = cellToStr_(values[i][j]);
      }
      out.push(row);
    }
  }

  _memoSheetData[sheetName] = out;
  if (dungCache) {
    try {
      var json = JSON.stringify(out);
      if (json.length < 95000) { // CacheService giới hạn ~100KB/key
        CacheService.getScriptCache().put('sheet_' + sheetName, json, CACHE_TTL_GIAY);
      }
    } catch (e) { /* không cache được thì thôi */ }
  }
  return out;
}

/** Xóa cache 1 sheet (gọi sau MỌI lần ghi để không trả dữ liệu cũ). */
function invalidateSheetCache_(sheetName) {
  delete _memoSheetData[sheetName];
  try {
    CacheService.getScriptCache().remove('sheet_' + sheetName);
  } catch (e) { /* bỏ qua */ }
}

/**
 * V3.3.3: đọc tối đa maxRows dòng CUỐI của sheet - dùng cho sheet lịch sử lớn
 * (CHAM_CONG_HISTORY, LEAVE_HISTORY) thay vì getDataRange toàn sheet.
 */
function getSheetDataTail_(sheetName, maxRows) {
  try {
    var sh = getSheet_(sheetName);
    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow < 2 || lastCol < 1) return [];
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var soDong = Math.min(maxRows, lastRow - 1);
    var values = sh.getRange(lastRow - soDong + 1, 1, soDong, lastCol).getValues();
    var out = [];
    for (var i = 0; i < values.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        row[headers[j]] = cellToStr_(values[i][j]);
      }
      out.push(row);
    }
    return out;
  } catch (e) {
    return [];
  }
}

/**
 * Thêm 1 dòng vào sheet theo object {TenCot: giaTri}.
 */
function appendRow(sheetName, data) {
  var sh = getSheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    return (data[h] !== undefined && data[h] !== null) ? data[h] : '';
  });
  sh.appendRow(row);
  invalidateSheetCache_(sheetName); // V3.3.3: ghi xong xóa cache
}

/**
 * Cập nhật dòng đầu tiên có idColumn = idValue.
 * updateData = {TenCot: giaTriMoi}. Trả về true nếu tìm thấy.
 */
function updateRowById(sheetName, idColumn, idValue, updateData) {
  var sh = getSheet_(sheetName);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf(idColumn);
  if (idCol < 0) throw new Error('Sheet ' + sheetName + ' không có cột ' + idColumn);

  for (var i = 1; i < values.length; i++) {
    if (normalizeStr_(values[i][idCol]) === normalizeStr_(idValue)) {
      for (var key in updateData) {
        var c = headers.indexOf(key);
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(updateData[key]);
      }
      invalidateSheetCache_(sheetName); // V3.3.3: ghi xong xóa cache
      return true;
    }
  }
  return false;
}

// ================== HELPER: CHUẨN HÓA DỮ LIỆU ==================

function normalizeStr_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

/**
 * Chuẩn hóa ngày về dạng 'yyyy-MM-dd' dù trong sheet là Date hay chuỗi.
 */
function normalizeDate_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TIMEZONE, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  // Hỗ trợ trường hợp ai đó gõ tay dd/MM/yyyy vào sheet
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  return s;
}

function isTrue_(v) {
  return v === true || normalizeStr_(v).toUpperCase() === 'TRUE';
}

function isActive_(v) {
  return normalizeStr_(v).toLowerCase() === 'active';
}

function todayStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function nowStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
}

/**
 * Parse 'yyyy-MM-dd' thành Date (giờ địa phương, tránh lệch múi giờ).
 */
function parseDateStr_(s) {
  var p = String(s).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function addDaysStr_(dateStr, days) {
  var d = parseDateStr_(dateStr);
  d.setDate(d.getDate() + days);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

/**
 * Số ngày chênh lệch: to - from (theo ngày, không tính giờ).
 */
function dateDiffDays_(fromStr, toStr) {
  return Math.round((parseDateStr_(toStr) - parseDateStr_(fromStr)) / 86400000);
}

function isValidDateStr_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  var d = parseDateStr_(s);
  return !isNaN(d.getTime());
}

function isActiveStatus_(trangThai) {
  return TRANG_THAI_CHIEM_SLOT.indexOf(normalizeStr_(trangThai)) >= 0;
}

/**
 * FULL chiếm cả 2 ca. Trả về danh sách ca nửa ngày bị chiếm.
 */
function expandCa_(caNghi) {
  return caNghi === 'FULL' ? ['SANG', 'CHIEU'] : [caNghi];
}

// ================== HELPER: USER & QUYỀN ==================

function buildUserPayload_(u) {
  var payload = {
    userID: normalizeStr_(u.UserID),
    hoTen: normalizeStr_(u.HoTen),
    phongBan: normalizeStr_(u.PhongBan),
    vaiTro: normalizeStr_(u.VaiTro),
    duocXemDashboard: isTrue_(u.DuocXemDashboard),
    duocDuyetNghi: isTrue_(u.DuocDuyetNghi),
    duocSuaCauHinh: isTrue_(u.DuocSuaCauHinh)
  };

  // ----- Quyền nhân sự V3 -----
  // Có dòng trong QUYEN_NHAN_SU -> dùng dòng đó.
  // Không có dòng -> mặc định theo DuocSuaCauHinh (chủ xưởng nghiễm nhiên có toàn quyền,
  // nhân viên thường nghiễm nhiên không có quyền nào).
  var hr = getHRPerms_(payload.userID);
  var macDinh = payload.duocSuaCauHinh;
  payload.duocQuanLyNhanSu = hr ? hr.duocQuanLyNhanSu : macDinh;
  payload.duocSuaCong = hr ? hr.duocSuaCong : macDinh;
  payload.duocXemBangLuong = hr ? hr.duocXemBangLuong : macDinh;
  payload.duocDuyetTamUng = hr ? hr.duocDuyetTamUng : macDinh;
  payload.duocChotLuong = hr ? hr.duocChotLuong : macDinh;
  return payload;
}

/**
 * Đọc sheet, trả [] nếu sheet chưa tồn tại (thay vì lỗi).
 * Dùng cho các sheet V3 để app nghỉ cũ vẫn chạy dù chưa chạy setupSheets().
 */
function getSheetDataSafe_(sheetName) {
  try {
    return getSheetData(sheetName);
  } catch (e) {
    return [];
  }
}

/**
 * Lấy dòng quyền nhân sự của user trong QUYEN_NHAN_SU (TrangThai = Active).
 * Trả về null nếu không có dòng (caller tự áp mặc định).
 */
function getHRPerms_(userID) {
  var rows = getSheetDataSafe_(TEN_SHEET.QUYEN_NHAN_SU);
  var id = normalizeStr_(userID);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].UserID) === id && isActive_(rows[i].TrangThai)) {
      return {
        duocQuanLyNhanSu: isTrue_(rows[i].DuocQuanLyNhanSu),
        duocSuaCong: isTrue_(rows[i].DuocSuaCong),
        duocXemBangLuong: isTrue_(rows[i].DuocXemBangLuong),
        duocDuyetTamUng: isTrue_(rows[i].DuocDuyetTamUng),
        duocChotLuong: isTrue_(rows[i].DuocChotLuong)
      };
    }
  }
  return null;
}

/**
 * Kiểm tra quyền nhân sự V3. permKey: 'duocQuanLyNhanSu' | 'duocSuaCong' |
 * 'duocXemBangLuong' | 'duocDuyetTamUng' | 'duocChotLuong'.
 * Trả về dòng USERS nếu có quyền, null nếu không.
 */
function checkHRPerm_(userID, permKey) {
  var u = checkUserActive(userID);
  if (!u) return null;
  var p = buildUserPayload_(u);
  return p[permKey] ? u : null;
}

function getUserByPin(pin) {
  var users = getSheetData(TEN_SHEET.USERS);
  var p = normalizeStr_(pin);
  for (var i = 0; i < users.length; i++) {
    if (normalizeStr_(users[i].MaPIN) === p && isActive_(users[i].TrangThai)) {
      return users[i];
    }
  }
  return null;
}

function getUserById(userID) {
  var users = getSheetData(TEN_SHEET.USERS);
  var id = normalizeStr_(userID);
  for (var i = 0; i < users.length; i++) {
    if (normalizeStr_(users[i].UserID) === id) return users[i];
  }
  return null;
}

/**
 * Trả về user nếu tồn tại và Active, ngược lại null.
 */
function checkUserActive(userID) {
  var u = getUserById(userID);
  if (!u || !isActive_(u.TrangThai)) return null;
  return u;
}

/**
 * Kiểm tra quyền. permission: 'DuocXemDashboard' | 'DuocDuyetNghi' | 'DuocSuaCauHinh'
 * Trả về user nếu có quyền, null nếu không.
 */
function checkPermission(userID, permission) {
  var u = checkUserActive(userID);
  if (!u) return null;
  if (!isTrue_(u[permission])) return null;
  return u;
}

// ================== AUTH ==================

function loginUser(pin) {
  if (!normalizeStr_(pin)) {
    return { success: false, message: 'Vui lòng nhập mã PIN.' };
  }
  var u = getUserByPin(pin);
  if (!u) {
    return { success: false, message: 'Mã PIN không đúng hoặc tài khoản đã bị khóa.' };
  }
  return { success: true, message: 'Đăng nhập thành công.', data: buildUserPayload_(u) };
}

function refreshUser(userID) {
  var u = checkUserActive(userID);
  if (!u) {
    return { success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' };
  }
  return { success: true, message: 'OK', data: buildUserPayload_(u) };
}

// ================== CẤU HÌNH CHUNG ==================

function getConfigMap_() {
  var rows = getSheetData(TEN_SHEET.CAU_HINH_CHUNG);
  var map = {};
  rows.forEach(function (r) {
    map[normalizeStr_(r.Key)] = normalizeStr_(r.Value);
  });
  return map;
}

function getSoNgayBaoTruoc_() {
  var v = Number(getConfigMap_()['SoNgayBaoTruoc']);
  return isNaN(v) ? 0 : v;
}

function choPhepYeuCauDacBiet_() {
  return isTrue_(getConfigMap_()['ChoPhepYeuCauDacBiet']);
}

// ================== HELPER: LOGIC NGHỈ ==================

/**
 * Kiểm tra trùng đơn của 1 user trong 1 ngày.
 * Trả về đơn gây trùng hoặc null.
 * Quy tắc: FULL đụng mọi ca; SANG đụng SANG; CHIEU đụng CHIEU;
 * đăng ký FULL đụng bất kỳ đơn nào cùng ngày.
 * Chỉ tính các đơn đang chiếm slot (Chờ duyệt / Đã duyệt / Yêu cầu đặc biệt).
 */
function checkDuplicateLeave(userID, ngayNghi, caNghi) {
  var leaves = getSheetData(TEN_SHEET.LICH_NGHI);
  var id = normalizeStr_(userID);
  for (var i = 0; i < leaves.length; i++) {
    var lv = leaves[i];
    if (normalizeStr_(lv.UserID) !== id) continue;
    if (normalizeDate_(lv.NgayNghi) !== ngayNghi) continue;
    if (!isActiveStatus_(lv.TrangThai)) continue;
    var caCu = normalizeStr_(lv.CaNghi);
    if (caCu === 'FULL' || caNghi === 'FULL' || caCu === caNghi) {
      return lv;
    }
  }
  return null;
}

/**
 * Kiểm tra ngày/phòng ban/ca có bị khóa không.
 * - PhongBan trống trên sheet = khóa toàn xưởng.
 * - CaNghi trống hoặc FULL = khóa cả ngày.
 * Trả về dòng khóa hoặc null.
 */
function checkDateLocked(ngayNghi, phongBan, caNghi) {
  var locks = getSheetData(TEN_SHEET.NGAY_KHOA);
  var cas = expandCa_(caNghi);
  for (var i = 0; i < locks.length; i++) {
    var lk = locks[i];
    if (!isActive_(lk.TrangThai)) continue;
    if (normalizeDate_(lk.Ngay) !== ngayNghi) continue;

    var pbKhoa = normalizeStr_(lk.PhongBan);
    if (pbKhoa && pbKhoa !== phongBan) continue; // khóa phòng ban khác

    var caKhoa = normalizeStr_(lk.CaNghi);
    if (!caKhoa || caKhoa === 'FULL') return lk;   // khóa cả ngày
    if (cas.indexOf(caKhoa) >= 0) return lk;        // khóa đúng ca đăng ký
  }
  return null;
}

/**
 * Kiểm tra hạn đăng ký trước.
 * Trả về '' nếu OK, hoặc chuỗi lỗi.
 */
function checkAdvanceNotice(ngayNghi) {
  var diff = dateDiffDays_(todayStr_(), ngayNghi);
  if (diff < 0) return 'Ngày nghỉ đã qua, không thể đăng ký.';
  var soNgay = getSoNgayBaoTruoc_();
  if (diff < soNgay) {
    return 'Đăng ký nghỉ phải trước ít nhất ' + soNgay + ' ngày.';
  }
  return '';
}

/**
 * Lấy giới hạn slot cho 1 ngày + phòng ban + ca (SANG hoặc CHIEU).
 * Ưu tiên cấu hình riêng theo ngày (CAU_HINH_SLOT), nếu không có thì
 * dùng CAU_HINH_MAC_DINH, nếu cũng không có thì coi như không giới hạn.
 */
function getSlotLimit(ngayNghi, phongBan, caNghi) {
  var rieng = getSheetData(TEN_SHEET.CAU_HINH_SLOT);
  for (var i = 0; i < rieng.length; i++) {
    if (normalizeDate_(rieng[i].Ngay) === ngayNghi &&
        normalizeStr_(rieng[i].PhongBan) === phongBan &&
        normalizeStr_(rieng[i].CaNghi) === caNghi) {
      var n = Number(rieng[i].SoLuongToiDa);
      return isNaN(n) ? SLOT_KHONG_GIOI_HAN : n;
    }
  }
  var macDinh = getSheetData(TEN_SHEET.CAU_HINH_MAC_DINH);
  for (var j = 0; j < macDinh.length; j++) {
    if (isActive_(macDinh[j].TrangThai) &&
        normalizeStr_(macDinh[j].PhongBan) === phongBan &&
        normalizeStr_(macDinh[j].CaNghi) === caNghi) {
      var m = Number(macDinh[j].SoLuongToiDa);
      return isNaN(m) ? SLOT_KHONG_GIOI_HAN : m;
    }
  }
  return SLOT_KHONG_GIOI_HAN;
}

/**
 * Đếm số slot đã dùng của 1 ngày + phòng ban + ca nửa ngày (SANG/CHIEU).
 * Đơn FULL chiếm cả 2 ca nên được tính vào cả SANG lẫn CHIEU.
 * excludeLeaveID: bỏ qua 1 đơn (dùng khi duyệt lại chính đơn đó).
 */
function countUsedSlot(ngayNghi, phongBan, caNghi, excludeLeaveID) {
  var leaves = getSheetData(TEN_SHEET.LICH_NGHI);
  var count = 0;
  for (var i = 0; i < leaves.length; i++) {
    var lv = leaves[i];
    if (excludeLeaveID && normalizeStr_(lv.LeaveID) === normalizeStr_(excludeLeaveID)) continue;
    if (normalizeDate_(lv.NgayNghi) !== ngayNghi) continue;
    if (normalizeStr_(lv.PhongBan) !== phongBan) continue;
    if (!isActiveStatus_(lv.TrangThai)) continue;
    var ca = normalizeStr_(lv.CaNghi);
    if (ca === caNghi || ca === 'FULL') count++;
  }
  return count;
}

/**
 * Kiểm tra slot cho 1 đăng ký (caNghi có thể là FULL).
 * Trả về { available: bool, chiTiet: [{ca, daDung, gioiHan, conSlot}] }
 */
function checkSlotAvailable(ngayNghi, phongBan, caNghi, excludeLeaveID) {
  var cas = expandCa_(caNghi);
  var chiTiet = [];
  var ok = true;
  cas.forEach(function (ca) {
    var gioiHan = getSlotLimit(ngayNghi, phongBan, ca);
    var daDung = countUsedSlot(ngayNghi, phongBan, ca, excludeLeaveID);
    var conSlot = daDung < gioiHan;
    if (!conSlot) ok = false;
    chiTiet.push({ ca: ca, daDung: daDung, gioiHan: gioiHan, conSlot: conSlot });
  });
  return { available: ok, chiTiet: chiTiet };
}

/**
 * Đếm nhân viên Active của 1 phòng ban.
 */
function countActiveUsers_(phongBan) {
  var users = getSheetData(TEN_SHEET.USERS);
  var count = 0;
  users.forEach(function (u) {
    if (isActive_(u.TrangThai) && normalizeStr_(u.PhongBan) === phongBan) count++;
  });
  return count;
}

/**
 * Lấy mức nhân sự tối thiểu của phòng ban + ca. Trả về 0 nếu không cấu hình.
 */
function getMinStaff_(phongBan, caNghi) {
  var rows = getSheetData(TEN_SHEET.NHAN_SU_TOI_THIEU);
  for (var i = 0; i < rows.length; i++) {
    if (isActive_(rows[i].TrangThai) &&
        normalizeStr_(rows[i].PhongBan) === phongBan &&
        normalizeStr_(rows[i].CaNghi) === caNghi) {
      var n = Number(rows[i].SoNguoiToiThieu);
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

/**
 * Kiểm tra cảnh báo nhân sự tối thiểu.
 * themMoi = 1 khi kiểm tra TRƯỚC khi tạo đơn mới (đơn chưa nằm trong count),
 * themMoi = 0 khi đơn đã nằm trong count (lúc duyệt).
 * Trả về chuỗi cảnh báo ('' nếu không có).
 */
function checkMinimumStaffWarning(ngayNghi, phongBan, caNghi, themMoi) {
  var canhBao = [];
  var tongNhanSu = countActiveUsers_(phongBan);
  expandCa_(caNghi).forEach(function (ca) {
    var toiThieu = getMinStaff_(phongBan, ca);
    if (toiThieu <= 0) return;
    var soNghi = countUsedSlot(ngayNghi, phongBan, ca) + (themMoi || 0);
    var conLai = tongNhanSu - soNghi;
    if (conLai < toiThieu) {
      canhBao.push(phongBan + ' ca ' + ca + ' ngày ' + ngayNghi + ' chỉ còn ' + conLai +
        ' người đi làm, thấp hơn mức tối thiểu ' + toiThieu + ' người.');
    }
  });
  return canhBao.join(' ');
}

// ================== HELPER: ID & LỊCH SỬ ==================

function generateLeaveID() {
  return 'LV-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') +
    '-' + Math.floor(Math.random() * 900 + 100);
}

function generateLogID() {
  return 'LG-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') +
    '-' + Math.floor(Math.random() * 900 + 100);
}

/**
 * Ghi 1 dòng lịch sử thao tác.
 * data = { leaveID, userID, hoTen, hanhDong, trangThaiTruoc, trangThaiSau, ghiChu }
 */
function writeLeaveHistory(data) {
  appendRow(TEN_SHEET.LEAVE_HISTORY, {
    LogID: generateLogID(),
    LeaveID: data.leaveID || '',
    UserID: data.userID || '',
    HoTen: data.hoTen || '',
    HanhDong: data.hanhDong || '',
    TrangThaiTruoc: data.trangThaiTruoc || '',
    TrangThaiSau: data.trangThaiSau || '',
    ThoiGian: nowStr_(),
    GhiChu: data.ghiChu || ''
  });
}

function getLeaveById_(leaveID) {
  var leaves = getSheetData(TEN_SHEET.LICH_NGHI);
  var id = normalizeStr_(leaveID);
  for (var i = 0; i < leaves.length; i++) {
    if (normalizeStr_(leaves[i].LeaveID) === id) return leaves[i];
  }
  return null;
}

/**
 * Chuyển 1 dòng LICH_NGHI thành object gọn cho frontend.
 */
function buildLeavePayload_(lv) {
  return {
    leaveID: normalizeStr_(lv.LeaveID),
    userID: normalizeStr_(lv.UserID),
    hoTen: normalizeStr_(lv.HoTen),
    phongBan: normalizeStr_(lv.PhongBan),
    ngayNghi: normalizeDate_(lv.NgayNghi),
    caNghi: normalizeStr_(lv.CaNghi),
    loaiNghi: normalizeStr_(lv.LoaiNghi),
    lyDo: normalizeStr_(lv.LyDo),
    tinhCong: normalizeStr_(lv.TinhCong),
    trangThai: normalizeStr_(lv.TrangThai),
    laYeuCauDacBiet: isTrue_(lv.LaYeuCauDacBiet),
    vuotSlot: isTrue_(lv.VuotSlot),
    thoiGianDangKy: normalizeStr_(lv.ThoiGianDangKy),
    nguoiTao: normalizeStr_(lv.NguoiTao),
    taoThayNhanVien: isTrue_(lv.TaoThayNhanVien),
    nguoiDuyet: normalizeStr_(lv.NguoiDuyet),
    thoiGianDuyet: normalizeStr_(lv.ThoiGianDuyet),
    lyDoTuChoi: normalizeStr_(lv.LyDoTuChoi),
    ghiChu: normalizeStr_(lv.GhiChu)
  };
}

// ================== NHÂN VIÊN: OPTIONS ==================

/**
 * Trả về các lựa chọn cho form đăng ký nghỉ + thông tin cấu hình.
 * Nếu user có quyền duyệt thì kèm danh sách nhân viên (để tạo đơn thay).
 */
function getLeaveOptions(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  return { success: true, message: 'OK', data: buildLeaveOptionsCore_(u) };
}

/**
 * V3.3.3: lõi dựng options - tách riêng để loginFull/refreshFull dùng chung
 * (gộp login + getLeaveOptions thành 1 lượt gọi).
 */
function buildLeaveOptionsCore_(u) {
  var caLam = getSheetData(TEN_SHEET.CA_LAM)
    .filter(function (c) { return isActive_(c.TrangThai); })
    .map(function (c) {
      return {
        maCa: normalizeStr_(c.MaCa),
        tenCa: normalizeStr_(c.TenCa),
        gioBatDau: normalizeStr_(c.GioBatDau),
        gioKetThuc: normalizeStr_(c.GioKetThuc)
      };
    });

  var loaiNghi = DS_LOAI_NGHI.map(function (l) {
    return { ten: l, tinhCongGoiY: GOI_Y_TINH_CONG[l] || 'Chờ quyết định' };
  });

  // Danh sách phòng ban: gộp từ USERS + cấu hình mặc định
  var pbSet = {};
  getSheetData(TEN_SHEET.USERS).forEach(function (us) {
    if (isActive_(us.TrangThai)) pbSet[normalizeStr_(us.PhongBan)] = true;
  });
  getSheetData(TEN_SHEET.CAU_HINH_MAC_DINH).forEach(function (r) {
    pbSet[normalizeStr_(r.PhongBan)] = true;
  });
  var phongBans = Object.keys(pbSet).filter(function (p) { return p; }).sort();

  var result = {
    caLam: caLam,
    loaiNghi: loaiNghi,
    tinhCong: DS_TINH_CONG,
    soNgayBaoTruoc: getSoNgayBaoTruoc_(),
    choPhepYeuCauDacBiet: choPhepYeuCauDacBiet_(),
    phongBans: phongBans,
    homNay: todayStr_()
  };

  // PM/quản lý: kèm danh sách nhân viên active để tạo đơn thay
  if (isTrue_(u.DuocDuyetNghi)) {
    result.nhanViens = getSheetData(TEN_SHEET.USERS)
      .filter(function (us) { return isActive_(us.TrangThai); })
      .map(function (us) {
        return {
          userID: normalizeStr_(us.UserID),
          hoTen: normalizeStr_(us.HoTen),
          phongBan: normalizeStr_(us.PhongBan)
        };
      });
  }

  return result;
}

/**
 * V3.3.3: đăng nhập + options trong 1 lượt gọi (đỡ 1 round-trip lúc mở app).
 * API 'login' và 'getLeaveOptions' cũ vẫn giữ nguyên để tương thích.
 */
function loginFull(pin) {
  if (!normalizeStr_(pin)) {
    return { success: false, message: 'Vui lòng nhập mã PIN.' };
  }
  var u = getUserByPin(pin);
  if (!u) {
    return { success: false, message: 'Mã PIN không đúng hoặc tài khoản đã bị khóa.' };
  }
  return {
    success: true,
    message: 'Đăng nhập thành công.',
    data: { user: buildUserPayload_(u), options: buildLeaveOptionsCore_(u) }
  };
}

/** V3.3.3: làm mới user + options trong 1 lượt gọi (dùng khi mở lại app). */
function refreshFull(userID) {
  var u = checkUserActive(userID);
  if (!u) {
    return { success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' };
  }
  return {
    success: true,
    message: 'OK',
    data: { user: buildUserPayload_(u), options: buildLeaveOptionsCore_(u) }
  };
}

// ================== NHÂN VIÊN: SUBMIT LEAVE ==================

/**
 * Nhân viên tự đăng ký nghỉ. Dùng LockService để tránh 2 người giành 1 slot.
 * data = { userID, ngayNghi, caNghi, loaiNghi, lyDo, tinhCong, forceSpecialRequest }
 */
function submitLeave(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return submitLeaveCore_(data);
  } finally {
    lock.releaseLock();
  }
}

function submitLeaveCore_(data) {
  // 1. Kiểm tra user
  var u = checkUserActive(data.userID);
  if (!u) return { success: false, message: 'Tài khoản không tồn tại hoặc đã bị khóa.' };

  var userID = normalizeStr_(u.UserID);
  var hoTen = normalizeStr_(u.HoTen);
  var phongBan = normalizeStr_(u.PhongBan);
  var ngayNghi = normalizeDate_(data.ngayNghi);
  var caNghi = normalizeStr_(data.caNghi);
  var loaiNghi = normalizeStr_(data.loaiNghi);
  var lyDo = normalizeStr_(data.lyDo);

  // 2. Kiểm tra dữ liệu đầu vào
  if (!isValidDateStr_(ngayNghi)) return { success: false, message: 'Ngày nghỉ không hợp lệ.' };
  if (CA_HOP_LE.indexOf(caNghi) < 0) return { success: false, message: 'Ca nghỉ không hợp lệ.' };
  if (DS_LOAI_NGHI.indexOf(loaiNghi) < 0) return { success: false, message: 'Loại nghỉ không hợp lệ.' };
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do nghỉ.' };

  var tinhCong = normalizeStr_(data.tinhCong);
  if (DS_TINH_CONG.indexOf(tinhCong) < 0) {
    tinhCong = GOI_Y_TINH_CONG[loaiNghi] || 'Chờ quyết định';
  }

  // 3. Kiểm tra trùng đơn
  var trung = checkDuplicateLeave(userID, ngayNghi, caNghi);
  if (trung) {
    return {
      success: false,
      message: 'Bạn đã có đơn nghỉ ' + normalizeStr_(trung.CaNghi) + ' ngày ' + ngayNghi +
        ' (trạng thái: ' + normalizeStr_(trung.TrangThai) + '). Không thể đăng ký trùng.'
    };
  }

  // 4. Kiểm tra khóa ngày
  var khoa = checkDateLocked(ngayNghi, phongBan, caNghi);
  if (khoa) {
    var lyDoKhoa = normalizeStr_(khoa.LyDoKhoa);
    return {
      success: false,
      message: 'Ngày này tạm khóa đăng ký nghỉ.' + (lyDoKhoa ? ' Lý do: ' + lyDoKhoa : '')
    };
  }

  // 5. Kiểm tra hạn đăng ký trước
  var loiHan = checkAdvanceNotice(ngayNghi);
  if (loiHan) return { success: false, message: loiHan };

  // 6. Kiểm tra slot
  var slot = checkSlotAvailable(ngayNghi, phongBan, caNghi, null);

  // 7. Cảnh báo nhân sự tối thiểu (chỉ để thông tin, không chặn nhân viên)
  var canhBaoNhanSu = checkMinimumStaffWarning(ngayNghi, phongBan, caNghi, 1);

  var thoiGian = nowStr_();

  // 8. Còn slot -> tạo đơn Chờ duyệt
  if (slot.available) {
    var leaveID = generateLeaveID();
    appendRow(TEN_SHEET.LICH_NGHI, {
      LeaveID: leaveID,
      UserID: userID,
      HoTen: hoTen,
      PhongBan: phongBan,
      NgayNghi: ngayNghi,
      CaNghi: caNghi,
      LoaiNghi: loaiNghi,
      LyDo: lyDo,
      TinhCong: tinhCong,
      TrangThai: TRANG_THAI.CHO_DUYET,
      LaYeuCauDacBiet: 'FALSE',
      VuotSlot: 'FALSE',
      ThoiGianDangKy: thoiGian,
      NguoiTao: userID,
      TaoThayNhanVien: 'FALSE'
    });
    writeLeaveHistory({
      leaveID: leaveID, userID: userID, hoTen: hoTen,
      hanhDong: 'Tạo đơn nghỉ', trangThaiTruoc: '', trangThaiSau: TRANG_THAI.CHO_DUYET,
      ghiChu: ngayNghi + ' / ' + caNghi + ' / ' + loaiNghi
    });
    return {
      success: true,
      message: 'Đăng ký nghỉ thành công. Đơn đang chờ duyệt.',
      data: { leaveID: leaveID, trangThai: TRANG_THAI.CHO_DUYET },
      warning: canhBaoNhanSu
    };
  }

  // 9. Hết slot
  var choPhepDacBiet = choPhepYeuCauDacBiet_();

  if (data.forceSpecialRequest === true && choPhepDacBiet) {
    // Tạo đơn Yêu cầu đặc biệt
    var leaveID2 = generateLeaveID();
    appendRow(TEN_SHEET.LICH_NGHI, {
      LeaveID: leaveID2,
      UserID: userID,
      HoTen: hoTen,
      PhongBan: phongBan,
      NgayNghi: ngayNghi,
      CaNghi: caNghi, // vẫn lưu FULL nếu đăng ký FULL
      LoaiNghi: loaiNghi,
      LyDo: lyDo,
      TinhCong: tinhCong,
      TrangThai: TRANG_THAI.YEU_CAU_DAC_BIET,
      LaYeuCauDacBiet: 'TRUE',
      VuotSlot: 'FALSE',
      ThoiGianDangKy: thoiGian,
      NguoiTao: userID,
      TaoThayNhanVien: 'FALSE'
    });
    writeLeaveHistory({
      leaveID: leaveID2, userID: userID, hoTen: hoTen,
      hanhDong: 'Gửi yêu cầu đặc biệt', trangThaiTruoc: '', trangThaiSau: TRANG_THAI.YEU_CAU_DAC_BIET,
      ghiChu: ngayNghi + ' / ' + caNghi + ' / ' + loaiNghi + ' (hết slot)'
    });
    return {
      success: true,
      message: 'Đã gửi yêu cầu đặc biệt. Quản lý sẽ xem xét duyệt hoặc từ chối.',
      data: { leaveID: leaveID2, trangThai: TRANG_THAI.YEU_CAU_DAC_BIET },
      warning: canhBaoNhanSu
    };
  }

  // Không tạo đơn, báo hết slot cho frontend
  return {
    success: false,
    message: 'Ca này đã đủ số người nghỉ.',
    data: {
      hetSlot: true,
      canSpecialRequest: choPhepDacBiet,
      chiTietSlot: slot.chiTiet
    }
  };
}

// ================== NHÂN VIÊN: XEM / HỦY ĐƠN ==================

function getMyLeaves(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };

  var id = normalizeStr_(userID);
  var list = getSheetData(TEN_SHEET.LICH_NGHI)
    .filter(function (lv) { return normalizeStr_(lv.UserID) === id; })
    .map(buildLeavePayload_);

  // Mới nhất lên đầu (theo ngày nghỉ, rồi theo thời gian đăng ký)
  list.sort(function (a, b) {
    if (a.ngayNghi !== b.ngayNghi) return a.ngayNghi < b.ngayNghi ? 1 : -1;
    return a.thoiGianDangKy < b.thoiGianDangKy ? 1 : -1;
  });

  return { success: true, message: 'OK', data: list };
}

/**
 * Nhân viên hủy đơn của chính mình.
 * Chỉ hủy được khi trạng thái là Chờ duyệt hoặc Yêu cầu đặc biệt.
 * data = { userID, leaveID }
 */
function cancelMyLeave(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var u = checkUserActive(data.userID);
    if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };

    var lv = getLeaveById_(data.leaveID);
    if (!lv) return { success: false, message: 'Không tìm thấy đơn nghỉ.' };

    if (normalizeStr_(lv.UserID) !== normalizeStr_(data.userID)) {
      return { success: false, message: 'Bạn chỉ được hủy đơn của chính mình.' };
    }

    var trangThai = normalizeStr_(lv.TrangThai);
    if (trangThai !== TRANG_THAI.CHO_DUYET && trangThai !== TRANG_THAI.YEU_CAU_DAC_BIET) {
      return { success: false, message: 'Chỉ hủy được đơn ở trạng thái "Chờ duyệt" hoặc "Yêu cầu đặc biệt". Đơn đã duyệt cần liên hệ quản lý.' };
    }

    updateRowById(TEN_SHEET.LICH_NGHI, 'LeaveID', lv.LeaveID, {
      TrangThai: TRANG_THAI.DA_HUY,
      GhiChu: appendGhiChu_(lv.GhiChu, 'Nhân viên tự hủy lúc ' + nowStr_())
    });
    writeLeaveHistory({
      leaveID: normalizeStr_(lv.LeaveID), userID: normalizeStr_(u.UserID), hoTen: normalizeStr_(u.HoTen),
      hanhDong: 'Nhân viên hủy đơn', trangThaiTruoc: trangThai, trangThaiSau: TRANG_THAI.DA_HUY, ghiChu: ''
    });
    return { success: true, message: 'Đã hủy đơn nghỉ. Slot được trả lại.' };
  } finally {
    lock.releaseLock();
  }
}

function appendGhiChu_(cu, moi) {
  var c = normalizeStr_(cu);
  return c ? (c + ' | ' + moi) : moi;
}

// ================== PM: XEM TOÀN BỘ ĐƠN ==================

/**
 * PM xem toàn bộ đơn nghỉ, có bộ lọc.
 * filters = { tuNgay, denNgay, phongBan, targetUserID, trangThai }
 */
function getAllLeaves(userID, filters) {
  var u = checkPermission(userID, 'DuocDuyetNghi');
  if (!u) return { success: false, message: 'Bạn không có quyền xem toàn bộ đơn nghỉ.' };

  var tuNgay = normalizeDate_(filters.tuNgay);
  var denNgay = normalizeDate_(filters.denNgay);
  var phongBan = normalizeStr_(filters.phongBan);
  var targetUserID = normalizeStr_(filters.targetUserID);
  var trangThai = normalizeStr_(filters.trangThai);

  var list = getSheetData(TEN_SHEET.LICH_NGHI)
    .map(buildLeavePayload_)
    .filter(function (lv) {
      if (tuNgay && lv.ngayNghi < tuNgay) return false;
      if (denNgay && lv.ngayNghi > denNgay) return false;
      if (phongBan && lv.phongBan !== phongBan) return false;
      if (targetUserID && lv.userID !== targetUserID) return false;
      if (trangThai && lv.trangThai !== trangThai) return false;
      return true;
    });

  // Ngày gần nhất lên đầu, cùng ngày thì đơn gửi trước lên đầu (ai trước giữ slot trước)
  list.sort(function (a, b) {
    if (a.ngayNghi !== b.ngayNghi) return a.ngayNghi < b.ngayNghi ? -1 : 1;
    return a.thoiGianDangKy < b.thoiGianDangKy ? -1 : 1;
  });

  return { success: true, message: 'OK', data: list };
}

// ================== PM: DUYỆT / TỪ CHỐI / HỦY ==================

/**
 * PM duyệt đơn (duyệt thường, tôn trọng slot).
 * data = { managerUserID, leaveID, tinhCong, ghiChu, xacNhanCanhBao }
 */
function approveLeave(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkPermission(data.managerUserID, 'DuocDuyetNghi');
    if (!mgr) return { success: false, message: 'Bạn không có quyền duyệt đơn nghỉ.' };

    var lv = getLeaveById_(data.leaveID);
    if (!lv) return { success: false, message: 'Không tìm thấy đơn nghỉ.' };

    var trangThai = normalizeStr_(lv.TrangThai);
    if (trangThai !== TRANG_THAI.CHO_DUYET && trangThai !== TRANG_THAI.YEU_CAU_DAC_BIET) {
      return { success: false, message: 'Chỉ duyệt được đơn ở trạng thái "Chờ duyệt" hoặc "Yêu cầu đặc biệt".' };
    }

    var ngayNghi = normalizeDate_(lv.NgayNghi);
    var phongBan = normalizeStr_(lv.PhongBan);
    var caNghi = normalizeStr_(lv.CaNghi);

    var chanKhoa = checkKyKhoa_('CONG', ngayNghi); if (chanKhoa) return chanKhoa; // V5 P4

    // Kiểm tra slot lần nữa (loại chính đơn này ra khỏi count rồi so < limit)
    var slot = checkSlotAvailable(ngayNghi, phongBan, caNghi, normalizeStr_(lv.LeaveID));
    if (!slot.available) {
      return {
        success: false,
        message: 'Slot đã đầy, vui lòng dùng "Duyệt vượt slot" nếu vẫn muốn duyệt.',
        data: { needOverSlot: true, chiTietSlot: slot.chiTiet }
      };
    }

    // Cảnh báo nhân sự tối thiểu: đơn này đã nằm trong count -> themMoi = 0
    var canhBao = checkMinimumStaffWarning(ngayNghi, phongBan, caNghi, 0);
    if (canhBao && data.xacNhanCanhBao !== true) {
      return {
        success: false,
        message: 'Cảnh báo nhân sự tối thiểu. Xác nhận lại nếu vẫn muốn duyệt.',
        warning: canhBao,
        data: { needConfirm: true }
      };
    }

    var update = {
      TrangThai: TRANG_THAI.DA_DUYET,
      VuotSlot: 'FALSE',
      NguoiDuyet: normalizeStr_(mgr.UserID),
      ThoiGianDuyet: nowStr_()
    };
    var tinhCong = normalizeStr_(data.tinhCong);
    if (DS_TINH_CONG.indexOf(tinhCong) >= 0) update.TinhCong = tinhCong;
    if (normalizeStr_(data.ghiChu)) update.GhiChu = appendGhiChu_(lv.GhiChu, normalizeStr_(data.ghiChu));

    updateRowById(TEN_SHEET.LICH_NGHI, 'LeaveID', lv.LeaveID, update);
    writeLeaveHistory({
      leaveID: normalizeStr_(lv.LeaveID), userID: normalizeStr_(mgr.UserID), hoTen: normalizeStr_(mgr.HoTen),
      hanhDong: 'Duyệt đơn', trangThaiTruoc: trangThai, trangThaiSau: TRANG_THAI.DA_DUYET,
      ghiChu: normalizeStr_(data.ghiChu)
    });

    return { success: true, message: 'Đã duyệt đơn nghỉ.', warning: canhBao };
  } finally {
    lock.releaseLock();
  }
}

/**
 * PM từ chối đơn. Bắt buộc có lý do.
 * data = { managerUserID, leaveID, lyDoTuChoi }
 */
function rejectLeave(data) {
  var mgr = checkPermission(data.managerUserID, 'DuocDuyetNghi');
  if (!mgr) return { success: false, message: 'Bạn không có quyền từ chối đơn nghỉ.' };

  var lyDoTuChoi = normalizeStr_(data.lyDoTuChoi);
  if (!lyDoTuChoi) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };

  var lv = getLeaveById_(data.leaveID);
  if (!lv) return { success: false, message: 'Không tìm thấy đơn nghỉ.' };

  var trangThai = normalizeStr_(lv.TrangThai);
  if (trangThai !== TRANG_THAI.CHO_DUYET && trangThai !== TRANG_THAI.YEU_CAU_DAC_BIET) {
    return { success: false, message: 'Chỉ từ chối được đơn "Chờ duyệt" hoặc "Yêu cầu đặc biệt". Đơn đã duyệt hãy dùng nút Hủy.' };
  }

  updateRowById(TEN_SHEET.LICH_NGHI, 'LeaveID', lv.LeaveID, {
    TrangThai: TRANG_THAI.TU_CHOI,
    LyDoTuChoi: lyDoTuChoi,
    NguoiDuyet: normalizeStr_(mgr.UserID),
    ThoiGianDuyet: nowStr_()
  });
  writeLeaveHistory({
    leaveID: normalizeStr_(lv.LeaveID), userID: normalizeStr_(mgr.UserID), hoTen: normalizeStr_(mgr.HoTen),
    hanhDong: 'Từ chối đơn', trangThaiTruoc: trangThai, trangThaiSau: TRANG_THAI.TU_CHOI,
    ghiChu: lyDoTuChoi
  });

  return { success: true, message: 'Đã từ chối đơn. Slot được trả lại.' };
}

/**
 * PM hủy đơn (kể cả đơn đã duyệt).
 * data = { managerUserID, leaveID, ghiChu }
 */
function cancelLeaveByManager(data) {
  var mgr = checkPermission(data.managerUserID, 'DuocDuyetNghi');
  if (!mgr) return { success: false, message: 'Bạn không có quyền hủy đơn nghỉ.' };

  var lv = getLeaveById_(data.leaveID);
  if (!lv) return { success: false, message: 'Không tìm thấy đơn nghỉ.' };

  var trangThai = normalizeStr_(lv.TrangThai);
  if (trangThai === TRANG_THAI.DA_HUY || trangThai === TRANG_THAI.TU_CHOI) {
    return { success: false, message: 'Đơn này đã ở trạng thái "' + trangThai + '", không cần hủy.' };
  }

  updateRowById(TEN_SHEET.LICH_NGHI, 'LeaveID', lv.LeaveID, {
    TrangThai: TRANG_THAI.DA_HUY,
    GhiChu: appendGhiChu_(lv.GhiChu, 'Quản lý ' + normalizeStr_(mgr.HoTen) + ' hủy lúc ' + nowStr_() +
      (normalizeStr_(data.ghiChu) ? ': ' + normalizeStr_(data.ghiChu) : ''))
  });
  writeLeaveHistory({
    leaveID: normalizeStr_(lv.LeaveID), userID: normalizeStr_(mgr.UserID), hoTen: normalizeStr_(mgr.HoTen),
    hanhDong: 'Quản lý hủy đơn', trangThaiTruoc: trangThai, trangThaiSau: TRANG_THAI.DA_HUY,
    ghiChu: normalizeStr_(data.ghiChu)
  });

  return { success: true, message: 'Đã hủy đơn nghỉ. Slot được trả lại.' };
}

/**
 * PM duyệt vượt slot: duyệt dù slot đã đầy, đánh dấu VuotSlot = TRUE.
 * data = { managerUserID, leaveID, tinhCong, ghiChu }
 */
function approveOverSlot(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkPermission(data.managerUserID, 'DuocDuyetNghi');
    if (!mgr) return { success: false, message: 'Bạn không có quyền duyệt vượt slot.' };

    var lv = getLeaveById_(data.leaveID);
    if (!lv) return { success: false, message: 'Không tìm thấy đơn nghỉ.' };

    var trangThai = normalizeStr_(lv.TrangThai);
    if (trangThai === TRANG_THAI.DA_HUY || trangThai === TRANG_THAI.TU_CHOI) {
      return { success: false, message: 'Đơn đã bị hủy/từ chối, không thể duyệt.' };
    }
    if (trangThai === TRANG_THAI.DA_DUYET) {
      return { success: false, message: 'Đơn này đã được duyệt rồi.' };
    }

    var ngayNghi = normalizeDate_(lv.NgayNghi);
    var phongBan = normalizeStr_(lv.PhongBan);
    var caNghi = normalizeStr_(lv.CaNghi);
    var chanKhoa = checkKyKhoa_('CONG', ngayNghi); if (chanKhoa) return chanKhoa; // V5 P4
    var canhBao = checkMinimumStaffWarning(ngayNghi, phongBan, caNghi, 0);

    var update = {
      TrangThai: TRANG_THAI.DA_DUYET,
      VuotSlot: 'TRUE',
      NguoiDuyet: normalizeStr_(mgr.UserID),
      ThoiGianDuyet: nowStr_()
    };
    var tinhCong = normalizeStr_(data.tinhCong);
    if (DS_TINH_CONG.indexOf(tinhCong) >= 0) update.TinhCong = tinhCong;
    if (normalizeStr_(data.ghiChu)) update.GhiChu = appendGhiChu_(lv.GhiChu, normalizeStr_(data.ghiChu));

    updateRowById(TEN_SHEET.LICH_NGHI, 'LeaveID', lv.LeaveID, update);
    writeLeaveHistory({
      leaveID: normalizeStr_(lv.LeaveID), userID: normalizeStr_(mgr.UserID), hoTen: normalizeStr_(mgr.HoTen),
      hanhDong: 'Duyệt vượt slot', trangThaiTruoc: trangThai, trangThaiSau: TRANG_THAI.DA_DUYET,
      ghiChu: normalizeStr_(data.ghiChu)
    });

    return { success: true, message: 'Đã duyệt VƯỢT SLOT. Dashboard sẽ hiển thị cảnh báo.', warning: canhBao };
  } finally {
    lock.releaseLock();
  }
}

// ================== PM: TẠO ĐƠN THAY NHÂN VIÊN ==================

/**
 * PM tạo đơn nghỉ thay nhân viên. Bỏ qua check số ngày báo trước.
 * data = { managerUserID, targetUserID, ngayNghi, caNghi, loaiNghi, lyDo,
 *          tinhCong, trangThaiBanDau, allowOverSlot, ghiChu }
 */
function createLeaveForEmployee(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkPermission(data.managerUserID, 'DuocDuyetNghi');
    if (!mgr) return { success: false, message: 'Bạn không có quyền tạo đơn thay nhân viên.' };

    var target = checkUserActive(data.targetUserID);
    if (!target) return { success: false, message: 'Nhân viên không tồn tại hoặc đã bị khóa.' };

    var targetID = normalizeStr_(target.UserID);
    var hoTen = normalizeStr_(target.HoTen);
    var phongBan = normalizeStr_(target.PhongBan);
    var ngayNghi = normalizeDate_(data.ngayNghi);
    var caNghi = normalizeStr_(data.caNghi);
    var loaiNghi = normalizeStr_(data.loaiNghi);
    var lyDo = normalizeStr_(data.lyDo);

    if (!isValidDateStr_(ngayNghi)) return { success: false, message: 'Ngày nghỉ không hợp lệ.' };
    var chanKhoa = checkKyKhoa_('CONG', ngayNghi); if (chanKhoa) return chanKhoa; // V5 P4
    if (CA_HOP_LE.indexOf(caNghi) < 0) return { success: false, message: 'Ca nghỉ không hợp lệ.' };
    if (DS_LOAI_NGHI.indexOf(loaiNghi) < 0) return { success: false, message: 'Loại nghỉ không hợp lệ.' };
    if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do nghỉ.' };

    var trangThaiBanDau = normalizeStr_(data.trangThaiBanDau);
    if (trangThaiBanDau !== TRANG_THAI.CHO_DUYET && trangThaiBanDau !== TRANG_THAI.DA_DUYET) {
      trangThaiBanDau = TRANG_THAI.CHO_DUYET;
    }

    var tinhCong = normalizeStr_(data.tinhCong);
    if (DS_TINH_CONG.indexOf(tinhCong) < 0) {
      tinhCong = GOI_Y_TINH_CONG[loaiNghi] || 'Chờ quyết định';
    }

    // Kiểm tra trùng đơn
    var trung = checkDuplicateLeave(targetID, ngayNghi, caNghi);
    if (trung) {
      return {
        success: false,
        message: hoTen + ' đã có đơn nghỉ ' + normalizeStr_(trung.CaNghi) + ' ngày ' + ngayNghi +
          ' (trạng thái: ' + normalizeStr_(trung.TrangThai) + ').'
      };
    }

    // Kiểm tra khóa ngày (PM vẫn tôn trọng ngày khóa)
    var khoa = checkDateLocked(ngayNghi, phongBan, caNghi);
    if (khoa) {
      var lyDoKhoa = normalizeStr_(khoa.LyDoKhoa);
      return { success: false, message: 'Ngày này tạm khóa đăng ký nghỉ.' + (lyDoKhoa ? ' Lý do: ' + lyDoKhoa : '') };
    }

    // PM tạo thay: KHÔNG check số ngày báo trước, chỉ chặn ngày đã qua
    if (dateDiffDays_(todayStr_(), ngayNghi) < 0) {
      return { success: false, message: 'Ngày nghỉ đã qua, không thể tạo đơn.' };
    }

    // Kiểm tra slot
    var slot = checkSlotAvailable(ngayNghi, phongBan, caNghi, null);
    var vuotSlot = false;

    if (!slot.available) {
      if (data.allowOverSlot !== true) {
        return {
          success: false,
          message: 'Ca này đã đủ số người nghỉ. Tích "Cho phép vượt slot" nếu vẫn muốn tạo.',
          data: { hetSlot: true, chiTietSlot: slot.chiTiet }
        };
      }
      // Hết slot nhưng được phép vượt: nếu tạo thẳng Đã duyệt thì đánh dấu VuotSlot
      if (trangThaiBanDau === TRANG_THAI.DA_DUYET) vuotSlot = true;
    }

    var canhBao = checkMinimumStaffWarning(ngayNghi, phongBan, caNghi, 1);
    var thoiGian = nowStr_();
    var leaveID = generateLeaveID();

    appendRow(TEN_SHEET.LICH_NGHI, {
      LeaveID: leaveID,
      UserID: targetID,
      HoTen: hoTen,
      PhongBan: phongBan,
      NgayNghi: ngayNghi,
      CaNghi: caNghi,
      LoaiNghi: loaiNghi,
      LyDo: lyDo,
      TinhCong: tinhCong,
      TrangThai: trangThaiBanDau,
      LaYeuCauDacBiet: 'FALSE',
      VuotSlot: vuotSlot ? 'TRUE' : 'FALSE',
      ThoiGianDangKy: thoiGian,
      NguoiTao: normalizeStr_(mgr.UserID),
      TaoThayNhanVien: 'TRUE',
      NguoiDuyet: trangThaiBanDau === TRANG_THAI.DA_DUYET ? normalizeStr_(mgr.UserID) : '',
      ThoiGianDuyet: trangThaiBanDau === TRANG_THAI.DA_DUYET ? thoiGian : '',
      GhiChu: normalizeStr_(data.ghiChu)
    });
    writeLeaveHistory({
      leaveID: leaveID, userID: normalizeStr_(mgr.UserID), hoTen: normalizeStr_(mgr.HoTen),
      hanhDong: 'Tạo đơn thay nhân viên (' + hoTen + ')',
      trangThaiTruoc: '', trangThaiSau: trangThaiBanDau,
      ghiChu: ngayNghi + ' / ' + caNghi + (vuotSlot ? ' (vượt slot)' : '')
    });

    return {
      success: true,
      message: 'Đã tạo đơn nghỉ cho ' + hoTen + ' (' + trangThaiBanDau + ')' + (vuotSlot ? ' - VƯỢT SLOT.' : '.'),
      data: { leaveID: leaveID, trangThai: trangThaiBanDau, vuotSlot: vuotSlot },
      warning: canhBao
    };
  } finally {
    lock.releaseLock();
  }
}

// ================== PM: DASHBOARD ==================

function getLeaveDashboard(userID) {
  var u = checkPermission(userID, 'DuocXemDashboard');
  if (!u) return { success: false, message: 'Bạn không có quyền xem dashboard.' };

  var homNay = todayStr_();
  var ngayMai = addDaysStr_(homNay, 1);

  // Tuần hiện tại: Thứ 2 -> Chủ nhật
  var d = parseDateStr_(homNay);
  var thu = d.getDay(); // 0 = CN
  var luiVeThu2 = (thu === 0) ? 6 : (thu - 1);
  var dauTuan = addDaysStr_(homNay, -luiVeThu2);
  var cuoiTuan = addDaysStr_(dauTuan, 6);

  var allLeaves = getSheetData(TEN_SHEET.LICH_NGHI).map(buildLeavePayload_);

  // Danh sách phòng ban từ USERS active
  var pbSet = {};
  getSheetData(TEN_SHEET.USERS).forEach(function (us) {
    if (isActive_(us.TrangThai)) pbSet[normalizeStr_(us.PhongBan)] = true;
  });
  var phongBans = Object.keys(pbSet).filter(function (p) { return p; }).sort();

  function layDanhSach(tuNgay, denNgay) {
    return allLeaves.filter(function (lv) {
      return lv.ngayNghi >= tuNgay && lv.ngayNghi <= denNgay &&
        TRANG_THAI_CHIEM_SLOT.indexOf(lv.trangThai) >= 0;
    }).sort(function (a, b) {
      if (a.ngayNghi !== b.ngayNghi) return a.ngayNghi < b.ngayNghi ? -1 : 1;
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return 0;
    });
  }

  var dsHomNay = layDanhSach(homNay, homNay);
  var dsNgayMai = layDanhSach(ngayMai, ngayMai);
  var dsTuanNay = layDanhSach(dauTuan, cuoiTuan);

  // Thống kê các đơn từ hôm nay trở đi
  var thongKe = { tongHomNay: dsHomNay.length, tongNgayMai: dsNgayMai.length, choDuyet: 0, daDuyet: 0, tuChoi: 0, yeuCauDacBiet: 0 };
  allLeaves.forEach(function (lv) {
    if (lv.ngayNghi < homNay) return;
    if (lv.trangThai === TRANG_THAI.CHO_DUYET) thongKe.choDuyet++;
    else if (lv.trangThai === TRANG_THAI.DA_DUYET) thongKe.daDuyet++;
    else if (lv.trangThai === TRANG_THAI.TU_CHOI) thongKe.tuChoi++;
    else if (lv.trangThai === TRANG_THAI.YEU_CAU_DAC_BIET) thongKe.yeuCauDacBiet++;
  });

  // Số người nghỉ theo phòng ban (hôm nay)
  var nghiTheoPhongBan = {};
  phongBans.forEach(function (pb) { nghiTheoPhongBan[pb] = 0; });
  dsHomNay.forEach(function (lv) {
    if (nghiTheoPhongBan[lv.phongBan] === undefined) nghiTheoPhongBan[lv.phongBan] = 0;
    nghiTheoPhongBan[lv.phongBan]++;
  });

  // Tình trạng slot hôm nay + ngày mai theo phòng ban / ca
  var slotInfo = [];
  var canhBao = [];
  [homNay, ngayMai].forEach(function (ngay) {
    phongBans.forEach(function (pb) {
      ['SANG', 'CHIEU'].forEach(function (ca) {
        var gioiHan = getSlotLimit(ngay, pb, ca);
        if (gioiHan >= SLOT_KHONG_GIOI_HAN) return; // không cấu hình thì bỏ qua
        var daDung = countUsedSlot(ngay, pb, ca, null);
        var vuot = daDung > gioiHan;
        slotInfo.push({ ngay: ngay, phongBan: pb, ca: ca, daDung: daDung, gioiHan: gioiHan, conLai: Math.max(0, gioiHan - daDung), vuot: vuot });
        if (vuot) {
          canhBao.push('VƯỢT SLOT: ' + pb + ' ca ' + ca + ' ngày ' + ngay + ': ' + daDung + '/' + gioiHan);
        }
        // Cảnh báo nhân sự tối thiểu
        var toiThieu = getMinStaff_(pb, ca);
        if (toiThieu > 0) {
          var conLaiNguoi = countActiveUsers_(pb) - daDung;
          if (conLaiNguoi < toiThieu) {
            canhBao.push('NHÂN SỰ: ' + pb + ' ca ' + ca + ' ngày ' + ngay + ' chỉ còn ' + conLaiNguoi +
              ' người đi làm, thấp hơn mức tối thiểu ' + toiThieu + ' người.');
          }
        }
      });
    });
  });

  return {
    success: true,
    message: 'OK',
    data: {
      homNay: { ngay: homNay, danhSach: dsHomNay },
      ngayMai: { ngay: ngayMai, danhSach: dsNgayMai },
      tuanNay: { tuNgay: dauTuan, denNgay: cuoiTuan, danhSach: dsTuanNay },
      thongKe: thongKe,
      nghiTheoPhongBan: nghiTheoPhongBan,
      slotInfo: slotInfo,
      canhBao: canhBao,
      phongBans: phongBans
    }
  };
}

// ================== PM: DASHBOARD THÁNG ==================

/**
 * Dashboard lịch nghỉ theo tháng cho PM/quản lý.
 * filters = { phongBan, trangThai } (rỗng = tất cả)
 *
 * Quy ước:
 * - Danh sách theo ngày: nếu chọn 1 trạng thái thì chỉ hiện trạng thái đó,
 *   nếu "Tất cả" thì hiện mọi đơn trong tháng.
 * - Thống kê lượt nghỉ / phòng ban / nhân viên: chỉ tính các đơn chiếm slot
 *   (Chờ duyệt / Đã duyệt / Yêu cầu đặc biệt) — Từ chối / Đã hủy không tính lượt.
 * - Quy đổi số ngày nghỉ: SANG = 0.5, CHIEU = 0.5, FULL = 1.
 */
function getMonthlyLeaveDashboard(userID, month, year, filters) {
  var u = checkPermission(userID, 'DuocXemDashboard');
  if (!u) return { success: false, message: 'Bạn không có quyền xem dashboard.' };

  month = Number(month);
  year = Number(year);
  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000 || year > 2100) {
    return { success: false, message: 'Tháng/năm không hợp lệ.' };
  }

  var mm = ('0' + month).slice(-2);
  var tuNgay = year + '-' + mm + '-01';
  var soNgayTrongThang = new Date(year, month, 0).getDate();
  var denNgay = year + '-' + mm + '-' + ('0' + soNgayTrongThang).slice(-2);

  var fPhongBan = normalizeStr_((filters || {}).phongBan);
  var fTrangThai = normalizeStr_((filters || {}).trangThai);

  // Toàn bộ đơn trong tháng (áp lọc phòng ban nếu có)
  var leavesThang = getSheetData(TEN_SHEET.LICH_NGHI)
    .map(buildLeavePayload_)
    .filter(function (lv) {
      if (lv.ngayNghi < tuNgay || lv.ngayNghi > denNgay) return false;
      if (fPhongBan && lv.phongBan !== fPhongBan) return false;
      return true;
    });

  // ----- 1. Danh sách theo ngày (áp thêm lọc trạng thái) -----
  var hienThi = leavesThang.filter(function (lv) {
    if (fTrangThai) return lv.trangThai === fTrangThai;
    return true;
  });
  hienThi.sort(function (a, b) {
    if (a.ngayNghi !== b.ngayNghi) return a.ngayNghi < b.ngayNghi ? -1 : 1;
    if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
    return a.thoiGianDangKy < b.thoiGianDangKy ? -1 : 1;
  });

  var theoNgayMap = {};
  hienThi.forEach(function (lv) {
    if (!theoNgayMap[lv.ngayNghi]) theoNgayMap[lv.ngayNghi] = [];
    theoNgayMap[lv.ngayNghi].push(lv);
  });
  // Chỉ trả các ngày có đơn (ngày trống bỏ qua)
  var danhSachTheoNgay = Object.keys(theoNgayMap).sort().map(function (ngay) {
    return { ngay: ngay, danhSach: theoNgayMap[ngay] };
  });

  // ----- 2. Thống kê trạng thái (toàn bộ đơn trong tháng, không áp lọc trạng thái) -----
  var thongKeTrangThai = { tongLuotNghi: 0, choDuyet: 0, daDuyet: 0, yeuCauDacBiet: 0, tuChoi: 0, daHuy: 0 };
  leavesThang.forEach(function (lv) {
    if (lv.trangThai === TRANG_THAI.CHO_DUYET) thongKeTrangThai.choDuyet++;
    else if (lv.trangThai === TRANG_THAI.DA_DUYET) thongKeTrangThai.daDuyet++;
    else if (lv.trangThai === TRANG_THAI.YEU_CAU_DAC_BIET) thongKeTrangThai.yeuCauDacBiet++;
    else if (lv.trangThai === TRANG_THAI.TU_CHOI) thongKeTrangThai.tuChoi++;
    else if (lv.trangThai === TRANG_THAI.DA_HUY) thongKeTrangThai.daHuy++;
    if (isActiveStatus_(lv.trangThai)) thongKeTrangThai.tongLuotNghi++;
  });

  // ----- 3+4. Thống kê phòng ban & nhân viên (chỉ đơn chiếm slot) -----
  var thongKePhongBan = {};
  var nvMap = {};
  leavesThang.forEach(function (lv) {
    if (!isActiveStatus_(lv.trangThai)) return;
    thongKePhongBan[lv.phongBan] = (thongKePhongBan[lv.phongBan] || 0) + 1;
    if (!nvMap[lv.userID]) {
      nvMap[lv.userID] = { userID: lv.userID, hoTen: lv.hoTen, phongBan: lv.phongBan, soLuot: 0, soNgayQuyDoi: 0 };
    }
    nvMap[lv.userID].soLuot++;
    nvMap[lv.userID].soNgayQuyDoi += (lv.caNghi === 'FULL') ? 1 : 0.5;
  });
  var thongKeNhanVien = Object.keys(nvMap).map(function (k) { return nvMap[k]; });
  thongKeNhanVien.sort(function (a, b) {
    if (a.soNgayQuyDoi !== b.soNgayQuyDoi) return b.soNgayQuyDoi - a.soNgayQuyDoi;
    return b.soLuot - a.soLuot;
  });

  // ----- 5. Cảnh báo vượt slot / dưới nhân sự tối thiểu trong tháng -----
  // Nạp cấu hình 1 lần để tra nhanh (tránh đọc sheet lặp trong vòng lặp 31 ngày)
  var slotRieng = {};
  getSheetData(TEN_SHEET.CAU_HINH_SLOT).forEach(function (r) {
    var n = Number(r.SoLuongToiDa);
    if (!isNaN(n)) {
      slotRieng[normalizeDate_(r.Ngay) + '|' + normalizeStr_(r.PhongBan) + '|' + normalizeStr_(r.CaNghi)] = n;
    }
  });
  var slotMacDinh = {};
  getSheetData(TEN_SHEET.CAU_HINH_MAC_DINH).forEach(function (r) {
    var n = Number(r.SoLuongToiDa);
    if (isActive_(r.TrangThai) && !isNaN(n)) {
      slotMacDinh[normalizeStr_(r.PhongBan) + '|' + normalizeStr_(r.CaNghi)] = n;
    }
  });
  var minStaff = {};
  getSheetData(TEN_SHEET.NHAN_SU_TOI_THIEU).forEach(function (r) {
    var n = Number(r.SoNguoiToiThieu);
    if (isActive_(r.TrangThai) && !isNaN(n)) {
      minStaff[normalizeStr_(r.PhongBan) + '|' + normalizeStr_(r.CaNghi)] = n;
    }
  });
  var soNhanSu = {};
  getSheetData(TEN_SHEET.USERS).forEach(function (us) {
    if (isActive_(us.TrangThai)) {
      var pb = normalizeStr_(us.PhongBan);
      soNhanSu[pb] = (soNhanSu[pb] || 0) + 1;
    }
  });

  // Đếm slot đã dùng theo ngày|phòng ban|ca nửa ngày (FULL tính cả 2 ca)
  var usage = {};
  leavesThang.forEach(function (lv) {
    if (!isActiveStatus_(lv.trangThai)) return;
    expandCa_(lv.caNghi).forEach(function (ca) {
      var k = lv.ngayNghi + '|' + lv.phongBan + '|' + ca;
      usage[k] = (usage[k] || 0) + 1;
    });
  });

  var canhBao = [];
  Object.keys(usage).sort().forEach(function (k) {
    var p = k.split('|');
    var ngay = p[0], pb = p[1], ca = p[2];
    var daDung = usage[k];
    var ngayVN = ngay.split('-').reverse().join('/');

    var gioiHan = slotRieng[k];
    if (gioiHan === undefined) gioiHan = slotMacDinh[pb + '|' + ca];
    if (gioiHan !== undefined && daDung > gioiHan) {
      canhBao.push(ngayVN + ' - ' + pb + ' ca ' + ca + ': ' + daDung + '/' + gioiHan + ' người nghỉ, vượt slot.');
    }

    var toiThieu = minStaff[pb + '|' + ca];
    if (toiThieu > 0) {
      var conLai = (soNhanSu[pb] || 0) - daDung;
      if (conLai < toiThieu) {
        canhBao.push(ngayVN + ' - ' + pb + ' ca ' + ca + ': chỉ còn ' + conLai +
          ' người đi làm, thấp hơn mức tối thiểu ' + toiThieu + '.');
      }
    }
  });

  return {
    success: true,
    message: 'OK',
    data: {
      month: month,
      year: year,
      tuNgay: tuNgay,
      denNgay: denNgay,
      danhSachTheoNgay: danhSachTheoNgay,
      thongKeTrangThai: thongKeTrangThai,
      thongKePhongBan: thongKePhongBan,
      thongKeNhanVien: thongKeNhanVien,
      canhBao: canhBao
    }
  };
}

// ================== CẤU HÌNH: SLOT THEO NGÀY ==================

function coQuyenXemCauHinh_(userID) {
  var u = checkUserActive(userID);
  if (!u) return null;
  if (isTrue_(u.DuocDuyetNghi) || isTrue_(u.DuocSuaCauHinh) || isTrue_(u.DuocXemDashboard)) return u;
  return null;
}

function getSlotConfig(userID, filters) {
  var u = coQuyenXemCauHinh_(userID);
  if (!u) return { success: false, message: 'Bạn không có quyền xem cấu hình slot.' };

  var tuNgay = normalizeDate_((filters || {}).tuNgay);
  var list = getSheetData(TEN_SHEET.CAU_HINH_SLOT).map(function (r) {
    return {
      ngay: normalizeDate_(r.Ngay),
      phongBan: normalizeStr_(r.PhongBan),
      caNghi: normalizeStr_(r.CaNghi),
      soLuongToiDa: Number(r.SoLuongToiDa) || 0,
      ghiChu: normalizeStr_(r.GhiChu),
      capNhatLanCuoi: normalizeStr_(r.CapNhatLanCuoi),
      nguoiCapNhat: normalizeStr_(r.NguoiCapNhat)
    };
  }).filter(function (r) {
    if (tuNgay && r.ngay < tuNgay) return false;
    return true;
  }).sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });

  return { success: true, message: 'OK', data: list };
}

/**
 * Thêm/sửa slot riêng cho 1 ngày (upsert theo Ngay + PhongBan + CaNghi).
 * data = { userID, ngay, phongBan, caNghi, soLuongToiDa, ghiChu }
 */
function updateSlotConfig(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var u = checkPermission(data.userID, 'DuocSuaCauHinh');
    if (!u) return { success: false, message: 'Bạn không có quyền sửa cấu hình slot.' };

    var ngay = normalizeDate_(data.ngay);
    var phongBan = normalizeStr_(data.phongBan);
    var caNghi = normalizeStr_(data.caNghi);
    var soLuong = Number(data.soLuongToiDa);

    if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };
    if (!phongBan) return { success: false, message: 'Vui lòng chọn phòng ban.' };
    if (caNghi !== 'SANG' && caNghi !== 'CHIEU') return { success: false, message: 'Ca chỉ nhận SANG hoặc CHIEU (FULL tự chiếm cả 2 ca).' };
    if (isNaN(soLuong) || soLuong < 0) return { success: false, message: 'Số lượng tối đa không hợp lệ.' };

    // Upsert: tìm dòng trùng ngày + phòng ban + ca
    var sh = getSheet_(TEN_SHEET.CAU_HINH_SLOT);
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var cNgay = headers.indexOf('Ngay'), cPB = headers.indexOf('PhongBan'), cCa = headers.indexOf('CaNghi');
    var cSL = headers.indexOf('SoLuongToiDa'), cGC = headers.indexOf('GhiChu');
    var cCap = headers.indexOf('CapNhatLanCuoi'), cNg = headers.indexOf('NguoiCapNhat');

    for (var i = 1; i < values.length; i++) {
      if (normalizeDate_(values[i][cNgay]) === ngay &&
          normalizeStr_(values[i][cPB]) === phongBan &&
          normalizeStr_(values[i][cCa]) === caNghi) {
        sh.getRange(i + 1, cSL + 1).setValue(String(soLuong));
        if (cGC >= 0) sh.getRange(i + 1, cGC + 1).setValue(normalizeStr_(data.ghiChu));
        if (cCap >= 0) sh.getRange(i + 1, cCap + 1).setValue(nowStr_());
        if (cNg >= 0) sh.getRange(i + 1, cNg + 1).setValue(normalizeStr_(u.UserID));
        invalidateSheetCache_(TEN_SHEET.CAU_HINH_SLOT);
        return { success: true, message: 'Đã cập nhật slot ' + phongBan + ' ca ' + caNghi + ' ngày ' + ngay + ' = ' + soLuong + '.' };
      }
    }

    appendRow(TEN_SHEET.CAU_HINH_SLOT, {
      Ngay: ngay, PhongBan: phongBan, CaNghi: caNghi,
      SoLuongToiDa: String(soLuong), GhiChu: normalizeStr_(data.ghiChu),
      CapNhatLanCuoi: nowStr_(), NguoiCapNhat: normalizeStr_(u.UserID)
    });
    return { success: true, message: 'Đã thêm slot riêng ' + phongBan + ' ca ' + caNghi + ' ngày ' + ngay + ' = ' + soLuong + '.' };
  } finally {
    lock.releaseLock();
  }
}

// ================== CẤU HÌNH: SLOT MẶC ĐỊNH ==================

function getDefaultSlotConfig(userID) {
  var u = coQuyenXemCauHinh_(userID);
  if (!u) return { success: false, message: 'Bạn không có quyền xem cấu hình.' };

  var list = getSheetData(TEN_SHEET.CAU_HINH_MAC_DINH).map(function (r) {
    return {
      phongBan: normalizeStr_(r.PhongBan),
      caNghi: normalizeStr_(r.CaNghi),
      soLuongToiDa: Number(r.SoLuongToiDa) || 0,
      trangThai: normalizeStr_(r.TrangThai)
    };
  });
  return { success: true, message: 'OK', data: list };
}

/**
 * data = { userID, phongBan, caNghi, soLuongToiDa }
 */
function updateDefaultSlotConfig(data) {
  var u = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!u) return { success: false, message: 'Bạn không có quyền sửa cấu hình.' };

  var phongBan = normalizeStr_(data.phongBan);
  var caNghi = normalizeStr_(data.caNghi);
  var soLuong = Number(data.soLuongToiDa);
  if (!phongBan || (caNghi !== 'SANG' && caNghi !== 'CHIEU')) return { success: false, message: 'Phòng ban / ca không hợp lệ.' };
  if (isNaN(soLuong) || soLuong < 0) return { success: false, message: 'Số lượng không hợp lệ.' };

  var sh = getSheet_(TEN_SHEET.CAU_HINH_MAC_DINH);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var cPB = headers.indexOf('PhongBan'), cCa = headers.indexOf('CaNghi'), cSL = headers.indexOf('SoLuongToiDa');

  for (var i = 1; i < values.length; i++) {
    if (normalizeStr_(values[i][cPB]) === phongBan && normalizeStr_(values[i][cCa]) === caNghi) {
      sh.getRange(i + 1, cSL + 1).setValue(String(soLuong));
      invalidateSheetCache_(TEN_SHEET.CAU_HINH_MAC_DINH);
      return { success: true, message: 'Đã cập nhật slot mặc định ' + phongBan + ' ca ' + caNghi + ' = ' + soLuong + '.' };
    }
  }
  appendRow(TEN_SHEET.CAU_HINH_MAC_DINH, {
    PhongBan: phongBan, CaNghi: caNghi, SoLuongToiDa: String(soLuong), TrangThai: 'Active'
  });
  return { success: true, message: 'Đã thêm slot mặc định ' + phongBan + ' ca ' + caNghi + ' = ' + soLuong + '.' };
}

// ================== CẤU HÌNH: KHÓA NGÀY ==================

/**
 * data = { userID, ngay, phongBan (rỗng = toàn xưởng), caNghi (rỗng = cả ngày), lyDoKhoa }
 */
function lockDate(data) {
  var u = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!u) return { success: false, message: 'Bạn không có quyền khóa ngày.' };

  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };

  var phongBan = normalizeStr_(data.phongBan); // rỗng = toàn xưởng
  var caNghi = normalizeStr_(data.caNghi);     // rỗng = cả ngày

  appendRow(TEN_SHEET.NGAY_KHOA, {
    Ngay: ngay,
    PhongBan: phongBan,
    CaNghi: caNghi,
    LyDoKhoa: normalizeStr_(data.lyDoKhoa),
    TrangThai: 'Active',
    NguoiKhoa: normalizeStr_(u.UserID),
    ThoiGianKhoa: nowStr_()
  });

  return {
    success: true,
    message: 'Đã khóa ' + (phongBan || 'toàn xưởng') + ' ' + (caNghi ? 'ca ' + caNghi : 'cả ngày') + ' ngày ' + ngay + '.'
  };
}

/**
 * Mở khóa: đặt TrangThai = Inactive cho các dòng khớp.
 * data = { userID, ngay, phongBan, caNghi }
 */
function unlockDate(data) {
  var u = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!u) return { success: false, message: 'Bạn không có quyền mở khóa.' };

  var ngay = normalizeDate_(data.ngay);
  var phongBan = normalizeStr_(data.phongBan);
  var caNghi = normalizeStr_(data.caNghi);

  var sh = getSheet_(TEN_SHEET.NGAY_KHOA);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var cNgay = headers.indexOf('Ngay'), cPB = headers.indexOf('PhongBan'),
      cCa = headers.indexOf('CaNghi'), cTT = headers.indexOf('TrangThai');

  var soDong = 0;
  for (var i = 1; i < values.length; i++) {
    if (!isActive_(values[i][cTT])) continue;
    if (normalizeDate_(values[i][cNgay]) !== ngay) continue;
    if (normalizeStr_(values[i][cPB]) !== phongBan) continue;
    if (normalizeStr_(values[i][cCa]) !== caNghi) continue;
    sh.getRange(i + 1, cTT + 1).setValue('Inactive');
    soDong++;
  }

  if (soDong > 0) invalidateSheetCache_(TEN_SHEET.NGAY_KHOA);
  if (soDong === 0) return { success: false, message: 'Không tìm thấy khóa đang hiệu lực khớp thông tin.' };
  return { success: true, message: 'Đã mở khóa ' + (phongBan || 'toàn xưởng') + ' ' + (caNghi ? 'ca ' + caNghi : 'cả ngày') + ' ngày ' + ngay + '.' };
}

function getLockedDates(userID) {
  var u = coQuyenXemCauHinh_(userID);
  if (!u) return { success: false, message: 'Bạn không có quyền xem danh sách khóa.' };

  var list = getSheetData(TEN_SHEET.NGAY_KHOA)
    .filter(function (r) { return isActive_(r.TrangThai); })
    .map(function (r) {
      return {
        ngay: normalizeDate_(r.Ngay),
        phongBan: normalizeStr_(r.PhongBan),
        caNghi: normalizeStr_(r.CaNghi),
        lyDoKhoa: normalizeStr_(r.LyDoKhoa),
        nguoiKhoa: normalizeStr_(r.NguoiKhoa),
        thoiGianKhoa: normalizeStr_(r.ThoiGianKhoa)
      };
    })
    .sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });

  return { success: true, message: 'OK', data: list };
}

// ================== CẤU HÌNH: CHUNG & NHÂN SỰ TỐI THIỂU ==================

function getGeneralConfig(userID) {
  var u = coQuyenXemCauHinh_(userID);
  if (!u) return { success: false, message: 'Bạn không có quyền xem cấu hình chung.' };

  var list = getSheetData(TEN_SHEET.CAU_HINH_CHUNG).map(function (r) {
    return { key: normalizeStr_(r.Key), value: normalizeStr_(r.Value), ghiChu: normalizeStr_(r.GhiChu) };
  });
  return { success: true, message: 'OK', data: list };
}

/**
 * data = { userID, key, value }
 */
function updateGeneralConfig(data) {
  var u = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!u) return { success: false, message: 'Bạn không có quyền sửa cấu hình chung.' };

  var key = normalizeStr_(data.key);
  var value = normalizeStr_(data.value);
  if (!key) return { success: false, message: 'Thiếu Key.' };

  var found = updateRowById(TEN_SHEET.CAU_HINH_CHUNG, 'Key', key, { Value: value });
  if (!found) {
    appendRow(TEN_SHEET.CAU_HINH_CHUNG, { Key: key, Value: value, GhiChu: '' });
  }
  return { success: true, message: 'Đã cập nhật ' + key + ' = ' + value + '.' };
}

function getMinimumStaffConfig(userID) {
  var u = coQuyenXemCauHinh_(userID);
  if (!u) return { success: false, message: 'Bạn không có quyền xem cấu hình nhân sự tối thiểu.' };

  var list = getSheetData(TEN_SHEET.NHAN_SU_TOI_THIEU).map(function (r) {
    return {
      phongBan: normalizeStr_(r.PhongBan),
      caNghi: normalizeStr_(r.CaNghi),
      soNguoiToiThieu: Number(r.SoNguoiToiThieu) || 0,
      trangThai: normalizeStr_(r.TrangThai)
    };
  });
  return { success: true, message: 'OK', data: list };
}

/**
 * data = { userID, phongBan, caNghi, soNguoiToiThieu }
 */
function updateMinimumStaffConfig(data) {
  var u = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!u) return { success: false, message: 'Bạn không có quyền sửa cấu hình.' };

  var phongBan = normalizeStr_(data.phongBan);
  var caNghi = normalizeStr_(data.caNghi);
  var soNguoi = Number(data.soNguoiToiThieu);
  if (!phongBan || (caNghi !== 'SANG' && caNghi !== 'CHIEU')) return { success: false, message: 'Phòng ban / ca không hợp lệ.' };
  if (isNaN(soNguoi) || soNguoi < 0) return { success: false, message: 'Số người không hợp lệ.' };

  var sh = getSheet_(TEN_SHEET.NHAN_SU_TOI_THIEU);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var cPB = headers.indexOf('PhongBan'), cCa = headers.indexOf('CaNghi'), cSN = headers.indexOf('SoNguoiToiThieu');

  for (var i = 1; i < values.length; i++) {
    if (normalizeStr_(values[i][cPB]) === phongBan && normalizeStr_(values[i][cCa]) === caNghi) {
      sh.getRange(i + 1, cSN + 1).setValue(String(soNguoi));
      invalidateSheetCache_(TEN_SHEET.NHAN_SU_TOI_THIEU);
      return { success: true, message: 'Đã cập nhật nhân sự tối thiểu ' + phongBan + ' ca ' + caNghi + ' = ' + soNguoi + '.' };
    }
  }
  appendRow(TEN_SHEET.NHAN_SU_TOI_THIEU, {
    PhongBan: phongBan, CaNghi: caNghi, SoNguoiToiThieu: String(soNguoi), TrangThai: 'Active'
  });
  return { success: true, message: 'Đã thêm nhân sự tối thiểu ' + phongBan + ' ca ' + caNghi + ' = ' + soNguoi + '.' };
}

/*******************************************************
 *******************************************************
 **            MODULE V3: NHÂN SỰ NHÀ MÌNH            **
 **  Toàn bộ code dưới đây là BỔ SUNG MỚI, không sửa  **
 **  bất kỳ hàm nào của app nghỉ phép đang chạy.      **
 *******************************************************
 *******************************************************/

// ================== V3: HẰNG SỐ ==================

var TT_TANG_CA = { CHO_DUYET: 'Chờ duyệt', DA_DUYET: 'Đã duyệt', TU_CHOI: 'Từ chối', DA_HUY: 'Đã hủy' };
var TT_TAM_UNG = { CHO_DUYET: 'Chờ duyệt', DA_DUYET: 'Đã duyệt', TU_CHOI: 'Từ chối', DA_CHI: 'Đã chi', DA_HUY: 'Đã hủy' };
var DS_LOAI_THUONG_PHAT = ['Thưởng', 'Phạt', 'Phụ cấp', 'Khấu trừ', 'Khác'];
var DS_HINH_THUC_LUONG = ['Theo giờ', 'Theo tháng', 'Khoán', 'Khác'];
var DS_TT_CHAM_CONG = ['Chưa hoàn tất', 'Hoàn tất', 'Quên chấm vào', 'Quên chấm ra', 'Quản lý chỉnh', 'Nghỉ'];

// Cấu hình chấm công mặc định (dùng khi sheet CAU_HINH_CHAM_CONG thiếu key)
var CC_MAC_DINH = {
  GioVaoSang: '07:30', GioRaSang: '11:30',
  GioVaoChieu: '13:30', GioRaChieu: '17:30',
  PhutChoPhepTre: '5', PhutChoPhepVeSom: '5',
  TinhTangCaSau: '17:30',
  GioNghiTruaBatDau: '11:30', GioNghiTruaKetThuc: '13:30',
  LamTronGioCong: '0.25',
  ChoPhepNhanVienChamCong: 'TRUE',
  YeuCauGhiChuKhiSuaCong: 'TRUE'
  // (V5.0-RC2: CheDoGPSKhanCap đã gỡ cùng lớp ngoại lệ GPS - GPS chỉ còn fail-closed đơn giản)
};

// ================== V3: HELPER THỜI GIAN & CẤU HÌNH ==================

/** 'HH:mm' -> số phút từ 0h. Trả null nếu không hợp lệ. */
function hhmmToMin_(s) {
  var m = normalizeStr_(s).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  var gio = Number(m[1]), phut = Number(m[2]);
  if (gio > 23 || phut > 59) return null;
  return gio * 60 + phut;
}

function nowHHMM_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'HH:mm');
}

/** Đọc cấu hình chấm công: mặc định + ghi đè bởi sheet CAU_HINH_CHAM_CONG. */
function getAttendanceConfigValues() {
  var map = {};
  for (var k in CC_MAC_DINH) map[k] = CC_MAC_DINH[k];
  getSheetDataSafe_(TEN_SHEET.CAU_HINH_CHAM_CONG).forEach(function (r) {
    var key = normalizeStr_(r.Key);
    if (key) map[key] = normalizeStr_(r.Value);
  });
  return map;
}

/** Làm tròn giờ công theo bước cấu hình (VD 0.25h). */
function roundWorkHours(hours, step) {
  step = Number(step);
  if (isNaN(step) || step <= 0) return Math.round(hours * 100) / 100;
  return Math.round((Math.round(hours / step) * step) * 100) / 100;
}

/** Số tiền: bỏ dấu chấm/phẩy phân cách nghìn. */
function parseMoney_(v) {
  var n = Number(String(v == null ? '' : v).replace(/[^\d\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/**
 * Tính toàn bộ chỉ số công từ giờ vào/ra + cấu hình.
 * gioRa có thể rỗng (mới chấm vào) -> chỉ tính đi trễ.
 * Trả về { soGioLam, diTre, soPhutTre, veSom, soPhutVeSom, tangCa, soGioTangCa, caLam }
 */
function calcAttendance_(gioVao, gioRa, cfg) {
  var kq = { soGioLam: 0, diTre: false, soPhutTre: 0, veSom: false, soPhutVeSom: 0, tangCa: false, soGioTangCa: 0, caLam: 'FULL' };
  var vao = hhmmToMin_(gioVao);
  if (vao === null) return kq;

  var vaoSang = hhmmToMin_(cfg.GioVaoSang), raSang = hhmmToMin_(cfg.GioRaSang);
  var vaoChieu = hhmmToMin_(cfg.GioVaoChieu), raChieu = hhmmToMin_(cfg.GioRaChieu);
  var truaBD = hhmmToMin_(cfg.GioNghiTruaBatDau), truaKT = hhmmToMin_(cfg.GioNghiTruaKetThuc);
  var otSau = hhmmToMin_(cfg.TinhTangCaSau);
  var phepTre = Number(cfg.PhutChoPhepTre) || 0;
  var phepSom = Number(cfg.PhutChoPhepVeSom) || 0;

  // Đi trễ: vào buổi sáng so mốc GioVaoSang, vào buổi chiều so mốc GioVaoChieu.
  // Số phút trễ = phần VƯỢT QUÁ phút cho phép (vào 07:36, cho phép 5' -> trễ 1 phút).
  var mocVao = (vao < vaoChieu) ? vaoSang : vaoChieu;
  kq.soPhutTre = Math.max(0, vao - mocVao - phepTre);
  kq.diTre = kq.soPhutTre > 0;

  var ra = hhmmToMin_(gioRa);
  if (ra === null) {
    // Mới chấm vào: tạm xác định ca theo giờ vào (trước giờ nghỉ trưa = SANG, sau = CHIEU)
    kq.caLam = (truaBD !== null && vao >= truaBD) ? 'CHIEU' : 'SANG';
    return kq;
  }

  if (ra < vao) return kq; // dữ liệu sai, không tính (giữ 0 để quản lý sửa tay)

  // Về sớm: ra trong buổi sáng so mốc GioRaSang, buổi chiều so mốc GioRaChieu
  var mocRa = (ra <= truaBD) ? raSang : raChieu;
  kq.soPhutVeSom = Math.max(0, mocRa - ra);
  kq.veSom = kq.soPhutVeSom > phepSom;

  // Tăng ca: sau giờ cấu hình
  if (otSau !== null && ra > otSau) {
    kq.soGioTangCa = roundWorkHours((ra - otSau) / 60, cfg.LamTronGioCong);
    kq.tangCa = kq.soGioTangCa > 0;
  }

  // Giờ làm = ra - vào - giờ nghỉ trưa (nếu làm xuyên trưa)
  var phutTrua = 0;
  if (truaBD !== null && truaKT !== null) {
    phutTrua = Math.max(0, Math.min(ra, truaKT) - Math.max(vao, truaBD));
  }
  kq.soGioLam = roundWorkHours(Math.max(0, ra - vao - phutTrua) / 60, cfg.LamTronGioCong);

  // Suy ra ca làm
  if (ra <= truaBD) kq.caLam = 'SANG';
  else if (vao >= truaKT) kq.caLam = 'CHIEU';
  else kq.caLam = 'FULL';

  return kq;
}

// Các wrapper theo tên API yêu cầu.
// V3.2: truyền thêm userID (+ ngay) để tính theo giờ chuẩn của phòng ban / lịch riêng.
function calculateWorkHours(gioVao, gioRa, userID, ngay) {
  if (userID) return calcAttendanceForUser_(userID, '', ngay || todayStr_(), gioVao, gioRa).soGioLam;
  return calcAttendance_(gioVao, gioRa, getAttendanceConfigValues()).soGioLam;
}
function calculateLateEarly(gioVao, gioRa, userID, ngay) {
  var k = userID
    ? calcAttendanceForUser_(userID, '', ngay || todayStr_(), gioVao, gioRa)
    : calcAttendance_(gioVao, gioRa, getAttendanceConfigValues());
  return { diTre: k.diTre, soPhutTre: k.soPhutTre, veSom: k.veSom, soPhutVeSom: k.soPhutVeSom };
}
function calculateOvertime(gioRa, userID, ngay) {
  var k = userID
    ? calcAttendanceForUser_(userID, '', ngay || todayStr_(), '07:30', gioRa)
    : calcAttendance_('07:30', gioRa, getAttendanceConfigValues());
  return { tangCa: k.tangCa, soGioTangCa: k.soGioTangCa };
}

// ================== V3.2: GIỜ LÀM THEO PHÒNG BAN ==================
// Thứ tự ưu tiên khi tính công:
//   1. LICH_LAM riêng theo nhân viên/ngày
//   2. CAU_HINH_CA_PHONG_BAN (giờ mặc định của phòng ban)
//   3. CAU_HINH_CHAM_CONG (giờ chung toàn xưởng)

/**
 * Gộp cấu hình giờ làm hiệu lực cho 1 phòng ban:
 * lấy giờ chung toàn xưởng rồi ghi đè bằng CAU_HINH_CA_PHONG_BAN (dòng Active).
 * Trả về object cùng cấu trúc key với getAttendanceConfigValues() + _nguon.
 */
function getEffectiveShiftCfg_(phongBan) {
  var cfg = getAttendanceConfigValues();
  var eff = {};
  for (var k in cfg) eff[k] = cfg[k];
  eff._nguon = 'TOAN_XUONG';
  phongBan = normalizeStr_(phongBan);
  if (!phongBan) return eff;

  getSheetDataSafe_(TEN_SHEET.CAU_HINH_CA_PHONG_BAN).forEach(function (r) {
    if (!isActive_(r.TrangThai)) return;
    if (normalizeStr_(r.PhongBan) !== phongBan) return;
    var ca = normalizeStr_(r.CaLam);
    var bd = normalizeStr_(r.GioBatDau), kt = normalizeStr_(r.GioKetThuc);

    if (ca === 'SANG') {
      if (hhmmToMin_(bd) !== null) eff.GioVaoSang = bd;
      if (hhmmToMin_(kt) !== null) eff.GioRaSang = kt;
    } else if (ca === 'CHIEU') {
      if (hhmmToMin_(bd) !== null) eff.GioVaoChieu = bd;
      if (hhmmToMin_(kt) !== null) eff.GioRaChieu = kt;
    } else if (ca === 'FULL') {
      var truaBD = normalizeStr_(r.GioNghiTruaBatDau), truaKT = normalizeStr_(r.GioNghiTruaKetThuc);
      if (hhmmToMin_(truaBD) !== null) eff.GioNghiTruaBatDau = truaBD;
      if (hhmmToMin_(truaKT) !== null) eff.GioNghiTruaKetThuc = truaKT;
    }
    // Phút cho phép trễ/sớm & mốc tăng ca: dòng nào có giá trị thì ghi đè
    if (normalizeStr_(r.PhutChoPhepTre) !== '' && !isNaN(Number(r.PhutChoPhepTre))) {
      eff.PhutChoPhepTre = normalizeStr_(r.PhutChoPhepTre);
    }
    if (normalizeStr_(r.PhutChoPhepVeSom) !== '' && !isNaN(Number(r.PhutChoPhepVeSom))) {
      eff.PhutChoPhepVeSom = normalizeStr_(r.PhutChoPhepVeSom);
    }
    if (hhmmToMin_(normalizeStr_(r.TinhTangCaSau)) !== null) {
      eff.TinhTangCaSau = normalizeStr_(r.TinhTangCaSau);
    }
    eff._nguon = 'PHONG_BAN';
  });
  return eff;
}

/** Tìm lịch làm riêng của 1 user trong 1 ngày (dòng đầu tiên khớp trong LICH_LAM). */
function findLichLam_(userID, ngay) {
  var rows = getSheetDataSafe_(TEN_SHEET.LICH_LAM);
  var id = normalizeStr_(userID);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].UserID) === id && normalizeDate_(rows[i].Ngay) === ngay) {
      return {
        lichLamID: normalizeStr_(rows[i].LichLamID),
        caLam: normalizeStr_(rows[i].CaLam),
        gioBatDau: normalizeStr_(rows[i].GioBatDau),
        gioKetThuc: normalizeStr_(rows[i].GioKetThuc),
        laNgayNghi: isTrue_(rows[i].LaNgayNghi)
      };
    }
  }
  return null;
}

/**
 * Lấy giờ làm CHUẨN của 1 nhân viên trong 1 ngày (đúng thứ tự ưu tiên 3 tầng).
 * phongBanBiet: truyền vào nếu đã biết (đỡ tra USERS), để trống sẽ tự tra.
 */
function getExpectedWorkSchedule(userID, ngay, phongBanBiet) {
  var phongBan = normalizeStr_(phongBanBiet);
  if (!phongBan) {
    var u = getUserById(userID);
    if (u) phongBan = normalizeStr_(u.PhongBan);
  }
  var cfg = getEffectiveShiftCfg_(phongBan);
  var lich = findLichLam_(userID, ngay);
  // Lịch riêng chỉ dùng khi có đủ giờ hợp lệ và không phải ngày nghỉ theo lịch
  if (lich && !lich.laNgayNghi && hhmmToMin_(lich.gioBatDau) !== null && hhmmToMin_(lich.gioKetThuc) !== null) {
    return { nguon: 'LICH_LAM', lichRieng: lich, cfg: cfg, phongBan: phongBan };
  }
  return { nguon: cfg._nguon, lichRieng: null, cfg: cfg, phongBan: phongBan };
}

/**
 * Tính công cho ca TÙY CHỈNH theo LICH_LAM:
 * mốc đi trễ = GioBatDau lịch riêng, mốc về sớm = GioKetThuc lịch riêng,
 * tăng ca = phần làm sau GioKetThuc, không tự đoán ca.
 */
function calcCustomShift_(gioVao, gioRa, sched) {
  var cfg = sched.cfg;
  var lich = sched.lichRieng;
  var kq = {
    soGioLam: 0, diTre: false, soPhutTre: 0, veSom: false, soPhutVeSom: 0,
    tangCa: false, soGioTangCa: 0, caLam: lich.caLam || 'FULL'
  };
  var vao = hhmmToMin_(gioVao);
  if (vao === null) return kq;

  var bd = hhmmToMin_(lich.gioBatDau), kt = hhmmToMin_(lich.gioKetThuc);
  var phepTre = Number(cfg.PhutChoPhepTre) || 0;
  var phepSom = Number(cfg.PhutChoPhepVeSom) || 0;

  kq.soPhutTre = Math.max(0, vao - bd - phepTre);
  kq.diTre = kq.soPhutTre > 0;

  var ra = hhmmToMin_(gioRa);
  if (ra === null || ra < vao) return kq;

  kq.soPhutVeSom = Math.max(0, kt - ra);
  kq.veSom = kq.soPhutVeSom > phepSom;

  if (ra > kt) {
    kq.soGioTangCa = roundWorkHours((ra - kt) / 60, cfg.LamTronGioCong);
    kq.tangCa = kq.soGioTangCa > 0;
  }

  // Trừ nghỉ trưa chỉ khi ca trong lịch riêng bao trùm khung nghỉ trưa
  var truaBD = hhmmToMin_(cfg.GioNghiTruaBatDau), truaKT = hhmmToMin_(cfg.GioNghiTruaKetThuc);
  var phutTrua = 0;
  if (truaBD !== null && truaKT !== null && bd < truaBD && kt > truaKT) {
    phutTrua = Math.max(0, Math.min(ra, truaKT) - Math.max(vao, truaBD));
  }
  kq.soGioLam = roundWorkHours(Math.max(0, ra - vao - phutTrua) / 60, cfg.LamTronGioCong);
  return kq;
}

/**
 * Tính công THEO NHÂN VIÊN: tự chọn đúng giờ chuẩn
 * (lịch riêng -> giờ phòng ban -> giờ chung toàn xưởng).
 * Mọi chỗ chấm công phải dùng hàm này, KHÔNG dùng calcAttendance_ với cfg chung.
 */
function calcAttendanceForUser_(userID, phongBan, ngay, gioVao, gioRa) {
  var sched = getExpectedWorkSchedule(userID, ngay, phongBan);
  if (sched.lichRieng) return calcCustomShift_(gioVao, gioRa, sched);
  return calcAttendance_(gioVao, gioRa, sched.cfg);
}

/** Xem cấu hình ca theo phòng ban (kèm cả dòng Inactive để bật lại được). */
function getDepartmentShiftConfig(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var p = buildUserPayload_(u);
  if (!p.duocQuanLyNhanSu && !p.duocSuaCong && !p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền xem cấu hình ca phòng ban.' };
  }
  var thuTuCa = { SANG: 1, CHIEU: 2, FULL: 3 };
  var list = getSheetDataSafe_(TEN_SHEET.CAU_HINH_CA_PHONG_BAN)
    .map(function (r) {
      return {
        phongBan: normalizeStr_(r.PhongBan),
        caLam: normalizeStr_(r.CaLam),
        gioBatDau: normalizeStr_(r.GioBatDau),
        gioKetThuc: normalizeStr_(r.GioKetThuc),
        gioNghiTruaBatDau: normalizeStr_(r.GioNghiTruaBatDau),
        gioNghiTruaKetThuc: normalizeStr_(r.GioNghiTruaKetThuc),
        phutChoPhepTre: normalizeStr_(r.PhutChoPhepTre),
        phutChoPhepVeSom: normalizeStr_(r.PhutChoPhepVeSom),
        tinhTangCaSau: normalizeStr_(r.TinhTangCaSau),
        trangThai: normalizeStr_(r.TrangThai),
        ghiChu: normalizeStr_(r.GhiChu)
      };
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return (thuTuCa[a.caLam] || 9) - (thuTuCa[b.caLam] || 9);
    });
  return { success: true, message: 'OK', data: list };
}

/**
 * Thêm/sửa cấu hình ca 1 phòng ban (upsert theo PhongBan + CaLam).
 * data = { userID, phongBan, caLam, gioBatDau, gioKetThuc, gioNghiTruaBatDau,
 *          gioNghiTruaKetThuc, phutChoPhepTre, phutChoPhepVeSom, tinhTangCaSau, trangThai, ghiChu }
 */
function updateDepartmentShiftConfig(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkHRPerm_(data.userID, 'duocQuanLyNhanSu');
    if (!mgr) return { success: false, message: 'Bạn không có quyền sửa cấu hình ca phòng ban.' };

    var phongBan = normalizeStr_(data.phongBan);
    var caLam = normalizeStr_(data.caLam);
    if (!phongBan) return { success: false, message: 'Vui lòng chọn phòng ban.' };
    if (['SANG', 'CHIEU', 'FULL'].indexOf(caLam) < 0) return { success: false, message: 'Ca làm chỉ nhận SANG / CHIEU / FULL.' };

    // Kiểm tra định dạng giờ nếu có gửi lên
    var truongGio = ['gioBatDau', 'gioKetThuc', 'gioNghiTruaBatDau', 'gioNghiTruaKetThuc', 'tinhTangCaSau'];
    for (var i = 0; i < truongGio.length; i++) {
      var v = normalizeStr_(data[truongGio[i]]);
      if (v && hhmmToMin_(v) === null) {
        return { success: false, message: 'Giờ "' + v + '" không hợp lệ (định dạng HH:mm).' };
      }
    }

    var trangThai = normalizeStr_(data.trangThai) || 'Active';
    var update = {
      GioBatDau: normalizeStr_(data.gioBatDau),
      GioKetThuc: normalizeStr_(data.gioKetThuc),
      GioNghiTruaBatDau: normalizeStr_(data.gioNghiTruaBatDau),
      GioNghiTruaKetThuc: normalizeStr_(data.gioNghiTruaKetThuc),
      PhutChoPhepTre: normalizeStr_(data.phutChoPhepTre),
      PhutChoPhepVeSom: normalizeStr_(data.phutChoPhepVeSom),
      TinhTangCaSau: normalizeStr_(data.tinhTangCaSau),
      TrangThai: trangThai,
      GhiChu: normalizeStr_(data.ghiChu)
    };

    // Upsert theo PhongBan + CaLam
    var sh = getSheet_(TEN_SHEET.CAU_HINH_CA_PHONG_BAN);
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var cPB = headers.indexOf('PhongBan'), cCa = headers.indexOf('CaLam');
    var daCo = false;
    for (var r = 1; r < values.length; r++) {
      if (normalizeStr_(values[r][cPB]) === phongBan && normalizeStr_(values[r][cCa]) === caLam) {
        for (var key in update) {
          var c = headers.indexOf(key);
          if (c >= 0) sh.getRange(r + 1, c + 1).setValue(update[key]);
        }
        daCo = true;
        break;
      }
    }
    if (daCo) {
      invalidateSheetCache_(TEN_SHEET.CAU_HINH_CA_PHONG_BAN);
    } else {
      update.PhongBan = phongBan;
      update.CaLam = caLam;
      appendRow(TEN_SHEET.CAU_HINH_CA_PHONG_BAN, update);
    }

    writeAttendanceHistory({
      recordID: phongBan + '/' + caLam, userID: '', hoTen: '',
      hanhDong: 'Sửa cấu hình ca phòng ban', giaTriCu: '',
      giaTriMoi: phongBan + ' ' + caLam + ': ' + normalizeStr_(data.gioBatDau) + '-' + normalizeStr_(data.gioKetThuc) + ' (' + trangThai + ')',
      nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
    });

    return { success: true, message: 'Đã lưu ca ' + caLam + ' của ' + phongBan + ': ' + normalizeStr_(data.gioBatDau) + ' - ' + normalizeStr_(data.gioKetThuc) + '.' };
  } finally {
    lock.releaseLock();
  }
}

// ================== V3.3: VỊ TRÍ CHẤM CÔNG GPS ==================
// Nguyên tắc: kiểm tra ở BACKEND. Tọa độ xưởng nằm trong sheet
// CAU_HINH_DIA_DIEM_CHAM_CONG, không hard-code trong code.

// GPS sai số lớn hơn ngưỡng này (mét) thì không tin được -> yêu cầu thử lại
var NGUONG_DO_CHINH_XAC_MET = 500;

/** Lấy địa điểm chấm công đang Active (dòng đầu tiên). Trả null nếu chưa có. */
function getActiveAttendanceLocation_() {
  var rows = getSheetDataSafe_(TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG);
  for (var i = 0; i < rows.length; i++) {
    if (!isActive_(rows[i].TrangThai)) continue;
    var viDo = parseFloat(normalizeStr_(rows[i].ViDo).replace(',', '.'));
    var kinhDo = parseFloat(normalizeStr_(rows[i].KinhDo).replace(',', '.'));
    var banKinh = Number(rows[i].BanKinhMet);
    return {
      diaDiemID: normalizeStr_(rows[i].DiaDiemID),
      tenDiaDiem: normalizeStr_(rows[i].TenDiaDiem),
      viDo: isNaN(viDo) ? null : viDo,
      kinhDo: isNaN(kinhDo) ? null : kinhDo,
      banKinhMet: (isNaN(banKinh) || banKinh <= 0) ? 400 : banKinh,
      batBuocGPS: isTrue_(rows[i].BatBuocGPS),
      choPhepNgoaiViTri: isTrue_(rows[i].ChoPhepChamCongNgoaiViTri),
      ghiChu: normalizeStr_(rows[i].GhiChu)
    };
  }
  return null;
}

/** Khoảng cách giữa 2 tọa độ (mét) theo công thức Haversine. */
function calculateDistanceMeters_(lat1, lng1, lat2, lng2) {
  var R = 6371000; // bán kính Trái Đất (m)
  var rad = Math.PI / 180;
  var dLat = (lat2 - lat1) * rad;
  var dLng = (lng2 - lng1) * rad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * V4.0.2: Lấy địa điểm chấm công HỢP LỆ đầu tiên (fail-closed theo mục 8):
 * Active + ViDo/KinhDo parse được và trong miền (±90/±180) + BanKinhMet > 0 + BatBuocGPS = TRUE.
 * Trả { diaDiem } hoặc { loi: 'CHUA_CAU_HINH' | 'DU_LIEU_SAI' }.
 */
function getValidAttendanceLocation_() {
  var rows = getSheetDataSafe_(TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG);
  var coDongActive = false;
  for (var i = 0; i < rows.length; i++) {
    if (!isActive_(rows[i].TrangThai)) continue;
    coDongActive = true;
    var viDo = parseFloat(normalizeStr_(rows[i].ViDo).replace(',', '.'));
    var kinhDo = parseFloat(normalizeStr_(rows[i].KinhDo).replace(',', '.'));
    var banKinh = Number(rows[i].BanKinhMet);
    if (isNaN(viDo) || Math.abs(viDo) > 90) continue;
    if (isNaN(kinhDo) || Math.abs(kinhDo) > 180) continue;
    if (isNaN(banKinh) || banKinh <= 0) continue;
    if (!isTrue_(rows[i].BatBuocGPS)) continue; // mục 8: dòng hợp lệ phải BatBuocGPS=TRUE
    return {
      diaDiem: {
        diaDiemID: normalizeStr_(rows[i].DiaDiemID),
        tenDiaDiem: normalizeStr_(rows[i].TenDiaDiem),
        viDo: viDo, kinhDo: kinhDo, banKinhMet: banKinh
      }
    };
  }
  return { loi: coDongActive ? 'DU_LIEU_SAI' : 'CHUA_CAU_HINH' };
}

/**
 * V5.0-RC2: Kiểm tra vị trí chấm công - FAIL-CLOSED ĐƠN GIẢN (quyết định 13/07/2026).
 * Trả { ok, message, canhBao, viDo, kinhDo, doChinhXac, khoangCach }.
 * Quy tắc A-D, không có ngoại lệ:
 *   A. Không có địa điểm Active hợp lệ -> TỪ CHỐI.
 *   B. Không có GPS client -> TỪ CHỐI.
 *   C. Accuracy vượt ngưỡng -> TỪ CHỐI.
 *   D. Ngoài bán kính -> TỪ CHỐI. Trong bán kính -> CHO PHÉP.
 * Trường hợp đặc biệt: PM sửa công tay (có audit). Không có fallback fail-open;
 * ChoPhepChamCongNgoaiViTri ngưng hiệu lực từ V4.0.2.
 */
function validateAttendanceLocation_(latitude, longitude, accuracy) {
  var kq = { ok: true, message: '', canhBao: '', viDo: '', kinhDo: '', doChinhXac: '', khoangCach: '' };

  var lat = parseFloat(latitude), lng = parseFloat(longitude);
  var acc = Math.round(Number(accuracy));
  var coGPS = !isNaN(lat) && !isNaN(lng);
  if (coGPS) {
    kq.viDo = String(lat);
    kq.kinhDo = String(lng);
    if (!isNaN(acc) && acc >= 0) kq.doChinhXac = String(acc);
  }

  var vi = getValidAttendanceLocation_();

  // Tính khoảng cách nếu đủ dữ liệu 2 phía
  if (coGPS && vi.diaDiem) {
    kq.khoangCach = String(Math.round(calculateDistanceMeters_(lat, lng, vi.diaDiem.viDo, vi.diaDiem.kinhDo)));
  }

  // A. Địa điểm
  if (vi.loi === 'CHUA_CAU_HINH') {
    kq.ok = false;
    kq.message = 'Chưa cấu hình địa điểm chấm công. Liên hệ quản lý thiết lập trước khi chấm.';
    return kq;
  }
  if (vi.loi === 'DU_LIEU_SAI') {
    kq.ok = false;
    kq.message = 'Cấu hình địa điểm chấm công không hợp lệ (vĩ độ/kinh độ/bán kính). Liên hệ quản lý kiểm tra lại.';
    return kq;
  }

  // B. GPS client
  if (!coGPS) {
    kq.ok = false;
    kq.message = 'Không lấy được vị trí. Vui lòng bật định vị và thử lại.';
    return kq;
  }

  // C. Độ chính xác
  if (!isNaN(acc) && acc > NGUONG_DO_CHINH_XAC_MET) {
    kq.ok = false;
    kq.message = 'Độ chính xác vị trí chưa đạt yêu cầu (sai số ±' + acc + 'm). Vui lòng ra chỗ thoáng và thử lại.';
    return kq;
  }

  // D. Bán kính
  var kc = Number(kq.khoangCach);
  if (isNaN(kc)) {
    // Có GPS + địa điểm hợp lệ thì luôn tính được; nhánh này chỉ để phòng thủ
    kq.ok = false;
    kq.message = 'Không xác định được khoảng cách đến xưởng. Vui lòng thử lại.';
    return kq;
  }
  if (kc > vi.diaDiem.banKinhMet) {
    kq.ok = false;
    kq.message = 'Bạn đang ngoài khu vực chấm công (cách xưởng ' + kc + 'm, bán kính cho phép ' + vi.diaDiem.banKinhMet + 'm).';
    return kq;
  }

  return kq;
}

/** Quyền sửa vị trí chấm công: DuocQuanLyNhanSu hoặc DuocSuaCauHinh. */
function coQuyenSuaViTri_(userID) {
  var u = checkUserActive(userID);
  if (!u) return null;
  var p = buildUserPayload_(u);
  return (p.duocQuanLyNhanSu || p.duocSuaCauHinh) ? u : null;
}

function getAttendanceLocationConfig(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var p = buildUserPayload_(u);
  if (!p.duocQuanLyNhanSu && !p.duocSuaCong && !p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền xem cấu hình vị trí chấm công.' };
  }
  var list = getSheetDataSafe_(TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG).map(function (r) {
    return {
      diaDiemID: normalizeStr_(r.DiaDiemID),
      tenDiaDiem: normalizeStr_(r.TenDiaDiem),
      viDo: normalizeStr_(r.ViDo),
      kinhDo: normalizeStr_(r.KinhDo),
      banKinhMet: normalizeStr_(r.BanKinhMet),
      batBuocGPS: isTrue_(r.BatBuocGPS),
      choPhepChamCongNgoaiViTri: isTrue_(r.ChoPhepChamCongNgoaiViTri),
      trangThai: normalizeStr_(r.TrangThai),
      ghiChu: normalizeStr_(r.GhiChu),
      thoiGianCapNhat: normalizeStr_(r.ThoiGianCapNhat)
    };
  });
  return { success: true, message: 'OK', data: list };
}

/**
 * Cập nhật cấu hình địa điểm (upsert theo DiaDiemID, mặc định DD001).
 * data = { userID, diaDiemID, tenDiaDiem, viDo, kinhDo, banKinhMet,
 *          batBuocGPS, choPhepChamCongNgoaiViTri, trangThai, ghiChu }
 */
function updateAttendanceLocationConfig(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = coQuyenSuaViTri_(data.userID);
    if (!mgr) return { success: false, message: 'Bạn không có quyền sửa cấu hình vị trí chấm công.' };

    var diaDiemID = normalizeStr_(data.diaDiemID) || 'DD001';

    var update = { ThoiGianCapNhat: nowStr_() };
    if (data.tenDiaDiem !== undefined) update.TenDiaDiem = normalizeStr_(data.tenDiaDiem);
    if (data.viDo !== undefined) {
      var viDo = normalizeStr_(data.viDo).replace(',', '.');
      if (viDo && (isNaN(parseFloat(viDo)) || Math.abs(parseFloat(viDo)) > 90)) return { success: false, message: 'Vĩ độ không hợp lệ.' };
      update.ViDo = viDo;
    }
    if (data.kinhDo !== undefined) {
      var kinhDo = normalizeStr_(data.kinhDo).replace(',', '.');
      if (kinhDo && (isNaN(parseFloat(kinhDo)) || Math.abs(parseFloat(kinhDo)) > 180)) return { success: false, message: 'Kinh độ không hợp lệ.' };
      update.KinhDo = kinhDo;
    }
    if (data.banKinhMet !== undefined) {
      var banKinh = Number(data.banKinhMet);
      if (isNaN(banKinh) || banKinh <= 0) return { success: false, message: 'Bán kính (mét) không hợp lệ.' };
      update.BanKinhMet = String(Math.round(banKinh));
    }
    if (data.batBuocGPS !== undefined) update.BatBuocGPS = data.batBuocGPS === true ? 'TRUE' : 'FALSE';
    if (data.choPhepChamCongNgoaiViTri !== undefined) update.ChoPhepChamCongNgoaiViTri = data.choPhepChamCongNgoaiViTri === true ? 'TRUE' : 'FALSE';
    if (data.trangThai !== undefined) update.TrangThai = normalizeStr_(data.trangThai) || 'Active';
    if (data.ghiChu !== undefined) update.GhiChu = normalizeStr_(data.ghiChu);

    var found = updateRowById(TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG, 'DiaDiemID', diaDiemID, update);
    if (!found) {
      update.DiaDiemID = diaDiemID;
      update.TenDiaDiem = update.TenDiaDiem || 'Xưởng chính';
      update.TrangThai = update.TrangThai || 'Active';
      update.BanKinhMet = update.BanKinhMet || '400';
      update.BatBuocGPS = update.BatBuocGPS || 'TRUE';
      update.ChoPhepChamCongNgoaiViTri = update.ChoPhepChamCongNgoaiViTri || 'FALSE';
      update.ThoiGianTao = nowStr_();
      appendRow(TEN_SHEET.CAU_HINH_DIA_DIEM_CHAM_CONG, update);
    }

    writeAttendanceHistory({
      recordID: diaDiemID, userID: '', hoTen: '',
      hanhDong: 'Sửa cấu hình vị trí chấm công', giaTriCu: '',
      giaTriMoi: JSON.stringify(update),
      nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
    });

    return { success: true, message: 'Đã lưu cấu hình vị trí chấm công.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lấy vị trí hiện tại của quản lý làm tọa độ xưởng.
 * data = { userID, latitude, longitude, accuracy, diaDiemID }
 */
function setCurrentLocationAsWorkshop(data) {
  var mgr = coQuyenSuaViTri_(data.userID);
  if (!mgr) return { success: false, message: 'Bạn không có quyền thiết lập vị trí xưởng.' };

  var lat = parseFloat(data.latitude), lng = parseFloat(data.longitude);
  if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { success: false, message: 'Tọa độ gửi lên không hợp lệ. Vui lòng bật GPS và thử lại.' };
  }
  var acc = Math.round(Number(data.accuracy));

  var kq = updateAttendanceLocationConfig({
    userID: data.userID,
    diaDiemID: normalizeStr_(data.diaDiemID) || 'DD001',
    viDo: String(lat),
    kinhDo: String(lng)
  });
  if (!kq.success) return kq;

  return {
    success: true,
    message: 'Đã lấy vị trí hiện tại làm vị trí xưởng (' + lat.toFixed(6) + ', ' + lng.toFixed(6) + ').' +
      (!isNaN(acc) && acc > 50 ? ' Lưu ý: sai số GPS lúc lấy là ±' + acc + 'm, nên đứng giữa xưởng và bấm lại nếu cần chính xác hơn.' : '')
  };
}

/*******************************************************
 *******************************************************
 **              MODULE V4.0 - ĐỢT 1                  **
 **  Nền V4 + feature flags (FALSE/TEST/TRUE) +       **
 **  Reminder Center + Sinh nhật + Hết thử việc +     **
 **  Thông báo nội bộ.                                **
 **  KHÔNG chèn guard khóa kỳ (để Đợt 3).             **
 **  KHÔNG sửa hàm V3.3.3 nào ngoài các điểm chạm     **
 **  đã duyệt trong KIEN-TRUC-V4.md.                  **
 *******************************************************
 *******************************************************/

// ================== V4: SETUP (CHẠY 1 LẦN, IDEMPOTENT) ==================

var DS_MODULE_V4 = [
  'ReminderCenter', 'Birthday', 'Probation', 'ShiftRequest', 'EarlyLeave',
  'Overtime', 'Announcement', 'PayrollLock', 'SalaryConfirm', 'OwnerDashboard',
  // V5.0 Production
  'KPI', 'AttendanceV2', 'SalaryHistory'
];

/**
 * setupSheetsV4() - migration V4, AN TOÀN TUYỆT ĐỐI:
 * - Idempotent: chạy lần 2, 3 không tạo trùng, không xóa, không ghi đè,
 *   không seed đè flag đã đổi.
 * - Chỉ tạo sheet còn thiếu; chỉ nối cột còn thiếu vào CUỐI NHAN_VIEN.
 * - KHÔNG gọi setupSheets() cũ.
 * - Log rõ việc SẼ làm trước khi ghi; trả báo cáo chi tiết sau khi chạy.
 */
function setupSheetsV4() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var baoCao = { sheetTaoMoi: [], sheetGiuNguyen: [], cotNoiThem: [], dongSeed: [] };

  var dinhNghiaV4 = [
    { name: TEN_SHEET.CAU_HINH_MODULE, headers: ['Module', 'Enable', 'GhiChu'], sample: [] },
    { name: TEN_SHEET.DOI_CA, headers: ['DoiCaID', 'UserID', 'HoTen', 'PhongBan', 'Ngay', 'CaDeNghi', 'GioBatDau', 'GioKetThuc', 'LyDo', 'TrangThai', 'NguoiDuyet', 'ThoiGianDuyet', 'LyDoTuChoi', 'LichLamID', 'ThoiGianTao'], sample: [] },
    { name: TEN_SHEET.VE_SOM, headers: ['VeSomID', 'UserID', 'HoTen', 'PhongBan', 'Ngay', 'GioVeSom', 'LyDo', 'TrangThai', 'NguoiDuyet', 'ThoiGianDuyet', 'LyDoTuChoi', 'ThoiGianTao'], sample: [] },
    { name: TEN_SHEET.THONG_BAO, headers: ['ThongBaoID', 'TieuDe', 'NoiDung', 'PhongBan', 'QuanTrong', 'NguoiTao', 'ThoiGianTao', 'HanHienThi', 'TrangThai'], sample: [] },
    { name: TEN_SHEET.THONG_BAO_DA_DOC, headers: ['ThongBaoID', 'UserID', 'ThoiGianDoc'], sample: [] },
    { name: TEN_SHEET.CHOT_KY, headers: ['ChotID', 'Loai', 'Thang', 'Nam', 'LanChot', 'TrangThai', 'NguoiChot', 'ThoiGianChot', 'NguoiMoKhoa', 'ThoiGianMoKhoa', 'GhiChu'], sample: [] },
    { name: TEN_SHEET.BANG_LUONG, headers: ['BangLuongID', 'Thang', 'Nam', 'LanChot', 'HieuLuc', 'UserID', 'HoTen', 'PhongBan', 'HinhThucLuong', 'LuongCoBan', 'LuongTheoGio', 'PhuCapCoDinh', 'TongGioLam', 'TongGioTangCa', 'NghiCoPhep', 'NghiKhongPhep', 'TamUngDaChi', 'Thuong', 'Phat', 'PhuCap', 'KhauTru', 'TongTamTinh', 'GhiChu', 'NguoiChot', 'ThoiGianChot', 'DaKyNhan', 'ThoiGianKyNhan', 'ThietBiKyNhan'], sample: [] },
    // NHAN_VIEN: 17 cột cũ giữ nguyên thứ tự + 2 cột V4 nối CUỐI
    { name: TEN_SHEET.NHAN_VIEN, headers: ['UserID', 'HoTen', 'SoDienThoai', 'PhongBan', 'ChucVu', 'NgayVaoLam', 'NgayNghiViec', 'HinhThucLuong', 'LuongCoBan', 'LuongTheoGio', 'PhuCapCoDinh', 'SoTaiKhoan', 'TenNganHang', 'TrangThaiLamViec', 'GhiChu', 'ThoiGianTao', 'ThoiGianCapNhat', 'NgaySinh', 'NgayKetThucThuViec'], sample: [] }
  ];

  // BƯỚC 1+2: với từng sheet - log việc SẼ làm, rồi thực hiện bằng ensureSheetSafe_
  dinhNghiaV4.forEach(function (dn) {
    var sh = ss.getSheetByName(dn.name);
    if (!sh) {
      Logger.log('[V4-SETUP] SẼ TẠO sheet mới: ' + dn.name);
      ensureSheetSafe_(ss, dn);
      // RC1: xóa cả cache của sheet vừa tạo - phòng CacheService còn giữ bản []
      // từ lần app đọc trước khi sheet tồn tại (TTL 5 phút)
      invalidateSheetCache_(dn.name);
      baoCao.sheetTaoMoi.push(dn.name);
      return;
    }
    // Sheet đã có: xác định cột thiếu (chỉ nối cuối, không đổi thứ tự cột cũ)
    var lastCol = sh.getLastColumn();
    var hienCo = lastCol > 0
      ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return normalizeStr_(h); })
      : [];
    var thieu = dn.headers.filter(function (h) { return hienCo.indexOf(h) < 0; });
    if (thieu.length > 0) {
      Logger.log('[V4-SETUP] SẼ NỐI cột vào CUỐI ' + dn.name + ': ' + thieu.join(', '));
    } else {
      Logger.log('[V4-SETUP] Giữ nguyên ' + dn.name + ' (đủ cột).');
    }
    ensureSheetSafe_(ss, dn);
    invalidateSheetCache_(dn.name);
    baoCao.sheetGiuNguyen.push(dn.name);
    thieu.forEach(function (h) { baoCao.cotNoiThem.push(dn.name + '.' + h); });
  });

  // BƯỚC 3: seed feature flags - TẤT CẢ FALSE, chỉ seed Module CHƯA có dòng
  invalidateSheetCache_(TEN_SHEET.CAU_HINH_MODULE);
  var flagDaCo = {};
  getSheetData(TEN_SHEET.CAU_HINH_MODULE).forEach(function (r) {
    flagDaCo[normalizeStr_(r.Module)] = true;
  });
  DS_MODULE_V4.forEach(function (m) {
    if (flagDaCo[m]) return; // idempotent: không seed đè flag đã có (kể cả đã bật TEST/TRUE)
    Logger.log('[V4-SETUP] SẼ SEED flag: ' + m + ' = FALSE');
    appendRow(TEN_SHEET.CAU_HINH_MODULE, {
      Module: m, Enable: 'FALSE',
      GhiChu: 'V4: FALSE=tắt, TEST=chỉ chủ xưởng/quản lý thấy, TRUE=bật toàn xưởng'
    });
    baoCao.dongSeed.push('CAU_HINH_MODULE: ' + m + ' = FALSE');
  });

  // BƯỚC 4: seed ChuXuongUserID (VALUE RỖNG - không suy đoán user), chỉ khi chưa có key
  invalidateSheetCache_(TEN_SHEET.CAU_HINH_CHUNG);
  var coKeyChuXuong = getSheetData(TEN_SHEET.CAU_HINH_CHUNG).some(function (r) {
    return normalizeStr_(r.Key) === 'ChuXuongUserID';
  });
  if (!coKeyChuXuong) {
    Logger.log('[V4-SETUP] SẼ SEED cấu hình: ChuXuongUserID = (rỗng)');
    appendRow(TEN_SHEET.CAU_HINH_CHUNG, {
      Key: 'ChuXuongUserID', Value: '',
      GhiChu: 'UserID chủ xưởng (V4) - BẮT BUỘC điền trước khi dùng mở khóa kỳ. App không tự suy đoán.'
    });
    baoCao.dongSeed.push('CAU_HINH_CHUNG: ChuXuongUserID = (rỗng)');
  }

  Logger.log('[V4-SETUP] KẾT QUẢ: ' + JSON.stringify(baoCao));
  return baoCao;
}

// ================== V4: FEATURE FLAGS (FALSE / TEST / TRUE) ==================

/**
 * Trạng thái thô của 1 module: 'TRUE' | 'TEST' | 'FALSE'.
 * Không có dòng / giá trị lạ -> 'FALSE' (an toàn mặc định).
 */
function getModuleState_(tenModule) {
  var rows = getSheetDataSafe_(TEN_SHEET.CAU_HINH_MODULE);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].Module) === tenModule) {
      var v = normalizeStr_(rows[i].Enable).toUpperCase();
      if (v === 'TRUE') return 'TRUE';
      if (v === 'TEST') return 'TEST';
      return 'FALSE';
    }
  }
  return 'FALSE';
}

/** User có phải nhóm quản lý không (dùng cho trạng thái TEST). */
function laQuanLy_(p) {
  return !!(p && (p.duocXemDashboard || p.duocDuyetNghi || p.duocSuaCauHinh ||
    p.duocQuanLyNhanSu || p.duocSuaCong || p.duocXemBangLuong ||
    p.duocDuyetTamUng || p.duocChotLuong));
}

/** UserID chủ xưởng từ CAU_HINH_CHUNG (chuỗi rỗng nếu chưa cấu hình). */
function getChuXuongUserID_() {
  return normalizeStr_(getConfigMap_()['ChuXuongUserID']);
}

/**
 * User có được DÙNG module không (đã tính trạng thái TEST):
 * - TRUE  -> mọi user (phân quyền chi tiết vẫn check riêng trong từng API).
 * - TEST  -> chỉ chủ xưởng (ChuXuongUserID) hoặc tài khoản nhóm quản lý.
 * - FALSE -> không ai.
 */
function moduleEnabledFor_(tenModule, userPayload) {
  var st = getModuleState_(tenModule);
  if (st === 'TRUE') return true;
  if (st === 'TEST') {
    if (!userPayload) return false;
    var chuXuong = getChuXuongUserID_();
    if (chuXuong && userPayload.userID === chuXuong) return true;
    return laQuanLy_(userPayload);
  }
  return false;
}

/**
 * Guard chuẩn đầu mỗi API module V4: kiểm tra user + flag Ở BACKEND
 * (không chỉ ẩn menu frontend).
 * Trả { err } nếu bị chặn, hoặc { u, p } để hàm dùng tiếp.
 */
function checkModule_(tenModule, userID) {
  var u = checkUserActive(userID);
  if (!u) return { err: { success: false, message: 'Tài khoản không hợp lệ.' } };
  var p = buildUserPayload_(u);
  if (!moduleEnabledFor_(tenModule, p)) {
    return { err: { success: false, message: 'Chức năng đang tắt.' } };
  }
  return { u: u, p: p };
}

/**
 * Trả về trạng thái các module CHO USER HIỆN TẠI (frontend ẩn/hiện nút).
 * duocDung đã tính TEST; trangThai thô chỉ trả cho nhóm quản lý.
 */
function getModuleConfig(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var p = buildUserPayload_(u);
  var laQL = laQuanLy_(p);
  var list = DS_MODULE_V4.map(function (m) {
    return {
      module: m,
      duocDung: moduleEnabledFor_(m, p),
      trangThai: laQL ? getModuleState_(m) : undefined
    };
  });
  return { success: true, message: 'OK', data: list };
}

/** data = { userID, module, enable } - enable chỉ nhận FALSE / TEST / TRUE. */
function updateModuleConfig(data) {
  var mgr = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!mgr) return { success: false, message: 'Bạn không có quyền bật/tắt module.' };

  var tenModule = normalizeStr_(data.module);
  if (DS_MODULE_V4.indexOf(tenModule) < 0) return { success: false, message: 'Module không hợp lệ.' };
  var enable = normalizeStr_(data.enable).toUpperCase();
  if (['FALSE', 'TEST', 'TRUE'].indexOf(enable) < 0) {
    return { success: false, message: 'Trạng thái chỉ nhận FALSE / TEST / TRUE.' };
  }

  var found = updateRowById(TEN_SHEET.CAU_HINH_MODULE, 'Module', tenModule, { Enable: enable });
  if (!found) {
    appendRow(TEN_SHEET.CAU_HINH_MODULE, { Module: tenModule, Enable: enable, GhiChu: '' });
  }
  writeAttendanceHistory({
    recordID: tenModule, userID: '', hoTen: '',
    hanhDong: 'Đổi trạng thái module V4', giaTriCu: '', giaTriMoi: tenModule + ' = ' + enable,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã đặt ' + tenModule + ' = ' + enable + '.' };
}

// ================== V4 M2+M3: SINH NHẬT & HẾT THỬ VIỆC ==================

/** Sinh nhật hôm nay + 7 ngày tới (so ngày-tháng, bỏ năm; xử lý qua năm). */
function getBirthdays(userID) {
  var ctx = checkModule_('Birthday', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem danh sách sinh nhật.' };

  var homNay = todayStr_();
  var nhanVien = getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).filter(function (r) {
    return normalizeStr_(r.TrangThaiLamViec) === 'Đang làm' && normalizeStr_(r.NgaySinh);
  });

  var dsHomNay = [], dsSapToi = [];
  for (var offset = 0; offset <= 7; offset++) {
    var ngay = addDaysStr_(homNay, offset);
    var mmdd = ngay.slice(5); // 'MM-dd'
    nhanVien.forEach(function (r) {
      var ns = normalizeDate_(r.NgaySinh);
      if (ns.length < 10 || ns.slice(5) !== mmdd) return;
      var item = {
        hoTen: normalizeStr_(r.HoTen),
        phongBan: normalizeStr_(r.PhongBan),
        ngaySinh: ns,
        ngayMung: ngay,
        conNgay: offset
      };
      if (offset === 0) dsHomNay.push(item); else dsSapToi.push(item);
    });
  }
  return { success: true, message: 'OK', data: { homNay: dsHomNay, sapToi: dsSapToi } };
}

/** Hết thử việc: quá hạn / hôm nay / còn 1-3 ngày / còn 4-7 ngày. */
function getProbationAlerts(userID) {
  var ctx = checkModule_('Probation', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem danh sách thử việc.' };

  var homNay = todayStr_();
  var quaHan = [], denHomNay = [], con3Ngay = [], con7Ngay = [];

  getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).forEach(function (r) {
    if (normalizeStr_(r.TrangThaiLamViec) !== 'Đang làm') return;
    var ngayKT = normalizeDate_(r.NgayKetThucThuViec);
    if (!isValidDateStr_(ngayKT)) return;
    var conNgay = dateDiffDays_(homNay, ngayKT);
    var item = {
      hoTen: normalizeStr_(r.HoTen),
      phongBan: normalizeStr_(r.PhongBan),
      ngayKetThuc: ngayKT,
      conNgay: conNgay
    };
    if (conNgay < 0) quaHan.push(item);
    else if (conNgay === 0) denHomNay.push(item);
    else if (conNgay <= 3) con3Ngay.push(item);
    else if (conNgay <= 7) con7Ngay.push(item);
  });

  return { success: true, message: 'OK', data: { quaHan: quaHan, homNay: denHomNay, con3Ngay: con3Ngay, con7Ngay: con7Ngay } };
}

// ================== V4 M7: THÔNG BÁO NỘI BỘ ==================

// Giới hạn đọc sheet đã-đọc: chỉ N dòng cuối (sheet phình theo thời gian)
var TB_DA_DOC_TAIL = 2000;

function buildThongBaoPayload_(r) {
  return {
    thongBaoID: normalizeStr_(r.ThongBaoID),
    tieuDe: normalizeStr_(r.TieuDe),
    noiDung: normalizeStr_(r.NoiDung),
    phongBan: normalizeStr_(r.PhongBan),
    quanTrong: isTrue_(r.QuanTrong),
    nguoiTao: normalizeStr_(r.NguoiTao),
    thoiGianTao: normalizeStr_(r.ThoiGianTao),
    hanHienThi: normalizeDate_(r.HanHienThi),
    trangThai: normalizeStr_(r.TrangThai)
  };
}

/**
 * Lõi lấy thông báo cho 1 user: Active, còn hạn, đúng phòng ban (hoặc toàn xưởng),
 * kèm cờ đã đọc. Dùng chung cho getAnnouncements và getPendingTasks (memo lo hiệu năng).
 */
function layThongBaoCuaUser_(u) {
  var homNay = todayStr_();
  var pbUser = normalizeStr_(u.PhongBan);
  var userID = normalizeStr_(u.UserID);

  var daDoc = {};
  getSheetDataTail_(TEN_SHEET.THONG_BAO_DA_DOC, TB_DA_DOC_TAIL).forEach(function (r) {
    if (normalizeStr_(r.UserID) === userID) daDoc[normalizeStr_(r.ThongBaoID)] = true;
  });

  var danhSach = getSheetDataSafe_(TEN_SHEET.THONG_BAO)
    .map(buildThongBaoPayload_)
    .filter(function (tb) {
      if (tb.trangThai !== 'Active') return false;
      if (tb.hanHienThi && tb.hanHienThi < homNay) return false;
      if (tb.phongBan && tb.phongBan !== pbUser) return false;
      return true;
    })
    .map(function (tb) { tb.daDoc = !!daDoc[tb.thongBaoID]; return tb; })
    .sort(function (a, b) { return a.thoiGianTao < b.thoiGianTao ? 1 : -1; });

  var soChuaDoc = 0;
  var popup = [];
  danhSach.forEach(function (tb) {
    if (!tb.daDoc) {
      soChuaDoc++;
      if (tb.quanTrong && popup.length < 3) popup.push(tb);
    }
  });
  return { danhSach: danhSach, soChuaDoc: soChuaDoc, popup: popup };
}

/**
 * Lấy thông báo. xemTatCa = true (chỉ người có quyền tạo): trả mọi thông báo
 * Active không lọc phòng ban/hạn - dùng cho màn quản lý.
 */
function getAnnouncements(userID, xemTatCa) {
  var ctx = checkModule_('Announcement', userID);
  if (ctx.err) return ctx.err;

  if (xemTatCa === true) {
    if (!ctx.p.duocDuyetNghi && !ctx.p.duocSuaCauHinh) {
      return { success: false, message: 'Bạn không có quyền quản lý thông báo.' };
    }
    var tatCa = getSheetDataSafe_(TEN_SHEET.THONG_BAO)
      .map(buildThongBaoPayload_)
      .filter(function (tb) { return tb.trangThai === 'Active'; })
      .sort(function (a, b) { return a.thoiGianTao < b.thoiGianTao ? 1 : -1; });
    return { success: true, message: 'OK', data: { danhSach: tatCa, soChuaDoc: 0, popup: [] } };
  }

  return { success: true, message: 'OK', data: layThongBaoCuaUser_(ctx.u) };
}

/**
 * PM tạo thông báo.
 * data = { userID, tieuDe, noiDung, phongBan, quanTrong, hanHienThi }
 */
function createAnnouncement(data) {
  var ctx = checkModule_('Announcement', data.userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocDuyetNghi && !ctx.p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền tạo thông báo.' };
  }

  var tieuDe = normalizeStr_(data.tieuDe);
  var noiDung = normalizeStr_(data.noiDung);
  if (!tieuDe) return { success: false, message: 'Vui lòng nhập tiêu đề.' };
  if (!noiDung) return { success: false, message: 'Vui lòng nhập nội dung.' };
  var hanHienThi = normalizeDate_(data.hanHienThi);
  if (hanHienThi && !isValidDateStr_(hanHienThi)) {
    return { success: false, message: 'Hạn hiển thị không hợp lệ.' };
  }

  var id = 'TB-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendRow(TEN_SHEET.THONG_BAO, {
    ThongBaoID: id,
    TieuDe: tieuDe,
    NoiDung: noiDung,
    PhongBan: normalizeStr_(data.phongBan), // rỗng = toàn xưởng
    QuanTrong: data.quanTrong === true ? 'TRUE' : 'FALSE',
    NguoiTao: ctx.p.userID,
    ThoiGianTao: nowStr_(),
    HanHienThi: hanHienThi,
    TrangThai: 'Active'
  });
  writeAttendanceHistory({
    recordID: id, userID: '', hoTen: '',
    hanhDong: 'Tạo thông báo', giaTriCu: '', giaTriMoi: tieuDe,
    nguoiThucHien: ctx.p.userID, ghiChu: normalizeStr_(data.phongBan) || 'Toàn xưởng'
  });
  return { success: true, message: 'Đã đăng thông báo "' + tieuDe + '".', data: { thongBaoID: id } };
}

/** Đánh dấu đã đọc (idempotent). data = { userID, thongBaoID } */
function markAnnouncementRead(data) {
  var ctx = checkModule_('Announcement', data.userID);
  if (ctx.err) return ctx.err;

  var thongBaoID = normalizeStr_(data.thongBaoID);
  if (!thongBaoID) return { success: false, message: 'Thiếu mã thông báo.' };

  var userID = ctx.p.userID;
  var daCo = getSheetDataTail_(TEN_SHEET.THONG_BAO_DA_DOC, TB_DA_DOC_TAIL).some(function (r) {
    return normalizeStr_(r.UserID) === userID && normalizeStr_(r.ThongBaoID) === thongBaoID;
  });
  if (daCo) return { success: true, message: 'Đã ghi nhận trước đó.' };

  appendRow(TEN_SHEET.THONG_BAO_DA_DOC, {
    ThongBaoID: thongBaoID, UserID: userID, ThoiGianDoc: nowStr_()
  });
  return { success: true, message: 'Đã đánh dấu đã đọc.' };
}

/** Gỡ thông báo (Inactive, không xóa dòng). data = { userID, thongBaoID } */
function deactivateAnnouncement(data) {
  var ctx = checkModule_('Announcement', data.userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocDuyetNghi && !ctx.p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền gỡ thông báo.' };
  }
  var found = updateRowById(TEN_SHEET.THONG_BAO, 'ThongBaoID', data.thongBaoID, { TrangThai: 'Inactive' });
  if (!found) return { success: false, message: 'Không tìm thấy thông báo.' };
  writeAttendanceHistory({
    recordID: normalizeStr_(data.thongBaoID), userID: '', hoTen: '',
    hanhDong: 'Gỡ thông báo', giaTriCu: 'Active', giaTriMoi: 'Inactive',
    nguoiThucHien: ctx.p.userID, ghiChu: ''
  });
  return { success: true, message: 'Đã gỡ thông báo.' };
}

// ================== V4 M1: TRUNG TÂM VIỆC CẦN XỬ LÝ ==================

/**
 * MỘT request tổng hợp mọi việc cần xử lý (backend tự gom, frontend không
 * được gọi nhiều API con nối tiếp). Mỗi sheet chỉ đọc 1 lần nhờ memo.
 * Từng mục con tôn trọng flag module tương ứng.
 */
function getPendingTasks(userID) {
  var ctx = checkModule_('ReminderCenter', userID);
  if (ctx.err) return ctx.err;
  var p = ctx.p;
  var homNay = todayStr_();

  var kq = { tongViec: 0, muc: [] };
  function them(ma, ten, danhSach, manHinh) {
    kq.muc.push({ ma: ma, ten: ten, soLuong: danhSach.length, danhSach: danhSach.slice(0, 10), manHinh: manHinh });
    kq.tongViec += danhSach.length;
  }

  // ----- Đơn nghỉ chờ duyệt (module nghỉ phép V1 - luôn có) -----
  if (p.duocDuyetNghi) {
    var donNghi = getSheetData(TEN_SHEET.LICH_NGHI)
      .filter(function (r) {
        var tt = normalizeStr_(r.TrangThai);
        return tt === TRANG_THAI.CHO_DUYET || tt === TRANG_THAI.YEU_CAU_DAC_BIET;
      })
      .map(function (r) {
        return normalizeStr_(r.HoTen) + ' - ' + normalizeDate_(r.NgayNghi) + ' - ' + normalizeStr_(r.CaNghi) +
          (normalizeStr_(r.TrangThai) === TRANG_THAI.YEU_CAU_DAC_BIET ? ' (đặc biệt)' : '');
      });
    them('donNghi', '📝 Đơn nghỉ chờ duyệt', donNghi, 'duyet');
  }

  if (p.duocSuaCong) {
    // ----- Tăng ca chờ duyệt (sheet TANG_CA V3 - luôn đếm vì màn duyệt V3 luôn chạy) -----
    var otCho = getSheetDataSafe_(TEN_SHEET.TANG_CA)
      .filter(function (r) { return normalizeStr_(r.TrangThai) === TT_TANG_CA.CHO_DUYET; })
      .map(function (r) { return normalizeStr_(r.HoTen) + ' - ' + normalizeDate_(r.Ngay) + ' (' + (Number(r.SoGioTangCa) || 0) + 'h)'; });
    them('tangCa', '🌙 Tăng ca chờ duyệt', otCho, 'tangca');

    // ----- Đổi ca chờ duyệt (module Đợt 2 - chỉ đếm khi flag bật) -----
    if (moduleEnabledFor_('ShiftRequest', p)) {
      var doiCa = getSheetDataSafe_(TEN_SHEET.DOI_CA)
        .filter(function (r) { return normalizeStr_(r.TrangThai) === 'Chờ duyệt'; })
        .map(function (r) { return normalizeStr_(r.HoTen) + ' - ' + normalizeDate_(r.Ngay); });
      them('doiCa', '🔄 Đổi ca chờ duyệt', doiCa, '');
    }

    // ----- Về sớm chờ duyệt (module Đợt 2) -----
    if (moduleEnabledFor_('EarlyLeave', p)) {
      var veSom = getSheetDataSafe_(TEN_SHEET.VE_SOM)
        .filter(function (r) { return normalizeStr_(r.TrangThai) === 'Chờ duyệt'; })
        .map(function (r) { return normalizeStr_(r.HoTen) + ' - ' + normalizeDate_(r.Ngay) + ' từ ' + normalizeStr_(r.GioVeSom); });
      them('veSom', '🏃 Về sớm chờ duyệt', veSom, '');
    }

    // ----- Chưa chấm vào / chưa chấm ra hôm nay -----
    var ccTheoUser = {};
    getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
      if (normalizeDate_(r.Ngay) === homNay) ccTheoUser[normalizeStr_(r.UserID)] = r;
    });
    var nghiHomNay = {};
    getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
      if (normalizeDate_(r.NgayNghi) === homNay && normalizeStr_(r.TrangThai) === TRANG_THAI.DA_DUYET) {
        nghiHomNay[normalizeStr_(r.UserID)] = true;
      }
    });
    var chuaVao = [], chuaRa = [];
    getSheetData(TEN_SHEET.USERS).forEach(function (us) {
      if (!isActive_(us.TrangThai)) return;
      var id = normalizeStr_(us.UserID);
      var cc = ccTheoUser[id];
      if (cc && normalizeStr_(cc.GioVao)) {
        if (!normalizeStr_(cc.GioRa)) chuaRa.push(normalizeStr_(us.HoTen) + ' (' + normalizeStr_(us.PhongBan) + ') - vào ' + normalizeStr_(cc.GioVao));
      } else if (!nghiHomNay[id]) {
        chuaVao.push(normalizeStr_(us.HoTen) + ' (' + normalizeStr_(us.PhongBan) + ')');
      }
    });
    them('chuaChamVao', '⏳ Chưa chấm vào hôm nay', chuaVao, 'bcngay');
    them('chuaChamRa', '🚪 Đã vào, chưa chấm ra', chuaRa, 'bcngay');
  }

  // ----- Sinh nhật hôm nay (flag Birthday) -----
  if (laQuanLy_(p) && moduleEnabledFor_('Birthday', p)) {
    var sinhNhat = [];
    var mmddHomNay = homNay.slice(5);
    getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).forEach(function (r) {
      if (normalizeStr_(r.TrangThaiLamViec) !== 'Đang làm') return;
      var ns = normalizeDate_(r.NgaySinh);
      if (ns.length >= 10 && ns.slice(5) === mmddHomNay) {
        sinhNhat.push(normalizeStr_(r.HoTen) + ' (' + normalizeStr_(r.PhongBan) + ')');
      }
    });
    them('sinhNhat', '🎂 Sinh nhật hôm nay', sinhNhat, 'birthday');
  }

  // ----- Hết thử việc trong 7 ngày (flag Probation) -----
  if (laQuanLy_(p) && moduleEnabledFor_('Probation', p)) {
    var thuViec = [];
    getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).forEach(function (r) {
      if (normalizeStr_(r.TrangThaiLamViec) !== 'Đang làm') return;
      var ngayKT = normalizeDate_(r.NgayKetThucThuViec);
      if (!isValidDateStr_(ngayKT)) return;
      var conNgay = dateDiffDays_(homNay, ngayKT);
      if (conNgay <= 7) {
        thuViec.push(normalizeStr_(r.HoTen) + ' (' + normalizeStr_(r.PhongBan) + ') - ' +
          (conNgay < 0 ? 'QUÁ HẠN ' + (-conNgay) + ' ngày' : (conNgay === 0 ? 'HÔM NAY' : 'còn ' + conNgay + ' ngày')));
      }
    });
    them('thuViec', '📋 Hết thử việc (≤7 ngày)', thuViec, 'birthday');
  }

  // ----- Thông báo chưa đọc của chính user (flag Announcement) -----
  if (moduleEnabledFor_('Announcement', p)) {
    var tb = layThongBaoCuaUser_(ctx.u);
    var dsChuaDoc = tb.danhSach.filter(function (t) { return !t.daDoc; }).map(function (t) { return t.tieuDe; });
    them('thongBao', '📢 Thông báo chưa đọc', dsChuaDoc, 'thongbao');
  }

  return { success: true, message: 'OK', data: kq };
}

/*******************************************************
 **  V5.0-RC2: KHỐI NGOẠI LỆ GPS V4.0.2 ĐÃ GỠ TOÀN BỘ  **
 **  (setupSheetsV402, NGOAI_LE_GPS, CheDoGPSKhanCap,  **
 **  6 API ngoại lệ). GPS chỉ còn fail-closed đơn giản. **
 **  Giữ lại 2 helper chủ xưởng dùng chung cho V5:      **
 *******************************************************/

/** Chỉ đúng ChuXuongUserID (đã cấu hình) mới là chủ xưởng. Không suy đoán. */
function laChuXuong_(userID) {
  var cx = getChuXuongUserID_();
  return !!cx && normalizeStr_(userID) === cx;
}

function loiQuyenChuXuong_() {
  return getChuXuongUserID_()
    ? { success: false, message: 'Chỉ chủ xưởng được thực hiện thao tác này.' }
    : { success: false, message: 'Chưa cấu hình ChuXuongUserID trong Cấu hình chung. Vào Quản lý slot → Cấu hình chung điền UserID chủ xưởng trước.' };
}

/*******************************************************
 *******************************************************
 **         MODULE V5.0 PRODUCTION - NHÀ MÌNH         **
 **  Thực thi V4.1-V4.4 đã chốt + chỉ đạo Production. **
 **  Mọi module flag FALSE mặc định - bật dần P1->P4. **
 *******************************************************
 *******************************************************/

// ================== V5: SETUP (CHẠY 1 LẦN, IDEMPOTENT) ==================

/**
 * setupSheetsV5() - migration V5 Production, chạy được THẲNG TỪ NỀN V3.3.3.
 * An toàn tuyệt đối: chỉ tạo sheet thiếu, nối cột CUỐI, seed dòng chưa có.
 * Log trước khi ghi + báo cáo. Idempotent - chạy lần 2 trả báo cáo rỗng.
 * Tự gọi setupSheetsV4() trước để tạo đủ sheet nền V4 (flags, DOI_CA, VE_SOM,
 * THONG_BAO, CHOT_KY, BANG_LUONG, 2 cột NHAN_VIEN, ChuXuongUserID).
 */
function setupSheetsV5() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var baoCao = { sheetTaoMoi: [], cotNoiThem: [], dongSeed: [] };

  // BƯỚC 0: nền V4 (idempotent) - gộp báo cáo để đối chiếu 1 lần
  var bcV4 = setupSheetsV4();
  baoCao.sheetTaoMoi = baoCao.sheetTaoMoi.concat(bcV4.sheetTaoMoi || []);
  baoCao.cotNoiThem = baoCao.cotNoiThem.concat(bcV4.cotNoiThem || []);
  baoCao.dongSeed = baoCao.dongSeed.concat(bcV4.dongSeed || []);

  var dinhNghia = [
    { name: TEN_SHEET.KPI_NGAY, headers: ['Ngay', 'PhongBan', 'ChiTieu', 'ThucTe', 'NguoiCapNhat', 'ThoiGianCapNhat', 'GhiChu'], sample: [] },
    { name: TEN_SHEET.CAU_HINH_KPI, headers: ['PhongBan', 'ChiTieuMacDinh', 'TrangThai'], sample: [['CSKH', '100', 'Active'], ['KyThuat', '100', 'Active'], ['GiaCong', '100', 'Active']] },
    { name: TEN_SHEET.CHAM_CONG_EVENT, headers: ['EventID', 'UserID', 'HoTen', 'PhongBan', 'Loai', 'Ngay', 'ThoiGian', 'ViDo', 'KinhDo', 'DoChinhXac', 'KhoangCach', 'ThietBi'], sample: [] },
    { name: TEN_SHEET.DIEU_CHINH_CONG, headers: ['PhieuID', 'UserID', 'HoTen', 'Ngay', 'CapDo', 'Loai', 'GiaTriCu', 'GiaTriMoi', 'LyDo', 'NguoiTao', 'ThoiGianTao', 'NguoiDuyet', 'ThoiGianDuyet', 'TrangThai', 'GhiChu', 'NguoiVoHieu', 'ThoiGianVoHieu', 'LyDoVoHieu'], sample: [] },
    { name: TEN_SHEET.LICH_SU_LUONG, headers: ['LuongID', 'UserID', 'HoTen', 'LuongChinhThuc', 'TyLe', 'LuongApDung', 'LuongTheoGio', 'PhuCapCoDinh', 'HieuLucTu', 'HieuLucDen', 'LyDo', 'QuyetDinhID', 'NguoiDuyet', 'ThoiGianTao'], sample: [] },
    { name: TEN_SHEET.QUYET_DINH_NHAN_SU, headers: ['QDID', 'UserID', 'HoTen', 'Loai', 'NoiDungCu', 'NoiDungMoi', 'HieuLucTu', 'LyDo', 'NguoiDeXuat', 'NguoiDuyet', 'ThoiGianDuyet', 'TrangThai', 'GhiChu'], sample: [] },
    { name: TEN_SHEET.CAU_HINH_CONG_CHUAN, headers: ['Thang', 'Nam', 'PhongBan', 'CongChuan', 'GhiChu'], sample: [] },
    // Nối cột CUỐI các sheet đã có (không đổi cột cũ)
    { name: TEN_SHEET.NHAN_VIEN, headers: ['UserID', 'HoTen', 'SoDienThoai', 'PhongBan', 'ChucVu', 'NgayVaoLam', 'NgayNghiViec', 'HinhThucLuong', 'LuongCoBan', 'LuongTheoGio', 'PhuCapCoDinh', 'SoTaiKhoan', 'TenNganHang', 'TrangThaiLamViec', 'GhiChu', 'ThoiGianTao', 'ThoiGianCapNhat', 'NgaySinh', 'NgayKetThucThuViec', 'NgayChinhThuc'], sample: [] },
    { name: TEN_SHEET.CHAM_CONG, headers: ['ChamCongID', 'UserID', 'HoTen', 'PhongBan', 'Ngay', 'GioVao', 'GioRa', 'CaLam', 'SoGioLam', 'DiTre', 'SoPhutTre', 'VeSom', 'SoPhutVeSom', 'TangCa', 'SoGioTangCa', 'TrangThai', 'GhiChuNhanVien', 'GhiChuQuanLy', 'NguoiSuaCuoi', 'ThoiGianTao', 'ThoiGianCapNhat', 'ViDoVao', 'KinhDoVao', 'DoChinhXacVao', 'KhoangCachVao', 'ViDoRa', 'KinhDoRa', 'DoChinhXacRa', 'KhoangCachRa', 'CoDieuChinh'], sample: [] },
    { name: TEN_SHEET.PHIEN_XU_LY_PM, headers: ['PhienID', 'Ngay', 'Loai', 'NguoiChot', 'ThoiGianChot', 'SoViecDaXuLy', 'BaoCao', 'GhiChu', 'SoViecConTon'], sample: [] }
  ];

  dinhNghia.forEach(function (dn) {
    var sh = ss.getSheetByName(dn.name);
    if (!sh) {
      Logger.log('[V5-SETUP] SẼ TẠO sheet mới: ' + dn.name);
      ensureSheetSafe_(ss, dn);
      invalidateSheetCache_(dn.name);
      baoCao.sheetTaoMoi.push(dn.name);
      return;
    }
    var lastCol = sh.getLastColumn();
    var hienCo = lastCol > 0
      ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return normalizeStr_(h); })
      : [];
    var thieu = dn.headers.filter(function (h) { return hienCo.indexOf(h) < 0; });
    if (thieu.length > 0) Logger.log('[V5-SETUP] SẼ NỐI cột vào CUỐI ' + dn.name + ': ' + thieu.join(', '));
    ensureSheetSafe_(ss, dn);
    invalidateSheetCache_(dn.name);
    thieu.forEach(function (h) { baoCao.cotNoiThem.push(dn.name + '.' + h); });
  });

  // Seed flags V5 còn thiếu (FALSE - idempotent, không đè flag đã chỉnh)
  invalidateSheetCache_(TEN_SHEET.CAU_HINH_MODULE);
  var flagDaCo = {};
  getSheetDataSafe_(TEN_SHEET.CAU_HINH_MODULE).forEach(function (r) { flagDaCo[normalizeStr_(r.Module)] = true; });
  ['KPI', 'AttendanceV2', 'SalaryHistory'].forEach(function (m) {
    if (flagDaCo[m]) return;
    Logger.log('[V5-SETUP] SẼ SEED flag: ' + m + ' = FALSE');
    appendRow(TEN_SHEET.CAU_HINH_MODULE, { Module: m, Enable: 'FALSE', GhiChu: 'V5 Production' });
    baoCao.dongSeed.push('CAU_HINH_MODULE: ' + m + ' = FALSE');
  });

  // Seed cấu hình chung (chỉ khi chưa có key)
  invalidateSheetCache_(TEN_SHEET.CAU_HINH_CHUNG);
  var keyDaCo = {};
  getSheetData(TEN_SHEET.CAU_HINH_CHUNG).forEach(function (r) { keyDaCo[normalizeStr_(r.Key)] = true; });
  [
    ['SoNgayPhepThang', '2', 'V5: số ngày phép hưởng lương mỗi tháng. Không nghỉ hết -> cộng tiền phần còn lại.'],
    ['CongChuanMacDinh', '26', 'V5: công chuẩn mặc định của tháng khi CAU_HINH_CONG_CHUAN không có dòng riêng.']
  ].forEach(function (cap) {
    if (keyDaCo[cap[0]]) return;
    Logger.log('[V5-SETUP] SẼ SEED cấu hình: ' + cap[0] + ' = ' + cap[1]);
    appendRow(TEN_SHEET.CAU_HINH_CHUNG, { Key: cap[0], Value: cap[1], GhiChu: cap[2] });
    baoCao.dongSeed.push('CAU_HINH_CHUNG: ' + cap[0] + ' = ' + cap[1]);
  });

  Logger.log('[V5-SETUP] KẾT QUẢ: ' + JSON.stringify(baoCao));
  return baoCao;
}

// ================== V5 P2: EVENT CHẤM CÔNG BẤT BIẾN ==================

/**
 * Ghi 1 event chấm công bất biến (chỉ append, không có API sửa/xóa).
 * - Flag AttendanceV2 tắt (hoặc đọc flag lỗi) -> bỏ qua, chấm công như V4.
 * - Flag bật: appendRow lỗi sẽ THROW ra ngoài -> checkIn/checkOut trả lỗi hệ thống,
 *   KHÔNG âm thầm báo chấm công thành công (quyết định Q4).
 */
function ghiEventChamCong_(loai, userRow, ngay, gio, viTri, thietBi) {
  try {
    var p = buildUserPayload_(userRow);
    if (!moduleEnabledFor_('AttendanceV2', p)) return;
  } catch (e) {
    return; // hạ tầng flag lỗi -> coi như module tắt, không chặn chấm công
  }
  appendRow(TEN_SHEET.CHAM_CONG_EVENT, {
    EventID: 'EV-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100),
    UserID: normalizeStr_(userRow.UserID),
    HoTen: normalizeStr_(userRow.HoTen),
    PhongBan: normalizeStr_(userRow.PhongBan),
    Loai: loai,
    Ngay: ngay,
    ThoiGian: nowStr_(),
    ViDo: viTri && viTri.viDo || '',
    KinhDo: viTri && viTri.kinhDo || '',
    DoChinhXac: viTri && viTri.doChinhXac || '',
    KhoangCach: viTri && viTri.khoangCach || '',
    ThietBi: normalizeStr_(thietBi).slice(0, 120)
  });
}

// ================== V5 P1: KPI THEO NGÀY ==================

/** Gộp chỉ tiêu mặc định + số nhập của ngày. */
function getKPIData_(ngay) {
  var kq = {};
  getSheetDataSafe_(TEN_SHEET.CAU_HINH_KPI).forEach(function (r) {
    if (!isActive_(r.TrangThai)) return;
    var pb = normalizeStr_(r.PhongBan);
    if (pb) kq[pb] = { phongBan: pb, chiTieu: Number(r.ChiTieuMacDinh) || 0, thucTe: 0, daNhap: false };
  });
  getSheetDataSafe_(TEN_SHEET.KPI_NGAY).forEach(function (r) {
    if (normalizeDate_(r.Ngay) !== ngay) return;
    var pb = normalizeStr_(r.PhongBan);
    if (!pb) return;
    if (!kq[pb]) kq[pb] = { phongBan: pb, chiTieu: 0, thucTe: 0, daNhap: false };
    if (normalizeStr_(r.ChiTieu) !== '') kq[pb].chiTieu = Number(r.ChiTieu) || 0;
    kq[pb].thucTe = Number(r.ThucTe) || 0;
    kq[pb].daNhap = true;
  });
  return Object.keys(kq).sort().map(function (k) { return kq[k]; });
}

function getKPIToday(userID, ngay) {
  var ctx = checkModule_('KPI', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem KPI.' };
  var n = normalizeDate_(ngay) || todayStr_();
  return { success: true, message: 'OK', data: { ngay: n, danhSach: getKPIData_(n) } };
}

/** PM cập nhật số bill thực tế (upsert theo Ngay + PhongBan). data = {userID, ngay, phongBan, thucTe, chiTieu} */
function updateKPI(data) {
  var ctx = checkModule_('KPI', data.userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong && !ctx.p.duocDuyetNghi && !ctx.p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền cập nhật KPI.' };
  }
  var ngay = normalizeDate_(data.ngay) || todayStr_();
  var phongBan = normalizeStr_(data.phongBan);
  if (!phongBan) return { success: false, message: 'Thiếu phòng ban.' };
  var thucTe = Number(data.thucTe);
  if (isNaN(thucTe) || thucTe < 0) return { success: false, message: 'Số bill không hợp lệ.' };

  var sh = getSheet_(TEN_SHEET.KPI_NGAY);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var cNgay = headers.indexOf('Ngay'), cPB = headers.indexOf('PhongBan');
  var cTT = headers.indexOf('ThucTe'), cCT = headers.indexOf('ChiTieu');
  var cNg = headers.indexOf('NguoiCapNhat'), cTg = headers.indexOf('ThoiGianCapNhat');
  for (var i = 1; i < values.length; i++) {
    if (normalizeDate_(values[i][cNgay]) === ngay && normalizeStr_(values[i][cPB]) === phongBan) {
      sh.getRange(i + 1, cTT + 1).setValue(String(thucTe));
      if (data.chiTieu !== undefined && data.chiTieu !== '') sh.getRange(i + 1, cCT + 1).setValue(String(Number(data.chiTieu) || 0));
      sh.getRange(i + 1, cNg + 1).setValue(ctx.p.userID);
      sh.getRange(i + 1, cTg + 1).setValue(nowStr_());
      invalidateSheetCache_(TEN_SHEET.KPI_NGAY);
      return { success: true, message: 'Đã cập nhật KPI ' + phongBan + ': ' + thucTe + ' bill.' };
    }
  }
  appendRow(TEN_SHEET.KPI_NGAY, {
    Ngay: ngay, PhongBan: phongBan,
    ChiTieu: (data.chiTieu !== undefined && data.chiTieu !== '') ? String(Number(data.chiTieu) || 0) : '',
    ThucTe: String(thucTe), NguoiCapNhat: ctx.p.userID, ThoiGianCapNhat: nowStr_()
  });
  return { success: true, message: 'Đã ghi KPI ' + phongBan + ': ' + thucTe + ' bill.' };
}

function getKPIConfig(userID) {
  var ctx = checkModule_('KPI', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem cấu hình KPI.' };
  var list = getSheetDataSafe_(TEN_SHEET.CAU_HINH_KPI).map(function (r) {
    return { phongBan: normalizeStr_(r.PhongBan), chiTieuMacDinh: Number(r.ChiTieuMacDinh) || 0, trangThai: normalizeStr_(r.TrangThai) };
  });
  return { success: true, message: 'OK', data: list };
}

/** data = {userID, phongBan, chiTieuMacDinh} */
function updateKPIConfig(data) {
  var ctx = checkModule_('KPI', data.userID); // RC2: chốt flag - KPI tắt thì không sửa được cấu hình
  if (ctx.err) return ctx.err;
  var mgr = checkPermission(data.userID, 'DuocSuaCauHinh');
  if (!mgr) return { success: false, message: 'Bạn không có quyền sửa cấu hình KPI.' };
  var phongBan = normalizeStr_(data.phongBan);
  var chiTieu = Number(data.chiTieuMacDinh);
  if (!phongBan || isNaN(chiTieu) || chiTieu < 0) return { success: false, message: 'Dữ liệu không hợp lệ.' };
  var found = updateRowById(TEN_SHEET.CAU_HINH_KPI, 'PhongBan', phongBan, { ChiTieuMacDinh: String(chiTieu) });
  if (!found) appendRow(TEN_SHEET.CAU_HINH_KPI, { PhongBan: phongBan, ChiTieuMacDinh: String(chiTieu), TrangThai: 'Active' });
  return { success: true, message: 'Đã đặt chỉ tiêu mặc định ' + phongBan + ' = ' + chiTieu + ' bill/ngày.' };
}

// ================== V5 P1: DASHBOARD PM (1 màn cho 5 việc) + CHỐT NGÀY ==================

/** Gom danh sách "cần xử lý" chuẩn hóa - dùng chung cho Dashboard PM, chotNgay, dashboard chủ. */
function gomViecCanXuLy_(p) {
  var viec = [];
  if (p.duocDuyetNghi) {
    getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
      var tt = normalizeStr_(r.TrangThai);
      if (tt !== TRANG_THAI.CHO_DUYET && tt !== TRANG_THAI.YEU_CAU_DAC_BIET) return;
      viec.push({ loai: 'nghi', id: normalizeStr_(r.LeaveID), moTa: normalizeStr_(r.HoTen) + ' xin nghỉ ' + normalizeStr_(r.CaNghi) + ' ' + normalizeDate_(r.NgayNghi) + (tt === TRANG_THAI.YEU_CAU_DAC_BIET ? ' (đặc biệt)' : '') + ' - ' + normalizeStr_(r.LyDo) });
    });
  }
  if (p.duocSuaCong) {
    getSheetDataSafe_(TEN_SHEET.TANG_CA).forEach(function (r) {
      if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.CHO_DUYET) return;
      viec.push({ loai: 'tangca', id: normalizeStr_(r.TangCaID), moTa: normalizeStr_(r.HoTen) + ' tăng ca ' + normalizeDate_(r.Ngay) + ' (' + (Number(r.SoGioTangCa) || 0) + 'h) - ' + normalizeStr_(r.LyDo) });
    });
    if (moduleEnabledFor_('ShiftRequest', p)) {
      getSheetDataSafe_(TEN_SHEET.DOI_CA).forEach(function (r) {
        if (normalizeStr_(r.TrangThai) !== 'Chờ duyệt') return;
        viec.push({ loai: 'doica', id: normalizeStr_(r.DoiCaID), moTa: normalizeStr_(r.HoTen) + ' xin đổi ca ' + normalizeDate_(r.Ngay) + ' sang ' + normalizeStr_(r.CaDeNghi) + ' - ' + normalizeStr_(r.LyDo) });
      });
    }
    if (moduleEnabledFor_('EarlyLeave', p)) {
      getSheetDataSafe_(TEN_SHEET.VE_SOM).forEach(function (r) {
        if (normalizeStr_(r.TrangThai) !== 'Chờ duyệt') return;
        viec.push({ loai: 'vesom', id: normalizeStr_(r.VeSomID), moTa: normalizeStr_(r.HoTen) + ' xin về sớm ' + normalizeDate_(r.Ngay) + ' từ ' + normalizeStr_(r.GioVeSom) + ' - ' + normalizeStr_(r.LyDo) });
      });
    }
  }
  if (moduleEnabledFor_('AttendanceV2', p) && laChuXuong_(p.userID)) {
    getSheetDataSafe_(TEN_SHEET.DIEU_CHINH_CONG).forEach(function (r) {
      if (normalizeStr_(r.TrangThai) !== 'ChoDuyet') return;
      viec.push({ loai: 'phieuB', id: normalizeStr_(r.PhieuID), moTa: 'Phiếu đổi công/tiền: ' + normalizeStr_(r.HoTen) + ' ngày ' + normalizeDate_(r.Ngay) + ' - ' + normalizeStr_(r.LyDo) });
    });
  }
  if (moduleEnabledFor_('SalaryHistory', p) && laChuXuong_(p.userID)) {
    getSheetDataSafe_(TEN_SHEET.QUYET_DINH_NHAN_SU).forEach(function (r) {
      if (normalizeStr_(r.TrangThai) !== 'ChoDuyet') return;
      viec.push({ loai: 'quyetdinh', id: normalizeStr_(r.QDID), moTa: 'Quyết định ' + normalizeStr_(r.Loai) + ': ' + normalizeStr_(r.HoTen) + ' - ' + normalizeStr_(r.LyDo) });
    });
  }
  return viec;
}

/** Tình hình chấm công hôm nay (dùng chung PM dashboard + dashboard chủ). */
function tinhHinhHomNay_() {
  var homNay = todayStr_();
  var ccTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
    if (normalizeDate_(r.Ngay) === homNay) ccTheoUser[normalizeStr_(r.UserID)] = r;
  });
  var nghiHomNay = {};
  getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
    if (normalizeDate_(r.NgayNghi) === homNay && normalizeStr_(r.TrangThai) === TRANG_THAI.DA_DUYET) {
      nghiHomNay[normalizeStr_(r.UserID)] = normalizeStr_(r.CaNghi) + ' - ' + normalizeStr_(r.LoaiNghi);
    }
  });
  var kq = { ngay: homNay, tongActive: 0, daVao: 0, dsDiTre: [], dsNghi: [], dsChuaVao: [], dsChuaRa: [] };
  getSheetData(TEN_SHEET.USERS).forEach(function (us) {
    if (!isActive_(us.TrangThai)) return;
    kq.tongActive++;
    var id = normalizeStr_(us.UserID);
    var ten = normalizeStr_(us.HoTen) + ' (' + normalizeStr_(us.PhongBan) + ')';
    var cc = ccTheoUser[id];
    if (cc && normalizeStr_(cc.GioVao)) {
      kq.daVao++;
      if (isTrue_(cc.DiTre)) kq.dsDiTre.push(ten + ' - trễ ' + (Number(cc.SoPhutTre) || 0) + 'p');
      if (!normalizeStr_(cc.GioRa)) kq.dsChuaRa.push(ten + ' - vào ' + normalizeStr_(cc.GioVao));
    } else if (nghiHomNay[id]) {
      kq.dsNghi.push(ten + ' - ' + nghiHomNay[id]);
    } else {
      kq.dsChuaVao.push(ten);
    }
  });
  return kq;
}

/** MỘT request cho cả Dashboard PM (mục 5 chỉ đạo: PM chỉ cần 1 màn). */
function getPMDashboard(userID) {
  var ctx = checkModule_('ReminderCenter', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem Dashboard PM.' };

  var homNay = todayStr_();
  var kpi = moduleEnabledFor_('KPI', ctx.p) ? getKPIData_(homNay) : null;
  var viec = gomViecCanXuLy_(ctx.p);
  var homNayTH = tinhHinhHomNay_();

  // Nhắc: hết thử việc (flag Probation) + đến kỳ tăng lương (flag SalaryHistory)
  var nhac = [];
  if (moduleEnabledFor_('Probation', ctx.p)) {
    getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).forEach(function (r) {
      if (normalizeStr_(r.TrangThaiLamViec) !== 'Đang làm') return;
      var kt = normalizeDate_(r.NgayKetThucThuViec);
      if (!isValidDateStr_(kt)) return;
      var con = dateDiffDays_(homNay, kt);
      if (con <= 7) nhac.push('📋 ' + normalizeStr_(r.HoTen) + ' hết thử việc ' + (con < 0 ? 'QUÁ HẠN ' + (-con) + ' ngày' : con === 0 ? 'HÔM NAY' : 'còn ' + con + ' ngày'));
    });
  }
  if (moduleEnabledFor_('SalaryHistory', ctx.p)) {
    getSalaryReviewDue_().forEach(function (x) {
      nhac.push('💰 ' + x.hoTen + ' đến kỳ xét tăng lương ' + (x.conNgay < 0 ? '(QUÁ HẠN ' + (-x.conNgay) + ' ngày)' : x.conNgay === 0 ? 'HÔM NAY' : '(còn ' + x.conNgay + ' ngày)'));
    });
  }

  var daChot = getSheetDataSafe_(TEN_SHEET.PHIEN_XU_LY_PM).some(function (r) {
    return normalizeDate_(r.Ngay) === homNay;
  });

  return {
    success: true, message: 'OK',
    data: { ngay: homNay, kpi: kpi, canXuLy: viec, homNay: homNayTH, nhacNho: nhac, daChotHomNay: daChot }
  };
}

/**
 * Chốt ngày (MỘT nút - quyết định C4 mặc định): ghi nhận đã rà soát + báo cáo + việc tồn.
 * KHÔNG khóa dữ liệu. Còn việc -> bắt buộc lý do (giữ quy tắc V4 Q8).
 */
function chotNgay(data) {
  var ctx = checkModule_('ReminderCenter', data.userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền chốt ngày.' };

  var viec = gomViecCanXuLy_(ctx.p);
  var th = tinhHinhHomNay_();
  var soTon = viec.length + th.dsChuaRa.length;
  var lyDoTon = normalizeStr_(data.lyDoTon);
  if (soTon > 0 && !lyDoTon) {
    return {
      success: false,
      message: 'Còn ' + soTon + ' việc chưa xử lý (' + viec.length + ' đơn chờ + ' + th.dsChuaRa.length + ' người chưa checkout). Nhập lý do để "Chốt còn tồn".',
      data: { needLyDo: true, soTon: soTon }
    };
  }

  var baoCao = 'CHỐT NGÀY ' + th.ngay +
    ' | Đi làm ' + th.daVao + '/' + th.tongActive +
    ' | Trễ ' + th.dsDiTre.length +
    ' | Nghỉ ' + th.dsNghi.length +
    ' | Chưa vào ' + th.dsChuaVao.length +
    ' | Chưa ra ' + th.dsChuaRa.length +
    ' | Đơn còn chờ ' + viec.length;

  appendRow(TEN_SHEET.PHIEN_XU_LY_PM, {
    PhienID: 'PH-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100),
    Ngay: th.ngay, Loai: 'NGAY',
    NguoiChot: ctx.p.userID, ThoiGianChot: nowStr_(),
    SoViecConTon: String(soTon), BaoCao: baoCao, GhiChu: lyDoTon
  });
  return { success: true, message: soTon > 0 ? 'Đã chốt ngày (còn tồn ' + soTon + ' việc, đã ghi lý do).' : 'Đã chốt ngày - sạch việc. 🎉', data: { baoCao: baoCao } };
}

// ================== V5 P1: ĐỔI CA THEO NGÀY ==================

function buildDoiCaPayload_(r) {
  return {
    doiCaID: normalizeStr_(r.DoiCaID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan), ngay: normalizeDate_(r.Ngay), caDeNghi: normalizeStr_(r.CaDeNghi),
    gioBatDau: normalizeStr_(r.GioBatDau), gioKetThuc: normalizeStr_(r.GioKetThuc),
    lyDo: normalizeStr_(r.LyDo), trangThai: normalizeStr_(r.TrangThai),
    nguoiDuyet: normalizeStr_(r.NguoiDuyet), thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet),
    lyDoTuChoi: normalizeStr_(r.LyDoTuChoi), thoiGianTao: normalizeStr_(r.ThoiGianTao)
  };
}

/** NV gửi yêu cầu đổi ca 1 ngày. data = {userID, ngay, caDeNghi, gioBatDau, gioKetThuc, lyDo} */
function submitShiftChange(data) {
  var ctx = checkModule_('ShiftRequest', data.userID);
  if (ctx.err) return ctx.err;
  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay) || ngay < todayStr_()) return { success: false, message: 'Chỉ đổi ca từ hôm nay trở đi.' };
  var ca = normalizeStr_(data.caDeNghi);
  if (['SANG', 'CHIEU', 'FULL', 'TUYCHINH'].indexOf(ca) < 0) return { success: false, message: 'Ca đề nghị không hợp lệ.' };
  if (ca === 'TUYCHINH' && (hhmmToMin_(data.gioBatDau) === null || hhmmToMin_(data.gioKetThuc) === null)) {
    return { success: false, message: 'Ca tùy chỉnh phải nhập giờ bắt đầu/kết thúc.' };
  }
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do đổi ca.' };
  var trung = getSheetDataSafe_(TEN_SHEET.DOI_CA).some(function (r) {
    return normalizeStr_(r.UserID) === ctx.p.userID && normalizeDate_(r.Ngay) === ngay && normalizeStr_(r.TrangThai) === 'Chờ duyệt';
  });
  if (trung) return { success: false, message: 'Bạn đã có yêu cầu đổi ca ngày này đang chờ duyệt.' };

  var id = 'DC-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendRow(TEN_SHEET.DOI_CA, {
    DoiCaID: id, UserID: ctx.p.userID, HoTen: ctx.p.hoTen, PhongBan: ctx.p.phongBan,
    Ngay: ngay, CaDeNghi: ca,
    GioBatDau: normalizeStr_(data.gioBatDau), GioKetThuc: normalizeStr_(data.gioKetThuc),
    LyDo: lyDo, TrangThai: 'Chờ duyệt', ThoiGianTao: nowStr_()
  });
  return { success: true, message: 'Đã gửi yêu cầu đổi ca ngày ' + ngay + '. Chờ quản lý duyệt.', data: { doiCaID: id } };
}

function getMyShiftChanges(userID) {
  var ctx = checkModule_('ShiftRequest', userID);
  if (ctx.err) return ctx.err;
  var list = getSheetDataSafe_(TEN_SHEET.DOI_CA)
    .filter(function (r) { return normalizeStr_(r.UserID) === ctx.p.userID; })
    .map(buildDoiCaPayload_)
    .sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

function getAllShiftChanges(userID, filters) {
  var ctx = checkModule_('ShiftRequest', userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền xem đổi ca toàn xưởng.' };
  var fTT = normalizeStr_((filters || {}).trangThai);
  var list = getSheetDataSafe_(TEN_SHEET.DOI_CA).map(buildDoiCaPayload_)
    .filter(function (r) { return !fTT || r.trangThai === fTT; })
    .sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** PM duyệt: tự ghi 1 dòng LICH_LAM (lịch riêng V3.2) -> chấm công ngày đó tự tính theo ca mới. */
function approveShiftChange(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = checkModule_('ShiftRequest', data.userID || data.managerUserID);
    if (ctx.err) return ctx.err;
    if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền duyệt đổi ca.' };

    var rows = getSheetDataSafe_(TEN_SHEET.DOI_CA);
    var r = null;
    for (var i = 0; i < rows.length; i++) {
      if (normalizeStr_(rows[i].DoiCaID) === normalizeStr_(data.doiCaID)) { r = rows[i]; break; }
    }
    if (!r) return { success: false, message: 'Không tìm thấy yêu cầu đổi ca.' };
    if (normalizeStr_(r.TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Yêu cầu này đã được xử lý.' };
    var ngay = normalizeDate_(r.Ngay);
    var chanKhoa = checkKyKhoa_('CONG', ngay); if (chanKhoa) return chanKhoa;

    // Giờ ca mới: TUYCHINH dùng giờ trong đơn; SANG/CHIEU/FULL lấy từ cấu hình ca phòng ban
    var ca = normalizeStr_(r.CaDeNghi);
    var bd = normalizeStr_(r.GioBatDau), kt = normalizeStr_(r.GioKetThuc);
    if (ca !== 'TUYCHINH') {
      var cfg = getEffectiveShiftCfg_(normalizeStr_(r.PhongBan));
      if (ca === 'SANG') { bd = cfg.GioVaoSang; kt = cfg.GioRaSang; }
      else if (ca === 'CHIEU') { bd = cfg.GioVaoChieu; kt = cfg.GioRaChieu; }
      else { bd = cfg.GioVaoSang; kt = cfg.GioRaChieu; }
    }
    var lichLamID = generateLichLamID();
    appendRow(TEN_SHEET.LICH_LAM, {
      LichLamID: lichLamID, Ngay: ngay,
      UserID: normalizeStr_(r.UserID), HoTen: normalizeStr_(r.HoTen), PhongBan: normalizeStr_(r.PhongBan),
      CaLam: ca === 'TUYCHINH' ? 'FULL' : ca,
      GioBatDau: bd, GioKetThuc: kt, LaNgayNghi: 'FALSE',
      GhiChu: 'Đổi ca theo đơn ' + normalizeStr_(r.DoiCaID),
      NguoiTao: ctx.p.userID, ThoiGianTao: nowStr_(), ThoiGianCapNhat: nowStr_()
    });
    updateRowById(TEN_SHEET.DOI_CA, 'DoiCaID', r.DoiCaID, {
      TrangThai: 'Đã duyệt', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(), LichLamID: lichLamID
    });
    writeAttendanceHistory({
      recordID: normalizeStr_(r.DoiCaID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
      hanhDong: 'Duyệt đổi ca', giaTriCu: 'Chờ duyệt', giaTriMoi: ngay + ' -> ' + ca + ' (' + bd + '-' + kt + ')',
      nguoiThucHien: ctx.p.userID, ghiChu: ''
    });
    return { success: true, message: 'Đã duyệt đổi ca ' + normalizeStr_(r.HoTen) + ' ngày ' + ngay + '. Chấm công ngày đó sẽ tự tính theo ca mới.' };
  } finally {
    lock.releaseLock();
  }
}

function rejectShiftChange(data) {
  var ctx = checkModule_('ShiftRequest', data.userID || data.managerUserID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền từ chối đổi ca.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var rows = getSheetDataSafe_(TEN_SHEET.DOI_CA);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].DoiCaID) !== normalizeStr_(data.doiCaID)) continue;
    if (normalizeStr_(rows[i].TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Yêu cầu này đã được xử lý.' };
    updateRowById(TEN_SHEET.DOI_CA, 'DoiCaID', data.doiCaID, {
      TrangThai: 'Từ chối', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(), LyDoTuChoi: lyDo
    });
    writeAttendanceHistory({
      recordID: normalizeStr_(data.doiCaID), userID: normalizeStr_(rows[i].UserID), hoTen: normalizeStr_(rows[i].HoTen),
      hanhDong: 'Từ chối đổi ca', giaTriCu: 'Chờ duyệt', giaTriMoi: 'Từ chối', nguoiThucHien: ctx.p.userID, ghiChu: lyDo
    });
    return { success: true, message: 'Đã từ chối yêu cầu đổi ca.' };
  }
  return { success: false, message: 'Không tìm thấy yêu cầu đổi ca.' };
}

function cancelMyShiftChange(data) {
  var ctx = checkModule_('ShiftRequest', data.userID);
  if (ctx.err) return ctx.err;
  var rows = getSheetDataSafe_(TEN_SHEET.DOI_CA);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].DoiCaID) !== normalizeStr_(data.doiCaID)) continue;
    if (normalizeStr_(rows[i].UserID) !== ctx.p.userID) return { success: false, message: 'Bạn chỉ hủy được yêu cầu của chính mình.' };
    if (normalizeStr_(rows[i].TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Chỉ hủy được yêu cầu đang chờ duyệt.' };
    updateRowById(TEN_SHEET.DOI_CA, 'DoiCaID', data.doiCaID, { TrangThai: 'Đã hủy' });
    return { success: true, message: 'Đã hủy yêu cầu đổi ca.' };
  }
  return { success: false, message: 'Không tìm thấy yêu cầu đổi ca.' };
}

// ================== V5 P1: XIN VỀ SỚM ==================

function buildVeSomPayload_(r) {
  return {
    veSomID: normalizeStr_(r.VeSomID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan), ngay: normalizeDate_(r.Ngay), gioVeSom: normalizeStr_(r.GioVeSom),
    lyDo: normalizeStr_(r.LyDo), trangThai: normalizeStr_(r.TrangThai),
    nguoiDuyet: normalizeStr_(r.NguoiDuyet), thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet),
    lyDoTuChoi: normalizeStr_(r.LyDoTuChoi), thoiGianTao: normalizeStr_(r.ThoiGianTao)
  };
}

/** data = {userID, ngay, gioVeSom, lyDo} */
function submitEarlyLeave(data) {
  var ctx = checkModule_('EarlyLeave', data.userID);
  if (ctx.err) return ctx.err;
  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay) || ngay < todayStr_()) return { success: false, message: 'Chỉ xin về sớm từ hôm nay trở đi.' };
  if (hhmmToMin_(data.gioVeSom) === null) return { success: false, message: 'Giờ về sớm không hợp lệ (HH:mm).' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do.' };

  var id = 'VS-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendRow(TEN_SHEET.VE_SOM, {
    VeSomID: id, UserID: ctx.p.userID, HoTen: ctx.p.hoTen, PhongBan: ctx.p.phongBan,
    Ngay: ngay, GioVeSom: normalizeStr_(data.gioVeSom), LyDo: lyDo,
    TrangThai: 'Chờ duyệt', ThoiGianTao: nowStr_()
  });
  return { success: true, message: 'Đã gửi xin về sớm ' + normalizeStr_(data.gioVeSom) + ' ngày ' + ngay + '. Chờ duyệt.', data: { veSomID: id } };
}

function getMyEarlyLeaves(userID) {
  var ctx = checkModule_('EarlyLeave', userID);
  if (ctx.err) return ctx.err;
  var list = getSheetDataSafe_(TEN_SHEET.VE_SOM)
    .filter(function (r) { return normalizeStr_(r.UserID) === ctx.p.userID; })
    .map(buildVeSomPayload_)
    .sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

function getAllEarlyLeaves(userID, filters) {
  var ctx = checkModule_('EarlyLeave', userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền xem về sớm toàn xưởng.' };
  var fTT = normalizeStr_((filters || {}).trangThai);
  var list = getSheetDataSafe_(TEN_SHEET.VE_SOM).map(buildVeSomPayload_)
    .filter(function (r) { return !fTT || r.trangThai === fTT; })
    .sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** Duyệt: đơn là nguồn sự thật; nếu ĐÃ có dòng chấm công ngày đó thì nối ghi chú đối chiếu. */
function approveEarlyLeave(data) {
  var ctx = checkModule_('EarlyLeave', data.userID || data.managerUserID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền duyệt về sớm.' };
  var rows = getSheetDataSafe_(TEN_SHEET.VE_SOM);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].VeSomID) !== normalizeStr_(data.veSomID)) continue;
    if (normalizeStr_(rows[i].TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Đơn này đã được xử lý.' };
    updateRowById(TEN_SHEET.VE_SOM, 'VeSomID', data.veSomID, {
      TrangThai: 'Đã duyệt', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_()
    });
    var cc = findAttendanceRow_(normalizeStr_(rows[i].UserID), normalizeDate_(rows[i].Ngay));
    if (cc) {
      updateRowById(TEN_SHEET.CHAM_CONG, 'ChamCongID', cc.ChamCongID, {
        GhiChuQuanLy: appendGhiChu_(normalizeStr_(cc.GhiChuQuanLy), 'Về sớm CÓ PHÉP từ ' + normalizeStr_(rows[i].GioVeSom) + ' (đơn ' + normalizeStr_(rows[i].VeSomID) + ')')
      });
    }
    writeAttendanceHistory({
      recordID: normalizeStr_(data.veSomID), userID: normalizeStr_(rows[i].UserID), hoTen: normalizeStr_(rows[i].HoTen),
      hanhDong: 'Duyệt về sớm', giaTriCu: 'Chờ duyệt', giaTriMoi: 'Đã duyệt từ ' + normalizeStr_(rows[i].GioVeSom),
      nguoiThucHien: ctx.p.userID, ghiChu: ''
    });
    return { success: true, message: 'Đã duyệt về sớm cho ' + normalizeStr_(rows[i].HoTen) + '.' };
  }
  return { success: false, message: 'Không tìm thấy đơn về sớm.' };
}

function rejectEarlyLeave(data) {
  var ctx = checkModule_('EarlyLeave', data.userID || data.managerUserID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền từ chối về sớm.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var rows = getSheetDataSafe_(TEN_SHEET.VE_SOM);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].VeSomID) !== normalizeStr_(data.veSomID)) continue;
    if (normalizeStr_(rows[i].TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Đơn này đã được xử lý.' };
    updateRowById(TEN_SHEET.VE_SOM, 'VeSomID', data.veSomID, {
      TrangThai: 'Từ chối', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(), LyDoTuChoi: lyDo
    });
    return { success: true, message: 'Đã từ chối đơn về sớm.' };
  }
  return { success: false, message: 'Không tìm thấy đơn về sớm.' };
}

function cancelMyEarlyLeave(data) {
  var ctx = checkModule_('EarlyLeave', data.userID);
  if (ctx.err) return ctx.err;
  var rows = getSheetDataSafe_(TEN_SHEET.VE_SOM);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].VeSomID) !== normalizeStr_(data.veSomID)) continue;
    if (normalizeStr_(rows[i].UserID) !== ctx.p.userID) return { success: false, message: 'Bạn chỉ hủy được đơn của chính mình.' };
    if (normalizeStr_(rows[i].TrangThai) !== 'Chờ duyệt') return { success: false, message: 'Chỉ hủy được đơn đang chờ duyệt.' };
    updateRowById(TEN_SHEET.VE_SOM, 'VeSomID', data.veSomID, { TrangThai: 'Đã hủy' });
    return { success: true, message: 'Đã hủy đơn về sớm.' };
  }
  return { success: false, message: 'Không tìm thấy đơn về sớm.' };
}

// ================== V5 P1: NHÂN VIÊN TỰ ĐĂNG KÝ TĂNG CA ==================

/** data = {userID, ngay, gioBatDau, gioKetThuc, lyDo} - vào chung sheet TANG_CA, luồng duyệt cũ. */
function submitOvertimeRequest(data) {
  var ctx = checkModule_('Overtime', data.userID);
  if (ctx.err) return ctx.err;
  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };
  var bd = hhmmToMin_(data.gioBatDau), kt = hhmmToMin_(data.gioKetThuc);
  if (bd === null || kt === null || kt <= bd) return { success: false, message: 'Giờ bắt đầu/kết thúc không hợp lệ.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do tăng ca.' };
  var soGio = roundWorkHours((kt - bd) / 60, getAttendanceConfigValues().LamTronGioCong);

  var id = generateOvertimeID();
  appendRow(TEN_SHEET.TANG_CA, {
    TangCaID: id,
    UserID: ctx.p.userID, HoTen: ctx.p.hoTen, PhongBan: ctx.p.phongBan,
    Ngay: ngay, GioBatDau: normalizeStr_(data.gioBatDau), GioKetThuc: normalizeStr_(data.gioKetThuc),
    SoGioTangCa: String(soGio), LyDo: lyDo,
    TrangThai: TT_TANG_CA.CHO_DUYET, GhiChu: 'Nhân viên tự đăng ký'
  });
  return { success: true, message: 'Đã đăng ký tăng ca ' + soGio + 'h ngày ' + ngay + '. Chờ quản lý duyệt.', data: { tangCaID: id } };
}

function cancelMyOvertime(data) {
  var ctx = checkModule_('Overtime', data.userID);
  if (ctx.err) return ctx.err;
  var r = timTangCa_(data.tangCaID);
  if (!r) return { success: false, message: 'Không tìm thấy đăng ký tăng ca.' };
  if (normalizeStr_(r.UserID) !== ctx.p.userID) return { success: false, message: 'Bạn chỉ hủy được đăng ký của chính mình.' };
  if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.CHO_DUYET) return { success: false, message: 'Chỉ hủy được đăng ký đang chờ duyệt.' };
  updateRowById(TEN_SHEET.TANG_CA, 'TangCaID', data.tangCaID, { TrangThai: TT_TANG_CA.DA_HUY });
  return { success: true, message: 'Đã hủy đăng ký tăng ca.' };
}

// ================== V5 P2: PHIẾU ĐIỀU CHỈNH CÔNG 2 CẤP (Q1) ==================

// Cấp A (không đổi tiền): PM tạo là hiệu lực ngay. Cấp B (đổi tiền): chủ xưởng duyệt.
var DC_CAP_A = ['BuCheckin', 'BuCheckout', 'MienDiTre', 'MienVeSom', 'GhiChu'];
var DC_CAP_B = ['BoSungCong', 'DieuChinhOT'];
// Tên hiển thị lời thường (mục 9 chỉ đạo)
var DC_TEN = {
  BuCheckin: 'Bù giờ vào (quên chấm)', BuCheckout: 'Bù giờ ra (quên chấm)',
  MienDiTre: 'Miễn ghi nhận đi trễ', MienVeSom: 'Miễn ghi nhận về sớm',
  GhiChu: 'Ghi chú xác minh',
  BoSungCong: 'Đặt lại giờ công của ngày (đổi tiền)', DieuChinhOT: 'Điều chỉnh giờ tăng ca (đổi tiền)'
};

function buildPhieuDCPayload_(r) {
  return {
    phieuID: normalizeStr_(r.PhieuID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    ngay: normalizeDate_(r.Ngay), capDo: normalizeStr_(r.CapDo), loai: normalizeStr_(r.Loai),
    tenLoai: DC_TEN[normalizeStr_(r.Loai)] || normalizeStr_(r.Loai),
    giaTriCu: normalizeStr_(r.GiaTriCu), giaTriMoi: normalizeStr_(r.GiaTriMoi),
    lyDo: normalizeStr_(r.LyDo), nguoiTao: normalizeStr_(r.NguoiTao), thoiGianTao: normalizeStr_(r.ThoiGianTao),
    nguoiDuyet: normalizeStr_(r.NguoiDuyet), thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet),
    trangThai: normalizeStr_(r.TrangThai), ghiChu: normalizeStr_(r.GhiChu)
  };
}

/** Áp 1 phiếu hiệu lực vào bảng công ngày (CHAM_CONG). Tạo dòng nếu chưa có. */
function apDungPhieuDC_(phieu, nguoiThucHien) {
  var uid = normalizeStr_(phieu.UserID);
  var ngay = normalizeDate_(phieu.Ngay);
  var loai = normalizeStr_(phieu.Loai);
  var giaTriMoi = normalizeStr_(phieu.GiaTriMoi);
  var target = getUserById(uid);
  var cc = findAttendanceRow_(uid, ngay);

  if (!cc) {
    var ccID = generateChamCongID();
    appendRow(TEN_SHEET.CHAM_CONG, {
      ChamCongID: ccID, UserID: uid,
      HoTen: target ? normalizeStr_(target.HoTen) : normalizeStr_(phieu.HoTen),
      PhongBan: target ? normalizeStr_(target.PhongBan) : '',
      Ngay: ngay, SoGioLam: '0', DiTre: 'FALSE', SoPhutTre: '0',
      VeSom: 'FALSE', SoPhutVeSom: '0', TangCa: 'FALSE', SoGioTangCa: '0',
      TrangThai: 'Quản lý chỉnh', ThoiGianTao: nowStr_(), ThoiGianCapNhat: nowStr_()
    });
    invalidateSheetCache_(TEN_SHEET.CHAM_CONG);
    cc = findAttendanceRow_(uid, ngay);
  }

  var update = { CoDieuChinh: 'TRUE', NguoiSuaCuoi: nguoiThucHien, ThoiGianCapNhat: nowStr_() };
  if (loai === 'BuCheckin' || loai === 'BuCheckout') {
    var gioVao = loai === 'BuCheckin' ? giaTriMoi : normalizeStr_(cc.GioVao);
    var gioRa = loai === 'BuCheckout' ? giaTriMoi : normalizeStr_(cc.GioRa);
    update[loai === 'BuCheckin' ? 'GioVao' : 'GioRa'] = giaTriMoi;
    if (gioVao && gioRa) {
      var kq = calcAttendanceForUser_(uid, normalizeStr_(cc.PhongBan), ngay, gioVao, gioRa);
      update.CaLam = kq.caLam;
      update.SoGioLam = String(kq.soGioLam);
      update.DiTre = kq.diTre ? 'TRUE' : 'FALSE';
      update.SoPhutTre = String(kq.soPhutTre);
      update.VeSom = kq.veSom ? 'TRUE' : 'FALSE';
      update.SoPhutVeSom = String(kq.soPhutVeSom);
      update.TangCa = kq.tangCa ? 'TRUE' : 'FALSE';
      update.SoGioTangCa = String(kq.soGioTangCa);
      update.TrangThai = 'Quản lý chỉnh';
    }
  } else if (loai === 'MienDiTre') {
    update.DiTre = 'FALSE'; update.SoPhutTre = '0';
  } else if (loai === 'MienVeSom') {
    update.VeSom = 'FALSE'; update.SoPhutVeSom = '0';
  } else if (loai === 'GhiChu') {
    update.GhiChuQuanLy = appendGhiChu_(normalizeStr_(cc.GhiChuQuanLy), giaTriMoi);
  } else if (loai === 'BoSungCong') {
    update.SoGioLam = String(Number(giaTriMoi) || 0);
    update.TrangThai = 'Quản lý chỉnh';
  } else if (loai === 'DieuChinhOT') {
    var otMoi = Number(giaTriMoi) || 0;
    update.SoGioTangCa = String(otMoi);
    update.TangCa = otMoi > 0 ? 'TRUE' : 'FALSE';
  }
  updateRowById(TEN_SHEET.CHAM_CONG, 'ChamCongID', cc.ChamCongID, update);
}

/**
 * Tạo phiếu điều chỉnh. data = {userID, targetUserID, ngay, loai, giaTriMoi, lyDo}
 * Cấp A -> hiệu lực ngay. Cấp B -> chờ chủ xưởng duyệt.
 */
function createAdjustment(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = checkModule_('AttendanceV2', data.userID);
    if (ctx.err) return ctx.err;
    if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền tạo phiếu sửa công.' };

    var target = getUserById(data.targetUserID);
    if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
    var ngay = normalizeDate_(data.ngay);
    if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };
    var chanKhoa = checkKyKhoa_('CONG', ngay); if (chanKhoa) return chanKhoa;

    var loai = normalizeStr_(data.loai);
    var capDo = DC_CAP_A.indexOf(loai) >= 0 ? 'A' : (DC_CAP_B.indexOf(loai) >= 0 ? 'B' : '');
    if (!capDo) return { success: false, message: 'Loại điều chỉnh không hợp lệ.' };
    var giaTriMoi = normalizeStr_(data.giaTriMoi);
    if ((loai === 'BuCheckin' || loai === 'BuCheckout') && hhmmToMin_(giaTriMoi) === null) {
      return { success: false, message: 'Giờ mới không hợp lệ (HH:mm).' };
    }
    if ((loai === 'BoSungCong' || loai === 'DieuChinhOT') && (isNaN(Number(giaTriMoi)) || Number(giaTriMoi) < 0)) {
      return { success: false, message: 'Số giờ mới không hợp lệ.' };
    }
    if (loai === 'GhiChu' && !giaTriMoi) return { success: false, message: 'Nhập nội dung ghi chú.' };
    var lyDo = normalizeStr_(data.lyDo);
    if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do (bắt buộc, sẽ lưu lịch sử).' };

    // Giá trị cũ để đối chiếu lịch sử
    var cc = findAttendanceRow_(normalizeStr_(target.UserID), ngay);
    var giaTriCu = cc
      ? 'Vào ' + (normalizeStr_(cc.GioVao) || '--') + ' / Ra ' + (normalizeStr_(cc.GioRa) || '--') +
        ' / ' + (Number(cc.SoGioLam) || 0) + 'h / OT ' + (Number(cc.SoGioTangCa) || 0) + 'h' +
        (isTrue_(cc.DiTre) ? ' / trễ ' + cc.SoPhutTre + 'p' : '') + (isTrue_(cc.VeSom) ? ' / sớm ' + cc.SoPhutVeSom + 'p' : '')
      : '(chưa có dòng chấm công)';

    var id = 'DC5-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
    var phieu = {
      PhieuID: id, UserID: normalizeStr_(target.UserID), HoTen: normalizeStr_(target.HoTen),
      Ngay: ngay, CapDo: capDo, Loai: loai, GiaTriCu: giaTriCu, GiaTriMoi: giaTriMoi,
      LyDo: lyDo, NguoiTao: ctx.p.userID, ThoiGianTao: nowStr_(),
      TrangThai: capDo === 'A' ? 'HieuLuc' : 'ChoDuyet',
      NguoiDuyet: capDo === 'A' ? ctx.p.userID : '', ThoiGianDuyet: capDo === 'A' ? nowStr_() : ''
    };
    appendRow(TEN_SHEET.DIEU_CHINH_CONG, phieu);
    if (capDo === 'A') apDungPhieuDC_(phieu, ctx.p.userID);

    writeAttendanceHistory({
      recordID: id, userID: normalizeStr_(target.UserID), hoTen: normalizeStr_(target.HoTen),
      hanhDong: (capDo === 'A' ? 'Sửa công (không đổi tiền)' : 'Đề xuất đổi công/tiền') + ': ' + (DC_TEN[loai] || loai),
      giaTriCu: giaTriCu, giaTriMoi: giaTriMoi, nguoiThucHien: ctx.p.userID, ghiChu: lyDo
    });

    return {
      success: true,
      message: capDo === 'A'
        ? 'Đã sửa công cho ' + normalizeStr_(target.HoTen) + ' (có lưu lịch sử).'
        : 'Phiếu đổi công/tiền đã gửi - chờ CHỦ XƯỞNG duyệt mới có hiệu lực.',
      data: { phieuID: id, capDo: capDo }
    };
  } finally {
    lock.releaseLock();
  }
}

function getAdjustments(userID, filters) {
  var ctx = checkModule_('AttendanceV2', userID);
  if (ctx.err) return ctx.err;
  var laQL = ctx.p.duocSuaCong || laChuXuong_(ctx.p.userID);
  var fTT = normalizeStr_((filters || {}).trangThai);
  var list = getSheetDataSafe_(TEN_SHEET.DIEU_CHINH_CONG)
    .map(buildPhieuDCPayload_)
    .filter(function (r) {
      if (!laQL && r.userID !== ctx.p.userID) return false; // NV chỉ thấy phiếu của mình
      if (fTT && r.trangThai !== fTT) return false;
      return true;
    })
    .sort(function (a, b) { return a.thoiGianTao < b.thoiGianTao ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** Chủ xưởng duyệt phiếu cấp B -> áp vào bảng công. */
function approveAdjustment(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = checkModule_('AttendanceV2', data.userID);
    if (ctx.err) return ctx.err;
    if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();

    var rows = getSheetDataSafe_(TEN_SHEET.DIEU_CHINH_CONG);
    for (var i = 0; i < rows.length; i++) {
      if (normalizeStr_(rows[i].PhieuID) !== normalizeStr_(data.phieuID)) continue;
      if (normalizeStr_(rows[i].TrangThai) !== 'ChoDuyet') return { success: false, message: 'Phiếu này đã được xử lý.' };
      var chanKhoa = checkKyKhoa_('CONG', normalizeDate_(rows[i].Ngay)); if (chanKhoa) return chanKhoa;
      var ghiChu2Vai = normalizeStr_(rows[i].NguoiTao) === ctx.p.userID ? 'Chủ xưởng tạo và tự duyệt (ghi rõ 2 vai)' : '';
      updateRowById(TEN_SHEET.DIEU_CHINH_CONG, 'PhieuID', data.phieuID, {
        TrangThai: 'HieuLuc', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(),
        GhiChu: appendGhiChu_(normalizeStr_(rows[i].GhiChu), ghiChu2Vai)
      });
      apDungPhieuDC_(rows[i], ctx.p.userID);
      writeAttendanceHistory({
        recordID: normalizeStr_(data.phieuID), userID: normalizeStr_(rows[i].UserID), hoTen: normalizeStr_(rows[i].HoTen),
        hanhDong: 'Duyệt phiếu đổi công/tiền', giaTriCu: 'ChoDuyet', giaTriMoi: 'HieuLuc',
        nguoiThucHien: ctx.p.userID, ghiChu: ghiChu2Vai
      });
      return { success: true, message: 'Đã duyệt phiếu - đã áp vào bảng công.' };
    }
    return { success: false, message: 'Không tìm thấy phiếu.' };
  } finally {
    lock.releaseLock();
  }
}

function rejectAdjustment(data) {
  var ctx = checkModule_('AttendanceV2', data.userID);
  if (ctx.err) return ctx.err;
  if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var rows = getSheetDataSafe_(TEN_SHEET.DIEU_CHINH_CONG);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].PhieuID) !== normalizeStr_(data.phieuID)) continue;
    if (normalizeStr_(rows[i].TrangThai) !== 'ChoDuyet') return { success: false, message: 'Phiếu này đã được xử lý.' };
    updateRowById(TEN_SHEET.DIEU_CHINH_CONG, 'PhieuID', data.phieuID, {
      TrangThai: 'TuChoi', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(), GhiChu: 'Từ chối: ' + lyDo
    });
    return { success: true, message: 'Đã từ chối phiếu.' };
  }
  return { success: false, message: 'Không tìm thấy phiếu.' };
}

/** Vô hiệu phiếu đã hiệu lực (chủ xưởng). KHÔNG tự hoàn tác dữ liệu - tạo phiếu ngược nếu cần sửa lại. */
function voidAdjustment(data) {
  var ctx = checkModule_('AttendanceV2', data.userID);
  if (ctx.err) return ctx.err;
  if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do vô hiệu.' };
  var rows = getSheetDataSafe_(TEN_SHEET.DIEU_CHINH_CONG);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].PhieuID) !== normalizeStr_(data.phieuID)) continue;
    if (normalizeStr_(rows[i].TrangThai) !== 'HieuLuc') return { success: false, message: 'Chỉ vô hiệu được phiếu đang hiệu lực.' };
    updateRowById(TEN_SHEET.DIEU_CHINH_CONG, 'PhieuID', data.phieuID, {
      TrangThai: 'VoHieu', NguoiVoHieu: ctx.p.userID, ThoiGianVoHieu: nowStr_(), LyDoVoHieu: lyDo
    });
    writeAttendanceHistory({
      recordID: normalizeStr_(data.phieuID), userID: normalizeStr_(rows[i].UserID), hoTen: normalizeStr_(rows[i].HoTen),
      hanhDong: 'Vô hiệu phiếu điều chỉnh', giaTriCu: 'HieuLuc', giaTriMoi: 'VoHieu',
      nguoiThucHien: ctx.p.userID, ghiChu: lyDo + ' | LƯU Ý: dữ liệu công KHÔNG tự hoàn tác - tạo phiếu ngược nếu cần sửa lại.'
    });
    return { success: true, message: 'Đã vô hiệu phiếu. Lưu ý: bảng công không tự hoàn tác - tạo phiếu mới nếu cần chỉnh lại.' };
  }
  return { success: false, message: 'Không tìm thấy phiếu.' };
}

// ================== V5 P3: LỊCH SỬ LƯƠNG + QUYẾT ĐỊNH NHÂN SỰ ==================

/** Cộng n tháng vào 'yyyy-MM-dd' (kẹp cuối tháng). */
function addMonthsStr_(ngayStr, n) {
  var p = String(ngayStr).split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1 + n, Number(p[2]));
  // Kẹp: nếu ngày bị tràn sang tháng sau (VD 31/01 + 1 tháng), lùi về cuối tháng đích
  if (d.getDate() !== Number(p[2])) d = new Date(d.getFullYear(), d.getMonth(), 0);
  return Utilities.formatDate(d, TIMEZONE, 'yyyy-MM-dd');
}

/** Bản ghi lương hiệu lực tại 1 ngày (null nếu không có). */
function timBanGhiLuong_(userID, ngay) {
  var tot = null;
  getSheetDataSafe_(TEN_SHEET.LICH_SU_LUONG).forEach(function (r) {
    if (normalizeStr_(r.UserID) !== normalizeStr_(userID)) return;
    var tu = normalizeDate_(r.HieuLucTu);
    var den = normalizeDate_(r.HieuLucDen);
    if (!isValidDateStr_(tu) || tu > ngay) return;
    if (den && den < ngay) return;
    if (!tot || tu > normalizeDate_(tot.HieuLucTu)) tot = r;
  });
  return tot;
}

/**
 * Lương áp dụng của 1 người tại 1 ngày:
 * ưu tiên LICH_SU_LUONG (khi flag SalaryHistory bật), fallback hồ sơ NHAN_VIEN.
 */
function getLuongApDung_(userID, ngay) {
  if (getModuleState_('SalaryHistory') !== 'FALSE') {
    var r = timBanGhiLuong_(userID, ngay);
    if (r) {
      return {
        luongThang: parseMoney_(r.LuongApDung), luongTheoGio: parseMoney_(r.LuongTheoGio),
        phuCapCoDinh: parseMoney_(r.PhuCapCoDinh), tyLe: Number(r.TyLe) || 100, nguon: 'LICH_SU_LUONG'
      };
    }
  }
  var nv = findEmployeeRow_(userID);
  var p = nv ? buildEmployeePayload_(nv) : { luongCoBan: 0, luongTheoGio: 0, phuCapCoDinh: 0 };
  return { luongThang: p.luongCoBan, luongTheoGio: p.luongTheoGio, phuCapCoDinh: p.phuCapCoDinh, tyLe: 100, nguon: 'NHAN_VIEN' };
}

/** Thêm bản ghi lương MỚI (append-only): đóng HieuLucDen bản hiện hành, không ghi đè. */
function themBanGhiLuong_(target, obj) {
  var uid = normalizeStr_(target.UserID);
  var hieuLucTu = normalizeDate_(obj.hieuLucTu);
  // Đóng bản đang hiện hành (HieuLucDen rỗng) bắt đầu trước bản mới
  getSheetDataSafe_(TEN_SHEET.LICH_SU_LUONG).forEach(function (r) {
    if (normalizeStr_(r.UserID) !== uid) return;
    if (normalizeStr_(r.HieuLucDen)) return;
    if (normalizeDate_(r.HieuLucTu) >= hieuLucTu) return;
    updateRowById(TEN_SHEET.LICH_SU_LUONG, 'LuongID', r.LuongID, { HieuLucDen: addDaysStr_(hieuLucTu, -1) });
  });
  var tyLe = Number(obj.tyLe) || 100;
  var chinhThuc = parseMoney_(obj.luongChinhThuc);
  var id = 'LG-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendRow(TEN_SHEET.LICH_SU_LUONG, {
    LuongID: id, UserID: uid, HoTen: normalizeStr_(target.HoTen),
    LuongChinhThuc: String(chinhThuc), TyLe: String(tyLe),
    LuongApDung: String(Math.round(chinhThuc * tyLe / 100)), // hệ tự tính - không nhập tay
    LuongTheoGio: String(parseMoney_(obj.luongTheoGio)),
    PhuCapCoDinh: String(parseMoney_(obj.phuCapCoDinh)),
    HieuLucTu: hieuLucTu, HieuLucDen: '',
    LyDo: normalizeStr_(obj.lyDo), QuyetDinhID: normalizeStr_(obj.qdID),
    NguoiDuyet: normalizeStr_(obj.nguoiDuyet), ThoiGianTao: nowStr_()
  });
  return id;
}

var DS_LOAI_QD = ['ChinhThuc', 'GiaHanThuViec', 'TangLuong', 'GiamLuong', 'DieuChinhPhuCap', 'ChuyenPhongBan', 'DoiChucVu', 'DoiCaMacDinh', 'TamNghi', 'NghiViec'];
var QD_TEN = {
  ChinhThuc: 'Chuyển chính thức', GiaHanThuViec: 'Gia hạn thử việc', TangLuong: 'Tăng lương',
  GiamLuong: 'Giảm lương', DieuChinhPhuCap: 'Điều chỉnh phụ cấp', ChuyenPhongBan: 'Chuyển phòng ban',
  DoiChucVu: 'Đổi chức vụ', DoiCaMacDinh: 'Đổi ca mặc định', TamNghi: 'Tạm nghỉ', NghiViec: 'Nghỉ việc'
};

/**
 * PM đề xuất quyết định nhân sự. data = {userID, targetUserID, loai, hieuLucTu, lyDo,
 *   luongChinhThuc, tyLe, luongTheoGio, phuCapCoDinh, noiDungMoi}
 * Các trường lương chỉ dùng cho loại liên quan lương.
 */
function createDecision(data) {
  var ctx = checkModule_('SalaryHistory', data.userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền đề xuất quyết định.' };

  var target = getUserById(data.targetUserID);
  if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
  var loai = normalizeStr_(data.loai);
  if (DS_LOAI_QD.indexOf(loai) < 0) return { success: false, message: 'Loại quyết định không hợp lệ.' };
  var hieuLucTu = normalizeDate_(data.hieuLucTu);
  if (!isValidDateStr_(hieuLucTu)) return { success: false, message: 'Ngày hiệu lực không hợp lệ.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do.' };

  var noiDungMoi = normalizeStr_(data.noiDungMoi);
  var lienQuanLuong = ['ChinhThuc', 'TangLuong', 'GiamLuong', 'DieuChinhPhuCap'].indexOf(loai) >= 0;
  if (lienQuanLuong) {
    var chinhThuc = parseMoney_(data.luongChinhThuc);
    if (chinhThuc <= 0 && parseMoney_(data.luongTheoGio) <= 0) {
      return { success: false, message: 'Nhập mức lương mới (lương tháng hoặc lương giờ).' };
    }
    noiDungMoi = JSON.stringify({
      luongChinhThuc: chinhThuc,
      tyLe: loai === 'ChinhThuc' ? 100 : (Number(data.tyLe) || 100),
      luongTheoGio: parseMoney_(data.luongTheoGio),
      phuCapCoDinh: parseMoney_(data.phuCapCoDinh)
    });
  }
  if (!noiDungMoi) return { success: false, message: 'Nhập nội dung mới của quyết định.' };

  var nvRow = findEmployeeRow_(normalizeStr_(target.UserID));
  var nvP = nvRow ? buildEmployeePayload_(nvRow) : null;
  var noiDungCu = nvP
    ? (lienQuanLuong ? 'Lương hiện tại: CB ' + nvP.luongCoBan + ' / giờ ' + nvP.luongTheoGio + ' / PC ' + nvP.phuCapCoDinh
      : loai === 'ChuyenPhongBan' ? nvP.phongBan : loai === 'DoiChucVu' ? nvP.chucVu : normalizeStr_(nvRow.TrangThaiLamViec))
    : '';

  var id = 'QD-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
  appendRow(TEN_SHEET.QUYET_DINH_NHAN_SU, {
    QDID: id, UserID: normalizeStr_(target.UserID), HoTen: normalizeStr_(target.HoTen),
    Loai: loai, NoiDungCu: noiDungCu, NoiDungMoi: noiDungMoi, HieuLucTu: hieuLucTu,
    LyDo: lyDo, NguoiDeXuat: ctx.p.userID, TrangThai: 'ChoDuyet'
  });
  return { success: true, message: 'Đã gửi đề xuất "' + (QD_TEN[loai] || loai) + '" - chờ chủ xưởng duyệt.', data: { qdID: id } };
}

function getDecisions(userID, filters) {
  var ctx = checkModule_('SalaryHistory', userID);
  if (ctx.err) return ctx.err;
  if (!laQuanLy_(ctx.p)) return { success: false, message: 'Bạn không có quyền xem quyết định.' };
  var fTT = normalizeStr_((filters || {}).trangThai);
  var list = getSheetDataSafe_(TEN_SHEET.QUYET_DINH_NHAN_SU)
    .map(function (r) {
      return {
        qdID: normalizeStr_(r.QDID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
        loai: normalizeStr_(r.Loai), tenLoai: QD_TEN[normalizeStr_(r.Loai)] || normalizeStr_(r.Loai),
        noiDungCu: normalizeStr_(r.NoiDungCu), noiDungMoi: normalizeStr_(r.NoiDungMoi),
        hieuLucTu: normalizeDate_(r.HieuLucTu), lyDo: normalizeStr_(r.LyDo),
        nguoiDeXuat: normalizeStr_(r.NguoiDeXuat), nguoiDuyet: normalizeStr_(r.NguoiDuyet),
        thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet), trangThai: normalizeStr_(r.TrangThai)
      };
    })
    .filter(function (r) { return !fTT || r.trangThai === fTT; })
    .sort(function (a, b) { return a.qdID < b.qdID ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** Chủ xưởng duyệt quyết định -> hệ TỰ áp vào hồ sơ + sinh bản ghi lương nếu liên quan. */
function approveDecision(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = checkModule_('SalaryHistory', data.userID);
    if (ctx.err) return ctx.err;
    if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();

    var rows = getSheetDataSafe_(TEN_SHEET.QUYET_DINH_NHAN_SU);
    for (var i = 0; i < rows.length; i++) {
      if (normalizeStr_(rows[i].QDID) !== normalizeStr_(data.qdID)) continue;
      if (normalizeStr_(rows[i].TrangThai) !== 'ChoDuyet') return { success: false, message: 'Quyết định này đã được xử lý.' };

      var r = rows[i];
      var loai = normalizeStr_(r.Loai);
      var uid = normalizeStr_(r.UserID);
      var hieuLucTu = normalizeDate_(r.HieuLucTu);
      var target = getUserById(uid);
      if (!target) return { success: false, message: 'Nhân viên không còn tồn tại.' };

      if (['ChinhThuc', 'TangLuong', 'GiamLuong', 'DieuChinhPhuCap'].indexOf(loai) >= 0) {
        var nd;
        try { nd = JSON.parse(normalizeStr_(r.NoiDungMoi)); } catch (e) { return { success: false, message: 'Nội dung lương của quyết định không hợp lệ.' }; }
        themBanGhiLuong_(target, {
          luongChinhThuc: nd.luongChinhThuc, tyLe: nd.tyLe, luongTheoGio: nd.luongTheoGio,
          phuCapCoDinh: nd.phuCapCoDinh, hieuLucTu: hieuLucTu,
          lyDo: QD_TEN[loai] + ': ' + normalizeStr_(r.LyDo), qdID: normalizeStr_(r.QDID), nguoiDuyet: ctx.p.userID
        });
        if (loai === 'ChinhThuc') {
          updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { NgayChinhThuc: hieuLucTu, ThoiGianCapNhat: nowStr_() });
        }
      } else if (loai === 'GiaHanThuViec') {
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { NgayKetThucThuViec: normalizeDate_(r.NoiDungMoi) || hieuLucTu, ThoiGianCapNhat: nowStr_() });
      } else if (loai === 'ChuyenPhongBan') {
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { PhongBan: normalizeStr_(r.NoiDungMoi), ThoiGianCapNhat: nowStr_() });
        updateRowById(TEN_SHEET.USERS, 'UserID', uid, { PhongBan: normalizeStr_(r.NoiDungMoi) });
      } else if (loai === 'DoiChucVu') {
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { ChucVu: normalizeStr_(r.NoiDungMoi), ThoiGianCapNhat: nowStr_() });
      } else if (loai === 'DoiCaMacDinh') {
        var nvRow = findEmployeeRow_(uid);
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, {
          GhiChu: appendGhiChu_(nvRow ? normalizeStr_(nvRow.GhiChu) : '', 'Ca mặc định mới từ ' + hieuLucTu + ': ' + normalizeStr_(r.NoiDungMoi)),
          ThoiGianCapNhat: nowStr_()
        });
      } else if (loai === 'TamNghi') {
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { TrangThaiLamViec: 'Tạm nghỉ', ThoiGianCapNhat: nowStr_() });
      } else if (loai === 'NghiViec') {
        updateRowById(TEN_SHEET.USERS, 'UserID', uid, { TrangThai: 'Inactive' });
        updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', uid, { TrangThaiLamViec: 'Nghỉ việc', NgayNghiViec: hieuLucTu, ThoiGianCapNhat: nowStr_() });
      }

      updateRowById(TEN_SHEET.QUYET_DINH_NHAN_SU, 'QDID', data.qdID, {
        TrangThai: 'DaDuyet', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_()
      });
      writeAttendanceHistory({
        recordID: normalizeStr_(data.qdID), userID: uid, hoTen: normalizeStr_(r.HoTen),
        hanhDong: 'Duyệt quyết định: ' + (QD_TEN[loai] || loai),
        giaTriCu: normalizeStr_(r.NoiDungCu), giaTriMoi: 'Hiệu lực từ ' + hieuLucTu,
        nguoiThucHien: ctx.p.userID, ghiChu: normalizeStr_(r.LyDo)
      });
      return { success: true, message: 'Đã duyệt "' + (QD_TEN[loai] || loai) + '" cho ' + normalizeStr_(r.HoTen) + ' - hệ thống đã tự áp dụng.' };
    }
    return { success: false, message: 'Không tìm thấy quyết định.' };
  } finally {
    lock.releaseLock();
  }
}

function rejectDecision(data) {
  var ctx = checkModule_('SalaryHistory', data.userID);
  if (ctx.err) return ctx.err;
  if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var found = updateRowById(TEN_SHEET.QUYET_DINH_NHAN_SU, 'QDID', data.qdID, {
    TrangThai: 'TuChoi', NguoiDuyet: ctx.p.userID, ThoiGianDuyet: nowStr_(), GhiChu: 'Từ chối: ' + lyDo
  });
  return found ? { success: true, message: 'Đã từ chối quyết định.' } : { success: false, message: 'Không tìm thấy quyết định.' };
}

function getSalaryHistory(userID, targetUserID) {
  var ctx = checkModule_('SalaryHistory', userID);
  if (ctx.err) return ctx.err;
  var tid = normalizeStr_(targetUserID) || ctx.p.userID;
  if (tid !== ctx.p.userID && !ctx.p.duocXemBangLuong && !laChuXuong_(ctx.p.userID)) {
    return { success: false, message: 'Bạn chỉ xem được lịch sử lương của chính mình.' };
  }
  var list = getSheetDataSafe_(TEN_SHEET.LICH_SU_LUONG)
    .filter(function (r) { return normalizeStr_(r.UserID) === tid; })
    .map(function (r) {
      return {
        luongID: normalizeStr_(r.LuongID), luongChinhThuc: parseMoney_(r.LuongChinhThuc),
        tyLe: Number(r.TyLe) || 100, luongApDung: parseMoney_(r.LuongApDung),
        luongTheoGio: parseMoney_(r.LuongTheoGio), phuCapCoDinh: parseMoney_(r.PhuCapCoDinh),
        hieuLucTu: normalizeDate_(r.HieuLucTu), hieuLucDen: normalizeDate_(r.HieuLucDen),
        lyDo: normalizeStr_(r.LyDo), nguoiDuyet: normalizeStr_(r.NguoiDuyet)
      };
    })
    .sort(function (a, b) { return a.hieuLucTu < b.hieuLucTu ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** Danh sách đến kỳ xét tăng lương (mốc = bản ghi lương mới nhất + 6 tháng, tính từ ngày chính thức). */
function getSalaryReviewDue_() {
  var homNay = todayStr_();
  var kq = [];
  getSheetDataSafe_(TEN_SHEET.NHAN_VIEN).forEach(function (r) {
    if (normalizeStr_(r.TrangThaiLamViec) !== 'Đang làm') return;
    var ngayCT = normalizeDate_(r.NgayChinhThuc);
    if (!isValidDateStr_(ngayCT)) return; // chưa chính thức -> chưa vào chu kỳ
    var uid = normalizeStr_(r.UserID);
    var banGhi = timBanGhiLuong_(uid, homNay);
    var moc = banGhi ? normalizeDate_(banGhi.HieuLucTu) : ngayCT;
    if (moc < ngayCT) moc = ngayCT;
    var denKy = addMonthsStr_(moc, 6);
    var conNgay = dateDiffDays_(homNay, denKy);
    if (conNgay <= 30) kq.push({ userID: uid, hoTen: normalizeStr_(r.HoTen), phongBan: normalizeStr_(r.PhongBan), denKy: denKy, conNgay: conNgay });
  });
  return kq;
}

// ================== V5 P3: BẢNG LƯƠNG V5 (chia giai đoạn + phép 2 ngày/tháng) ==================

/** Công chuẩn của tháng/phòng ban: CAU_HINH_CONG_CHUAN (pb riêng > pb trống) -> CongChuanMacDinh -> 26. */
function getCongChuan_(month, year, phongBan) {
  var kq = null, kqChung = null;
  getSheetDataSafe_(TEN_SHEET.CAU_HINH_CONG_CHUAN).forEach(function (r) {
    if (Number(r.Thang) !== month || Number(r.Nam) !== year) return;
    var pb = normalizeStr_(r.PhongBan);
    var cc = Number(r.CongChuan);
    if (isNaN(cc) || cc <= 0) return;
    if (pb === phongBan) kq = cc;
    if (pb === '') kqChung = cc;
  });
  if (kq) return kq;
  if (kqChung) return kqChung;
  var macDinh = Number(getConfigMap_()['CongChuanMacDinh']);
  return (!isNaN(macDinh) && macDinh > 0) ? macDinh : 26;
}

/** Chia tháng thành các đoạn lương hiệu lực (đúng từng ngày, gộp ngày liên tiếp cùng mức). */
function layDoanLuong_(userID, range) {
  var doans = [];
  var hienTai = null;
  for (var ngay = range.tuNgay; ngay <= range.denNgay; ngay = addDaysStr_(ngay, 1)) {
    var l = getLuongApDung_(userID, ngay);
    var khoa = l.nguon + '|' + l.luongThang + '|' + l.luongTheoGio + '|' + l.tyLe + '|' + l.phuCapCoDinh;
    if (hienTai && hienTai.khoa === khoa) {
      hienTai.den = ngay;
    } else {
      hienTai = { khoa: khoa, tu: ngay, den: ngay, luongThang: l.luongThang, luongTheoGio: l.luongTheoGio, phuCapCoDinh: l.phuCapCoDinh, tyLe: l.tyLe };
      doans.push(hienTai);
    }
  }
  return doans;
}

/**
 * Lõi tính bảng lương V5 cho 1 tháng (Q2 + quy chế phép):
 * Tiền giai đoạn = lương tháng giai đoạn ÷ công chuẩn × công tính lương thực tế giai đoạn.
 * Phép: SoNgayPhepThang (mặc định 2) - nghỉ Có phép đã duyệt hưởng lương tối đa hạn mức;
 * phần hạn mức KHÔNG nghỉ -> cộng tiền tương ứng. Phần nghỉ VƯỢT hạn mức không tính công lương.
 */
function tinhPayrollV5Core_(month, year, fPB) {
  var range = monthRange_(month, year);
  var hanMucPhep = Number(getConfigMap_()['SoNgayPhepThang']);
  if (isNaN(hanMucPhep) || hanMucPhep < 0) hanMucPhep = 2;

  // Gom dữ liệu tháng 1 lần
  var congTheoUser = {}; // uid -> {ngay: {co, gio}}
  var otCham = {};
  getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var uid = normalizeStr_(r.UserID);
    if (!congTheoUser[uid]) congTheoUser[uid] = {};
    var gio = Number(r.SoGioLam) || 0;
    congTheoUser[uid][ngay] = { co: gio > 0 || (normalizeStr_(r.GioVao) && normalizeStr_(r.GioRa)), gio: gio };
    otCham[uid] = (otCham[uid] || 0) + (Number(r.SoGioTangCa) || 0);
  });
  var otDuyet = {};
  getSheetDataSafe_(TEN_SHEET.TANG_CA).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.DA_DUYET) return;
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    otDuyet[normalizeStr_(r.UserID)] = (otDuyet[normalizeStr_(r.UserID)] || 0) + (Number(r.SoGioTangCa) || 0);
  });
  var phepTheoUser = {}; // uid -> [{ngay, qd}] đơn Có phép ĐÃ DUYỆT, sort theo ngày
  getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TRANG_THAI.DA_DUYET) return;
    if (normalizeStr_(r.LoaiNghi) !== 'Có phép') return;
    var ngay = normalizeDate_(r.NgayNghi);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var uid = normalizeStr_(r.UserID);
    if (!phepTheoUser[uid]) phepTheoUser[uid] = [];
    phepTheoUser[uid].push({ ngay: ngay, qd: normalizeStr_(r.CaNghi) === 'FULL' ? 1 : 0.5 });
  });
  Object.keys(phepTheoUser).forEach(function (k) {
    phepTheoUser[k].sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
  });
  var tamUngTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.TAM_UNG).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TT_TAM_UNG.DA_CHI) return;
    var ngay = normalizeDate_(r.NgayDeNghi);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    tamUngTheoUser[normalizeStr_(r.UserID)] = (tamUngTheoUser[normalizeStr_(r.UserID)] || 0) + parseMoney_(r.SoTien);
  });
  var tpTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.THUONG_PHAT).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) === 'Deleted') return;
    if (Number(r.Thang) !== month || Number(r.Nam) !== year) return;
    var uid = normalizeStr_(r.UserID);
    if (!tpTheoUser[uid]) tpTheoUser[uid] = { thuong: 0, phat: 0, phuCap: 0, khauTru: 0 };
    var tien = parseMoney_(r.SoTien);
    var l = normalizeStr_(r.Loai);
    if (l === 'Thưởng') tpTheoUser[uid].thuong += tien;
    else if (l === 'Phạt') tpTheoUser[uid].phat += tien;
    else if (l === 'Phụ cấp') tpTheoUser[uid].phuCap += tien;
    else if (l === 'Khấu trừ') tpTheoUser[uid].khauTru += tien;
  });

  return getSheetDataSafe_(TEN_SHEET.NHAN_VIEN)
    .map(buildEmployeePayload_)
    .filter(function (nv) {
      if (nv.trangThaiLamViec !== 'Đang làm') return false;
      if (fPB && nv.phongBan !== fPB) return false;
      return true;
    })
    .map(function (nv) {
      var uid = nv.userID;
      var congChuan = getCongChuan_(month, year, nv.phongBan);
      var doans = layDoanLuong_(uid, range);
      var congNgay = congTheoUser[uid] || {};

      // Phân bổ phép hưởng lương theo NGÀY PHÁT SINH đến khi hết hạn mức
      var phepHuong = []; // {ngay, qd}
      var quota = hanMucPhep;
      var tongPhepXin = 0;
      (phepTheoUser[uid] || []).forEach(function (x) {
        tongPhepXin += x.qd;
        if (quota <= 0) return;
        var lay = Math.min(x.qd, quota);
        phepHuong.push({ ngay: x.ngay, qd: lay });
        quota = Math.round((quota - lay) * 100) / 100;
      });
      var phepConLai = quota; // phần KHÔNG nghỉ -> cộng tiền
      var phepVuot = Math.max(0, Math.round((tongPhepXin - (hanMucPhep - quota)) * 100) / 100);

      var theoGio = nv.hinhThucLuong === 'Theo giờ';
      var giaiDoan = [];
      var tongTienCong = 0, tongCongTinhLuong = 0, tongGioLam = 0;
      var canhBao = [];

      doans.forEach(function (d) {
        var congThucTe = 0, gioDoan = 0, phepDoan = 0;
        for (var ngay = d.tu; ngay <= d.den; ngay = addDaysStr_(ngay, 1)) {
          var c = congNgay[ngay];
          if (c && c.co) { congThucTe++; gioDoan += c.gio; }
        }
        phepHuong.forEach(function (x) { if (x.ngay >= d.tu && x.ngay <= d.den) phepDoan += x.qd; });

        var congTinhLuong = Math.round((congThucTe + phepDoan) * 100) / 100;
        var tien = 0;
        if (theoGio) {
          tien = Math.round(gioDoan * d.luongTheoGio) + Math.round(phepDoan * 8 * d.luongTheoGio);
          if (d.luongTheoGio <= 0) canhBao.push('Chưa khai lương theo giờ (giai đoạn ' + d.tu + ').');
        } else if (nv.hinhThucLuong === 'Theo tháng') {
          tien = Math.round(d.luongThang / congChuan * congTinhLuong);
          if (d.luongThang <= 0) canhBao.push('Chưa khai mức lương (giai đoạn ' + d.tu + ').');
        } else {
          canhBao.push('Hình thức lương "' + nv.hinhThucLuong + '" - tính tay.');
        }
        tongTienCong += tien;
        tongCongTinhLuong += congTinhLuong;
        tongGioLam += gioDoan;
        giaiDoan.push({
          tu: d.tu, den: d.den, tyLe: d.tyLe,
          moTa: fmtNgayVN_(d.tu) + ' - ' + fmtNgayVN_(d.den) + ': ' + (d.tyLe < 100 ? 'thử việc ' + d.tyLe + '%' : 'chính thức') +
            ' - ' + congTinhLuong + ' công' + (theoGio ? ' (' + Math.round(gioDoan * 100) / 100 + 'h)' : ''),
          luongThang: d.luongThang, congTinhLuong: congTinhLuong, tien: tien
        });
      });

      // Tiền phép KHÔNG nghỉ: đơn giá theo mức lương giai đoạn cuối
      var cuoi = doans[doans.length - 1];
      var donGiaNgay = theoGio ? 8 * cuoi.luongTheoGio : Math.round(cuoi.luongThang / congChuan);
      var tienPhepKhongNghi = Math.round(phepConLai * donGiaNgay);

      var tp = tpTheoUser[uid] || { thuong: 0, phat: 0, phuCap: 0, khauTru: 0 };
      var tamUng = tamUngTheoUser[uid] || 0;
      var tongGioOT = Math.round(((otCham[uid] || 0) + (otDuyet[uid] || 0)) * 100) / 100;
      if (phepVuot > 0) canhBao.push('Nghỉ có phép VƯỢT hạn mức ' + phepVuot + ' ngày - phần vượt không tính công lương.');

      var tong = tongTienCong + tienPhepKhongNghi + cuoi.phuCapCoDinh + tp.thuong + tp.phuCap - tp.phat - tp.khauTru - tamUng;

      return {
        userID: uid, hoTen: nv.hoTen, phongBan: nv.phongBan, hinhThucLuong: nv.hinhThucLuong,
        congChuan: congChuan, giaiDoan: giaiDoan,
        tongCong: tongCongTinhLuong, tongGioLam: Math.round(tongGioLam * 100) / 100, tongGioTangCa: tongGioOT,
        phepDaNghi: Math.round((hanMucPhep - phepConLai) * 100) / 100, phepConLai: phepConLai,
        tienPhepKhongNghi: tienPhepKhongNghi, tienCong: tongTienCong,
        phuCapCoDinh: cuoi.phuCapCoDinh,
        thuong: tp.thuong, phat: tp.phat, phuCap: tp.phuCap, khauTru: tp.khauTru, tamUngDaChi: tamUng,
        thucNhan: tong,
        canhBao: canhBao.join(' ')
      };
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return a.hoTen < b.hoTen ? -1 : 1;
    });
}

function fmtNgayVN_(s) {
  var p = String(s).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : s;
}

/** Bảng lương V5 (xem trước khi chốt). */
function getPayrollV5(userID, month, year, filters) {
  var ctx = checkModule_('SalaryHistory', userID); // RC2: chốt flag - tắt thì dùng lương sơ bộ cũ (getPayrollDraft)
  if (ctx.err) return ctx.err;
  var mgr = checkHRPerm_(userID, 'duocXemBangLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem bảng lương.' };
  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var list = tinhPayrollV5Core_(range.month, range.year, normalizeStr_((filters || {}).phongBan));
  return { success: true, message: 'OK', data: { month: range.month, year: range.year, bangLuong: list } };
}

// ================== V5 P4: KHÓA CÔNG / KHÓA LƯƠNG / SNAPSHOT / KÝ NHẬN ==================

/** Kỳ đang chốt (Đã chốt) của loại CONG/LUONG. */
function getKyKhoaHienHanh_(loai, thang, nam) {
  var kq = null;
  getSheetDataSafe_(TEN_SHEET.CHOT_KY).forEach(function (r) {
    if (normalizeStr_(r.Loai) !== loai) return;
    if (Number(r.Thang) !== thang || Number(r.Nam) !== nam) return;
    if (normalizeStr_(r.TrangThai) !== 'Đã chốt') return;
    kq = r;
  });
  return kq;
}

/**
 * Guard khóa kỳ - được chèn 1 dòng vào 11 hàm ghi cũ (V4 3.2 đã duyệt).
 * Flag PayrollLock = FALSE -> luôn trả null (hành vi V4 nguyên vẹn).
 */
function checkKyKhoa_(loai, ngayStr) {
  if (getModuleState_('PayrollLock') === 'FALSE') return null;
  var ngay = normalizeDate_(ngayStr);
  if (!/^\d{4}-\d{2}/.test(ngay)) return null;
  var thang = Number(ngay.slice(5, 7)), nam = Number(ngay.slice(0, 4));
  if (!getKyKhoaHienHanh_(loai, thang, nam)) return null;
  return {
    success: false,
    message: 'Tháng ' + thang + '/' + nam + ' đã CHỐT ' + (loai === 'LUONG' ? 'LƯƠNG' : 'CÔNG') + '. Liên hệ chủ xưởng để mở khóa nếu thật sự cần sửa.'
  };
}

/** Chốt kỳ. data = {userID, loai: 'CONG'|'LUONG', thang, nam} (LUONG dùng lockPayroll để kèm snapshot). */
function lockPeriod(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ctx = checkModule_('PayrollLock', data.userID);
    if (ctx.err) return ctx.err;
    var loai = normalizeStr_(data.loai);
    if (loai !== 'CONG') return { success: false, message: 'Dùng chức năng Chốt lương để chốt LƯƠNG (kèm snapshot).' };
    if (!ctx.p.duocSuaCong) return { success: false, message: 'Bạn không có quyền chốt công.' };
    var range = monthRange_(data.thang, data.nam);
    if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
    if (getKyKhoaHienHanh_('CONG', range.month, range.year)) {
      return { success: false, message: 'Tháng này ĐANG chốt công - không chốt trùng. Muốn chốt lại phải mở khóa trước.' };
    }
    var lanChot = 1;
    getSheetDataSafe_(TEN_SHEET.CHOT_KY).forEach(function (r) {
      if (normalizeStr_(r.Loai) === 'CONG' && Number(r.Thang) === range.month && Number(r.Nam) === range.year) {
        lanChot = Math.max(lanChot, (Number(r.LanChot) || 0) + 1);
      }
    });
    appendRow(TEN_SHEET.CHOT_KY, {
      ChotID: 'CK-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100),
      Loai: 'CONG', Thang: String(range.month), Nam: String(range.year), LanChot: String(lanChot),
      TrangThai: 'Đã chốt', NguoiChot: ctx.p.userID, ThoiGianChot: nowStr_()
    });
    writeAttendanceHistory({
      recordID: 'CONG-' + range.month + '/' + range.year, userID: '', hoTen: '',
      hanhDong: 'Chốt CÔNG tháng', giaTriCu: '', giaTriMoi: 'Lần ' + lanChot,
      nguoiThucHien: ctx.p.userID, ghiChu: ''
    });
    return { success: true, message: 'Đã CHỐT CÔNG tháng ' + range.month + '/' + range.year + ' (lần ' + lanChot + '). Mọi sửa công/nghỉ/OT của tháng này bị khóa.' };
  } finally {
    lock.releaseLock();
  }
}

/** Chủ xưởng mở khóa kỳ. data = {userID, loai, thang, nam, lyDo} */
function unlockPeriod(data) {
  var ctx = checkModule_('PayrollLock', data.userID);
  if (ctx.err) return ctx.err;
  if (!laChuXuong_(ctx.p.userID)) return loiQuyenChuXuong_();
  var loai = normalizeStr_(data.loai);
  var range = monthRange_(data.thang, data.nam);
  if (!range || ['CONG', 'LUONG'].indexOf(loai) < 0) return { success: false, message: 'Dữ liệu không hợp lệ.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do mở khóa (lưu lịch sử).' };
  var khoa = getKyKhoaHienHanh_(loai, range.month, range.year);
  if (!khoa) return { success: false, message: 'Tháng này không có kỳ ' + loai + ' đang chốt.' };
  if (loai === 'CONG' && getKyKhoaHienHanh_('LUONG', range.month, range.year)) {
    return { success: false, message: 'Phải mở khóa LƯƠNG trước khi mở khóa CÔNG của cùng tháng.' };
  }

  updateRowById(TEN_SHEET.CHOT_KY, 'ChotID', khoa.ChotID, {
    TrangThai: 'Đã mở lại', NguoiMoKhoa: ctx.p.userID, ThoiGianMoKhoa: nowStr_(), GhiChu: lyDo
  });
  // Mở khóa LƯƠNG: snapshot bản đó chuyển HieuLuc=FALSE (KHÔNG xóa - Q10)
  if (loai === 'LUONG') {
    getSheetDataSafe_(TEN_SHEET.BANG_LUONG).forEach(function (r) {
      if (Number(r.Thang) !== range.month || Number(r.Nam) !== range.year) return;
      if (Number(r.LanChot) !== Number(khoa.LanChot)) return;
      if (!isTrue_(r.HieuLuc)) return;
      updateRowById(TEN_SHEET.BANG_LUONG, 'BangLuongID', r.BangLuongID, { HieuLuc: 'FALSE' });
    });
  }
  writeAttendanceHistory({
    recordID: loai + '-' + range.month + '/' + range.year, userID: '', hoTen: '',
    hanhDong: 'MỞ KHÓA kỳ ' + loai, giaTriCu: 'Đã chốt (lần ' + normalizeStr_(khoa.LanChot) + ')', giaTriMoi: 'Đã mở lại',
    nguoiThucHien: ctx.p.userID, ghiChu: lyDo
  });
  return { success: true, message: 'Đã mở khóa ' + loai + ' tháng ' + range.month + '/' + range.year + '.' + (loai === 'LUONG' ? ' Snapshot cũ chuyển hết hiệu lực (không xóa) - chốt lại sẽ tạo bản mới, nhân viên ký lại.' : '') };
}

function getLockStatus(userID, month, year) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  function tt(loai) {
    var k = getKyKhoaHienHanh_(loai, range.month, range.year);
    return k ? { lanChot: Number(k.LanChot) || 1, nguoiChot: normalizeStr_(k.NguoiChot), thoiGianChot: normalizeStr_(k.ThoiGianChot) } : null;
  }
  return { success: true, message: 'OK', data: { month: range.month, year: range.year, cong: tt('CONG'), luong: tt('LUONG') } };
}

/** Chốt LƯƠNG: tính bảng lương V5 -> ghi snapshot BANG_LUONG (LanChot, HieuLuc=TRUE) -> khóa. */
function lockPayroll(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ctx = checkModule_('PayrollLock', data.userID);
    if (ctx.err) return ctx.err;
    if (!ctx.p.duocChotLuong) return { success: false, message: 'Bạn không có quyền chốt lương.' };
    var range = monthRange_(data.thang, data.nam);
    if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
    if (!getKyKhoaHienHanh_('CONG', range.month, range.year)) {
      return { success: false, message: 'Phải CHỐT CÔNG tháng này trước rồi mới chốt lương.' };
    }
    if (getKyKhoaHienHanh_('LUONG', range.month, range.year)) {
      return { success: false, message: 'Tháng này ĐANG chốt lương - không chốt trùng. Mở khóa trước nếu muốn chốt lại.' };
    }
    var lanChot = 1;
    getSheetDataSafe_(TEN_SHEET.CHOT_KY).forEach(function (r) {
      if (normalizeStr_(r.Loai) === 'LUONG' && Number(r.Thang) === range.month && Number(r.Nam) === range.year) {
        lanChot = Math.max(lanChot, (Number(r.LanChot) || 0) + 1);
      }
    });

    var bangLuong = tinhPayrollV5Core_(range.month, range.year, '');
    var thoiGian = nowStr_();
    bangLuong.forEach(function (r, i) {
      appendRow(TEN_SHEET.BANG_LUONG, {
        // RC2 fix: kèm LanChot để ID không trùng giữa các lần chốt (RC1 có thể trùng nếu chốt lại trong cùng giây)
        BangLuongID: 'BL-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-L' + lanChot + '-' + (100 + i),
        Thang: String(range.month), Nam: String(range.year), LanChot: String(lanChot), HieuLuc: 'TRUE',
        UserID: r.userID, HoTen: r.hoTen, PhongBan: r.phongBan, HinhThucLuong: r.hinhThucLuong,
        LuongCoBan: String(r.giaiDoan.length ? r.giaiDoan[r.giaiDoan.length - 1].luongThang : 0),
        LuongTheoGio: '', PhuCapCoDinh: String(r.phuCapCoDinh),
        TongGioLam: String(r.tongGioLam), TongGioTangCa: String(r.tongGioTangCa),
        NghiCoPhep: String(r.phepDaNghi), NghiKhongPhep: '',
        TamUngDaChi: String(r.tamUngDaChi), Thuong: String(r.thuong), Phat: String(r.phat),
        PhuCap: String(r.phuCap), KhauTru: String(r.khauTru), TongTamTinh: String(r.thucNhan),
        GhiChu: JSON.stringify({ giaiDoan: r.giaiDoan, tienPhepKhongNghi: r.tienPhepKhongNghi, phepConLai: r.phepConLai, tongCong: r.tongCong, canhBao: r.canhBao }),
        NguoiChot: ctx.p.userID, ThoiGianChot: thoiGian, DaKyNhan: 'FALSE'
      });
    });
    appendRow(TEN_SHEET.CHOT_KY, {
      ChotID: 'CK-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100),
      Loai: 'LUONG', Thang: String(range.month), Nam: String(range.year), LanChot: String(lanChot),
      TrangThai: 'Đã chốt', NguoiChot: ctx.p.userID, ThoiGianChot: thoiGian
    });
    writeAttendanceHistory({
      recordID: 'LUONG-' + range.month + '/' + range.year, userID: '', hoTen: '',
      hanhDong: 'Chốt LƯƠNG tháng (snapshot)', giaTriCu: '', giaTriMoi: 'Lần ' + lanChot + ' - ' + bangLuong.length + ' nhân viên',
      nguoiThucHien: ctx.p.userID, ghiChu: ''
    });
    // KHÔNG log số tiền ra console (quy tắc V4)
    return { success: true, message: 'Đã CHỐT LƯƠNG tháng ' + range.month + '/' + range.year + ' (lần ' + lanChot + ', ' + bangLuong.length + ' nhân viên). Nhân viên có thể xem phiếu và ký nhận.' };
  } finally {
    lock.releaseLock();
  }
}

function buildBangLuongPayload_(r) {
  var chiTiet = {};
  try { chiTiet = JSON.parse(normalizeStr_(r.GhiChu)) || {}; } catch (e) { chiTiet = {}; }
  return {
    bangLuongID: normalizeStr_(r.BangLuongID), thang: Number(r.Thang), nam: Number(r.Nam),
    lanChot: Number(r.LanChot) || 1, hieuLuc: isTrue_(r.HieuLuc),
    userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen), phongBan: normalizeStr_(r.PhongBan),
    hinhThucLuong: normalizeStr_(r.HinhThucLuong),
    tongGioLam: Number(r.TongGioLam) || 0, tongGioTangCa: Number(r.TongGioTangCa) || 0,
    nghiCoPhep: Number(r.NghiCoPhep) || 0, phuCapCoDinh: parseMoney_(r.PhuCapCoDinh),
    tamUngDaChi: parseMoney_(r.TamUngDaChi), thuong: parseMoney_(r.Thuong), phat: parseMoney_(r.Phat),
    phuCap: parseMoney_(r.PhuCap), khauTru: parseMoney_(r.KhauTru), thucNhan: parseMoney_(r.TongTamTinh),
    giaiDoan: chiTiet.giaiDoan || [], tienPhepKhongNghi: chiTiet.tienPhepKhongNghi || 0,
    phepConLai: chiTiet.phepConLai || 0, tongCong: chiTiet.tongCong || 0, canhBao: chiTiet.canhBao || '',
    nguoiChot: normalizeStr_(r.NguoiChot), thoiGianChot: normalizeStr_(r.ThoiGianChot),
    daKyNhan: isTrue_(r.DaKyNhan), thoiGianKyNhan: normalizeStr_(r.ThoiGianKyNhan)
  };
}

function getLockedPayroll(userID, month, year) {
  var ctx = checkModule_('PayrollLock', userID); // RC2: chốt flag - PayrollLock tắt thì chưa có khái niệm bảng lương đã chốt
  if (ctx.err) return ctx.err;
  var mgr = checkHRPerm_(userID, 'duocXemBangLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem bảng lương đã chốt.' };
  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var list = getSheetDataSafe_(TEN_SHEET.BANG_LUONG)
    .map(buildBangLuongPayload_)
    .filter(function (r) { return r.thang === range.month && r.nam === range.year && r.hieuLuc; })
    .sort(function (a, b) { return a.phongBan < b.phongBan ? -1 : 1; });
  return { success: true, message: 'OK', data: { month: range.month, year: range.year, bangLuong: list } };
}

/** Xuất TSV dán thẳng vào Excel/Google Sheet (mục 3 quyết định Đ3 V4). */
function exportPayrollTSV(userID, month, year) {
  var kq = getLockedPayroll(userID, month, year);
  if (!kq.success) return kq;
  var dong = ['Họ tên\tPhòng ban\tCông\tGiờ làm\tOT\tPhép đã nghỉ\tTiền phép không nghỉ\tPhụ cấp CĐ\tThưởng\tPhụ cấp\tPhạt\tKhấu trừ\tTạm ứng\tTHỰC NHẬN\tĐã ký'];
  kq.data.bangLuong.forEach(function (r) {
    dong.push([r.hoTen, r.phongBan, r.tongCong, r.tongGioLam, r.tongGioTangCa, r.nghiCoPhep,
      r.tienPhepKhongNghi, r.phuCapCoDinh, r.thuong, r.phuCap, r.phat, r.khauTru, r.tamUngDaChi,
      r.thucNhan, r.daKyNhan ? 'Rồi' : 'Chưa'].join('\t'));
  });
  return { success: true, message: 'OK', data: { tsv: dong.join('\n') } };
}

/** Phiếu lương của CHÍNH nhân viên (bản HieuLuc). */
function getMyPayslip(userID, month, year) {
  var ctx = checkModule_('SalaryConfirm', userID);
  if (ctx.err) return ctx.err;
  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var phieu = null;
  getSheetDataSafe_(TEN_SHEET.BANG_LUONG).forEach(function (r) {
    if (normalizeStr_(r.UserID) !== ctx.p.userID) return;
    if (Number(r.Thang) !== range.month || Number(r.Nam) !== range.year) return;
    if (!isTrue_(r.HieuLuc)) return;
    phieu = buildBangLuongPayload_(r);
  });
  if (!phieu) return { success: false, message: 'Tháng ' + range.month + '/' + range.year + ' chưa chốt lương (hoặc bạn không có phiếu).' };
  return { success: true, message: 'OK', data: phieu };
}

/** NV bấm "Tôi đã nhận" - lưu ngày giờ + thiết bị, không gỡ được. */
function confirmSalaryReceived(data) {
  var ctx = checkModule_('SalaryConfirm', data.userID);
  if (ctx.err) return ctx.err;
  var rows = getSheetDataSafe_(TEN_SHEET.BANG_LUONG);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].BangLuongID) !== normalizeStr_(data.bangLuongID)) continue;
    if (normalizeStr_(rows[i].UserID) !== ctx.p.userID) return { success: false, message: 'Bạn chỉ ký nhận được phiếu của chính mình.' };
    if (!isTrue_(rows[i].HieuLuc)) return { success: false, message: 'Phiếu này đã được thay bằng bản chốt mới - mở lại phiếu để ký bản mới.' };
    if (isTrue_(rows[i].DaKyNhan)) return { success: false, message: 'Bạn đã ký nhận phiếu này rồi.' };
    updateRowById(TEN_SHEET.BANG_LUONG, 'BangLuongID', data.bangLuongID, {
      DaKyNhan: 'TRUE', ThoiGianKyNhan: nowStr_(), ThietBiKyNhan: normalizeStr_(data.thietBi).slice(0, 120)
    });
    writeAttendanceHistory({
      recordID: normalizeStr_(data.bangLuongID), userID: ctx.p.userID, hoTen: ctx.p.hoTen,
      hanhDong: 'Ký nhận lương', giaTriCu: '', giaTriMoi: 'Tháng ' + normalizeStr_(rows[i].Thang) + '/' + normalizeStr_(rows[i].Nam) + ' (lần chốt ' + normalizeStr_(rows[i].LanChot) + ')',
      nguoiThucHien: ctx.p.userID, ghiChu: ''
    });
    return { success: true, message: 'Đã ghi nhận: bạn xác nhận ĐÃ NHẬN LƯƠNG. Cảm ơn!' };
  }
  return { success: false, message: 'Không tìm thấy phiếu lương.' };
}

// ================== V5 P4: DASHBOARD CHỦ XƯỞNG (bản gọn - 6 khối) ==================

function getOwnerDashboard(userID) {
  var ctx = checkModule_('OwnerDashboard', userID);
  if (ctx.err) return ctx.err;
  if (!ctx.p.duocXemBangLuong && !laChuXuong_(ctx.p.userID)) {
    return { success: false, message: 'Bạn không có quyền xem dashboard chủ xưởng.' };
  }
  var th = tinhHinhHomNay_();
  var viec = gomViecCanXuLy_(ctx.p);
  var daChot = getSheetDataSafe_(TEN_SHEET.PHIEN_XU_LY_PM).some(function (r) { return normalizeDate_(r.Ngay) === th.ngay; });
  return {
    success: true, message: 'OK',
    data: {
      ngay: th.ngay,
      diLam: th.daVao, tongActive: th.tongActive,
      nghi: th.dsNghi, diTre: th.dsDiTre, chuaRa: th.dsChuaRa, chuaVao: th.dsChuaVao,
      kpi: moduleEnabledFor_('KPI', ctx.p) ? getKPIData_(th.ngay) : null,
      viecPMChuaXuLy: viec.length,
      pmDaChotNgay: daChot,
      nhacNho: moduleEnabledFor_('SalaryHistory', ctx.p) ? getSalaryReviewDue_().length : 0
    }
  };
}

// ================== V3: ID & AUDIT LOG ==================

function generateChamCongID() {
  return 'CC-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}
function generateAttendanceLogID() {
  return 'CL-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}
function generateAdvanceID() {
  return 'TU-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}
function generateBonusPenaltyID() {
  return 'TP-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}
function generateOvertimeID() {
  return 'TC-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}
function generateLichLamID() {
  return 'LL-' + Utilities.formatDate(new Date(), TIMEZONE, 'yyyyMMddHHmmss') + '-' + Math.floor(Math.random() * 900 + 100);
}

/**
 * Audit log nhân sự - ghi vào CHAM_CONG_HISTORY.
 * Sheet này dùng chung cho mọi chỉnh sửa nhân sự của quản lý
 * (sửa công, hồ sơ NV, tạm ứng, thưởng phạt, tăng ca).
 * Cột ChamCongID chứa ID bản ghi liên quan (ChamCongID / UserID / TamUngID / ...).
 * data = { recordID, userID, hoTen, hanhDong, giaTriCu, giaTriMoi, nguoiThucHien, ghiChu }
 */
function writeAttendanceHistory(data) {
  appendRow(TEN_SHEET.CHAM_CONG_HISTORY, {
    LogID: generateAttendanceLogID(),
    ChamCongID: data.recordID || '',
    UserID: data.userID || '',
    HoTen: data.hoTen || '',
    HanhDong: data.hanhDong || '',
    GiaTriCu: data.giaTriCu || '',
    GiaTriMoi: data.giaTriMoi || '',
    NguoiThucHien: data.nguoiThucHien || '',
    ThoiGian: nowStr_(),
    GhiChu: data.ghiChu || ''
  });
}

function getAttendanceHistory(userID, chamCongID) {
  var mgr = checkHRPerm_(userID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem lịch sử chỉnh công.' };
  var id = normalizeStr_(chamCongID);
  // V3.3.3: sheet lịch sử phình to theo thời gian -> chỉ đọc 500 dòng cuối,
  // không getDataRange toàn sheet.
  var list = getSheetDataTail_(TEN_SHEET.CHAM_CONG_HISTORY, 500)
    .filter(function (r) { return !id || normalizeStr_(r.ChamCongID) === id; })
    .map(function (r) {
      return {
        logID: normalizeStr_(r.LogID), recordID: normalizeStr_(r.ChamCongID),
        userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
        hanhDong: normalizeStr_(r.HanhDong), giaTriCu: normalizeStr_(r.GiaTriCu),
        giaTriMoi: normalizeStr_(r.GiaTriMoi), nguoiThucHien: normalizeStr_(r.NguoiThucHien),
        thoiGian: normalizeStr_(r.ThoiGian), ghiChu: normalizeStr_(r.GhiChu)
      };
    });
  return { success: true, message: 'OK', data: list };
}

// ================== V3: CHẤM CÔNG VÀO / RA ==================

function buildAttendancePayload_(r) {
  return {
    chamCongID: normalizeStr_(r.ChamCongID),
    userID: normalizeStr_(r.UserID),
    hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan),
    ngay: normalizeDate_(r.Ngay),
    gioVao: normalizeStr_(r.GioVao),
    gioRa: normalizeStr_(r.GioRa),
    caLam: normalizeStr_(r.CaLam),
    soGioLam: Number(r.SoGioLam) || 0,
    diTre: isTrue_(r.DiTre),
    soPhutTre: Number(r.SoPhutTre) || 0,
    veSom: isTrue_(r.VeSom),
    soPhutVeSom: Number(r.SoPhutVeSom) || 0,
    tangCa: isTrue_(r.TangCa),
    soGioTangCa: Number(r.SoGioTangCa) || 0,
    trangThai: normalizeStr_(r.TrangThai),
    ghiChuNhanVien: normalizeStr_(r.GhiChuNhanVien),
    ghiChuQuanLy: normalizeStr_(r.GhiChuQuanLy),
    nguoiSuaCuoi: normalizeStr_(r.NguoiSuaCuoi),
    thoiGianTao: normalizeStr_(r.ThoiGianTao),
    thoiGianCapNhat: normalizeStr_(r.ThoiGianCapNhat),
    // V3.3: GPS
    viDoVao: normalizeStr_(r.ViDoVao),
    kinhDoVao: normalizeStr_(r.KinhDoVao),
    doChinhXacVao: normalizeStr_(r.DoChinhXacVao),
    khoangCachVao: normalizeStr_(r.KhoangCachVao),
    viDoRa: normalizeStr_(r.ViDoRa),
    kinhDoRa: normalizeStr_(r.KinhDoRa),
    doChinhXacRa: normalizeStr_(r.DoChinhXacRa),
    khoangCachRa: normalizeStr_(r.KhoangCachRa),
    // V5 P2: có phiếu điều chỉnh áp vào dòng này
    coDieuChinh: isTrue_(r.CoDieuChinh)
  };
}

/** Tìm dòng chấm công của 1 user trong 1 ngày (mỗi người mỗi ngày tối đa 1 dòng). */
function findAttendanceRow_(userID, ngay) {
  var rows = getSheetDataSafe_(TEN_SHEET.CHAM_CONG);
  var id = normalizeStr_(userID);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].UserID) === id && normalizeDate_(rows[i].Ngay) === ngay) return rows[i];
  }
  return null;
}

function getTodayAttendance(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var cfg = getAttendanceConfigValues();
  var homNay = todayStr_();
  var row = findAttendanceRow_(userID, homNay);

  // Trạng thái gọn cho frontend:
  // - Chưa có dòng / chưa có GioVao -> "Chưa chấm vào"
  // - Có GioVao, chưa có GioRa      -> "Đã chấm vào"
  // - Có đủ GioVao + GioRa          -> "Đã chấm ra"
  var trangThaiHomNay = 'Chưa chấm vào';
  if (row && normalizeStr_(row.GioVao)) {
    trangThaiHomNay = normalizeStr_(row.GioRa) ? 'Đã chấm ra' : 'Đã chấm vào';
  }

  // V5.0-RC2: fail-closed đơn giản - GPS LUÔN bắt buộc; kèm trạng thái cấu hình
  var vi = getValidAttendanceLocation_();
  var gps = {
    batBuocGPS: true,
    daCauHinhToaDo: !vi.loi,
    loiCauHinh: vi.loi || '',
    banKinhMet: vi.diaDiem ? vi.diaDiem.banKinhMet : 0,
    tenDiaDiem: vi.diaDiem ? vi.diaDiem.tenDiaDiem : ''
  };

  return {
    success: true, message: 'OK',
    data: {
      ngay: homNay,
      gioHienTai: nowHHMM_(),
      choPhepChamCong: isTrue_(cfg.ChoPhepNhanVienChamCong),
      trangThaiHomNay: trangThaiHomNay,
      gps: gps,
      chamCong: row ? buildAttendancePayload_(row) : null
    }
  };
}

/** Nhân viên chấm VÀO. data = { userID, ghiChu } */
function checkIn(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var u = checkUserActive(data.userID);
    if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };

    var cfg = getAttendanceConfigValues();
    if (!isTrue_(cfg.ChoPhepNhanVienChamCong)) {
      return { success: false, message: 'Chấm công đang tạm khóa. Liên hệ quản lý.' };
    }

    var homNay = todayStr_();
    var row = findAttendanceRow_(u.UserID, homNay);
    if (row && normalizeStr_(row.GioVao)) {
      return { success: false, message: 'Bạn đã chấm vào lúc ' + normalizeStr_(row.GioVao) + ' rồi.' };
    }
    if (row && normalizeStr_(row.TrangThai) === 'Nghỉ') {
      return { success: false, message: 'Hôm nay bạn được đánh dấu Nghỉ. Liên hệ quản lý nếu có thay đổi.' };
    }

    // V5.0-RC2: kiểm tra vị trí FAIL-CLOSED đơn giản Ở BACKEND
    var viTri = validateAttendanceLocation_(data.latitude, data.longitude, data.accuracy);
    if (!viTri.ok) return { success: false, message: viTri.message };

    var gioVao = nowHHMM_();
    // V5 P2: ghi EVENT bất biến TRƯỚC khi cập nhật bảng công (flag AttendanceV2).
    // Nếu ghi event thất bại -> throw -> KHÔNG báo chấm công thành công (yêu cầu Q4).
    ghiEventChamCong_('CHECKIN', u, homNay, gioVao, viTri, data.thietBi);
    // V3.2: tính theo giờ chuẩn của lịch riêng / phòng ban / toàn xưởng
    var kq = calcAttendanceForUser_(normalizeStr_(u.UserID), normalizeStr_(u.PhongBan), homNay, gioVao, '');
    var thoiGian = nowStr_();

    var ghiChuNV = normalizeStr_(data.ghiChu);
    if (viTri.canhBao) ghiChuNV = appendGhiChu_(ghiChuNV, viTri.canhBao);

    if (row) {
      // Dòng do quản lý tạo sẵn nhưng chưa có giờ vào -> điền vào
      updateRowById(TEN_SHEET.CHAM_CONG, 'ChamCongID', row.ChamCongID, {
        GioVao: gioVao,
        CaLam: kq.caLam,
        DiTre: kq.diTre ? 'TRUE' : 'FALSE',
        SoPhutTre: String(kq.soPhutTre),
        TrangThai: 'Chưa hoàn tất',
        GhiChuNhanVien: ghiChuNV,
        ThoiGianCapNhat: thoiGian,
        ViDoVao: viTri.viDo, KinhDoVao: viTri.kinhDo,
        DoChinhXacVao: viTri.doChinhXac, KhoangCachVao: viTri.khoangCach
      });
    } else {
      appendRow(TEN_SHEET.CHAM_CONG, {
        ChamCongID: generateChamCongID(),
        UserID: normalizeStr_(u.UserID),
        HoTen: normalizeStr_(u.HoTen),
        PhongBan: normalizeStr_(u.PhongBan),
        Ngay: homNay,
        GioVao: gioVao,
        CaLam: kq.caLam,
        DiTre: kq.diTre ? 'TRUE' : 'FALSE',
        SoPhutTre: String(kq.soPhutTre),
        VeSom: 'FALSE', TangCa: 'FALSE',
        SoGioLam: '0', SoPhutVeSom: '0', SoGioTangCa: '0',
        TrangThai: 'Chưa hoàn tất',
        GhiChuNhanVien: ghiChuNV,
        ThoiGianTao: thoiGian,
        ThoiGianCapNhat: thoiGian,
        ViDoVao: viTri.viDo, KinhDoVao: viTri.kinhDo,
        DoChinhXacVao: viTri.doChinhXac, KhoangCachVao: viTri.khoangCach
      });
    }

    return {
      success: true,
      message: 'Đã chấm vào lúc ' + gioVao +
        (viTri.khoangCach !== '' ? ' (cách xưởng ' + viTri.khoangCach + 'm)' : '') +
        (kq.diTre ? '. Bạn đi trễ ' + kq.soPhutTre + ' phút.' : '. Chúc một ngày làm việc tốt!'),
      warning: [kq.diTre ? 'Đi trễ ' + kq.soPhutTre + ' phút.' : '', viTri.canhBao].filter(function (x) { return x; }).join(' ')
    };
  } finally {
    lock.releaseLock();
  }
}

/** Nhân viên chấm RA. data = { userID, ghiChu } */
function checkOut(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var u = checkUserActive(data.userID);
    if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };

    var cfg = getAttendanceConfigValues();
    if (!isTrue_(cfg.ChoPhepNhanVienChamCong)) {
      return { success: false, message: 'Chấm công đang tạm khóa. Liên hệ quản lý.' };
    }

    var homNay = todayStr_();
    var row = findAttendanceRow_(u.UserID, homNay);
    if (!row || !normalizeStr_(row.GioVao)) {
      return { success: false, message: 'Bạn chưa chấm vào hôm nay. Hãy chấm vào trước.' };
    }
    if (normalizeStr_(row.GioRa)) {
      return { success: false, message: 'Bạn đã chấm ra lúc ' + normalizeStr_(row.GioRa) + ' rồi.' };
    }

    // V5.0-RC2: kiểm tra vị trí FAIL-CLOSED đơn giản Ở BACKEND
    var viTri = validateAttendanceLocation_(data.latitude, data.longitude, data.accuracy);
    if (!viTri.ok) return { success: false, message: viTri.message };

    var gioRa = nowHHMM_();
    // V5 P2: ghi EVENT bất biến trước khi cập nhật bảng công (flag AttendanceV2)
    ghiEventChamCong_('CHECKOUT', row, homNay, gioRa, viTri, data.thietBi);
    // V3.2: tính theo giờ chuẩn của lịch riêng / phòng ban / toàn xưởng
    var kq = calcAttendanceForUser_(normalizeStr_(row.UserID), normalizeStr_(row.PhongBan), homNay, normalizeStr_(row.GioVao), gioRa);
    var ghiChuNV = normalizeStr_(row.GhiChuNhanVien);
    if (normalizeStr_(data.ghiChu)) ghiChuNV = appendGhiChu_(ghiChuNV, normalizeStr_(data.ghiChu));
    if (viTri.canhBao) ghiChuNV = appendGhiChu_(ghiChuNV, viTri.canhBao);

    updateRowById(TEN_SHEET.CHAM_CONG, 'ChamCongID', row.ChamCongID, {
      GioRa: gioRa,
      CaLam: kq.caLam,
      SoGioLam: String(kq.soGioLam),
      DiTre: kq.diTre ? 'TRUE' : 'FALSE',
      SoPhutTre: String(kq.soPhutTre),
      VeSom: kq.veSom ? 'TRUE' : 'FALSE',
      SoPhutVeSom: String(kq.soPhutVeSom),
      TangCa: kq.tangCa ? 'TRUE' : 'FALSE',
      SoGioTangCa: String(kq.soGioTangCa),
      TrangThai: 'Hoàn tất',
      GhiChuNhanVien: ghiChuNV,
      ThoiGianCapNhat: nowStr_(),
      ViDoRa: viTri.viDo, KinhDoRa: viTri.kinhDo,
      DoChinhXacRa: viTri.doChinhXac, KhoangCachRa: viTri.khoangCach
    });

    var msg = 'Đã chấm ra lúc ' + gioRa +
      (viTri.khoangCach !== '' ? ' (cách xưởng ' + viTri.khoangCach + 'm)' : '') +
      '. Giờ làm hôm nay: ' + kq.soGioLam + 'h.';
    if (kq.tangCa) msg += ' Tăng ca: ' + kq.soGioTangCa + 'h.';
    if (kq.veSom) msg += ' (Về sớm ' + kq.soPhutVeSom + ' phút)';
    return { success: true, message: msg };
  } finally {
    lock.releaseLock();
  }
}

// ================== V3: CÔNG CỦA TÔI ==================

/** Khoảng ngày của 1 tháng. Trả null nếu tháng/năm sai. */
function monthRange_(month, year) {
  month = Number(month); year = Number(year);
  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2000 || year > 2100) return null;
  var mm = ('0' + month).slice(-2);
  var soNgay = new Date(year, month, 0).getDate();
  return { tuNgay: year + '-' + mm + '-01', denNgay: year + '-' + mm + '-' + ('0' + soNgay).slice(-2), month: month, year: year };
}

function getMyAttendance(userID, month, year) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };

  var id = normalizeStr_(userID);

  var chamCong = getSheetDataSafe_(TEN_SHEET.CHAM_CONG)
    .filter(function (r) {
      var ngay = normalizeDate_(r.Ngay);
      return normalizeStr_(r.UserID) === id && ngay >= range.tuNgay && ngay <= range.denNgay;
    })
    .map(buildAttendancePayload_)
    .sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });

  var nghi = getSheetData(TEN_SHEET.LICH_NGHI)
    .map(buildLeavePayload_)
    .filter(function (lv) {
      return lv.userID === id && lv.trangThai === TRANG_THAI.DA_DUYET &&
        lv.ngayNghi >= range.tuNgay && lv.ngayNghi <= range.denNgay;
    })
    .sort(function (a, b) { return a.ngayNghi < b.ngayNghi ? -1 : 1; });

  var tangCaDuyet = getSheetDataSafe_(TEN_SHEET.TANG_CA).filter(function (r) {
    var ngay = normalizeDate_(r.Ngay);
    return normalizeStr_(r.UserID) === id && normalizeStr_(r.TrangThai) === TT_TANG_CA.DA_DUYET &&
      ngay >= range.tuNgay && ngay <= range.denNgay;
  });

  var tong = {
    soNgayCong: 0, tongGioLam: 0, tongGioTangCa: 0, soLanDiTre: 0, soLanVeSom: 0,
    nghiCoPhep: 0, nghiKhongPhep: 0, nghiOm: 0, nghiViecRieng: 0, nghiKhac: 0
  };
  chamCong.forEach(function (c) {
    if (c.soGioLam > 0 || (c.gioVao && c.gioRa)) tong.soNgayCong++;
    tong.tongGioLam += c.soGioLam;
    tong.tongGioTangCa += c.soGioTangCa;
    if (c.diTre) tong.soLanDiTre++;
    if (c.veSom) tong.soLanVeSom++;
  });
  tangCaDuyet.forEach(function (r) { tong.tongGioTangCa += Number(r.SoGioTangCa) || 0; });
  nghi.forEach(function (lv) {
    var ngayQD = lv.caNghi === 'FULL' ? 1 : 0.5;
    if (lv.loaiNghi === 'Có phép') tong.nghiCoPhep += ngayQD;
    else if (lv.loaiNghi === 'Không phép') tong.nghiKhongPhep += ngayQD;
    else if (lv.loaiNghi === 'Ốm') tong.nghiOm += ngayQD;
    else if (lv.loaiNghi === 'Việc riêng') tong.nghiViecRieng += ngayQD;
    else tong.nghiKhac += ngayQD;
  });
  tong.tongGioLam = Math.round(tong.tongGioLam * 100) / 100;
  tong.tongGioTangCa = Math.round(tong.tongGioTangCa * 100) / 100;

  return {
    success: true, message: 'OK',
    data: { month: range.month, year: range.year, chamCong: chamCong, nghi: nghi, tongHop: tong }
  };
}

// ================== V3: BẢNG CÔNG NGÀY (QUẢN LÝ) ==================

function getAttendanceByDay(userID, ngay, filters) {
  var mgr = checkHRPerm_(userID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem bảng công.' };

  ngay = normalizeDate_(ngay) || todayStr_();
  var fPB = normalizeStr_((filters || {}).phongBan);
  var fTT = normalizeStr_((filters || {}).trangThai);
  var fUser = normalizeStr_((filters || {}).targetUserID);

  var rows = getSheetDataSafe_(TEN_SHEET.CHAM_CONG)
    .filter(function (r) { return normalizeDate_(r.Ngay) === ngay; })
    .map(buildAttendancePayload_)
    .filter(function (c) {
      if (fPB && c.phongBan !== fPB) return false;
      if (fTT && c.trangThai !== fTT) return false;
      if (fUser && c.userID !== fUser) return false;
      return true;
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return a.hoTen < b.hoTen ? -1 : 1;
    });

  // Nhân viên active chưa có dòng chấm công ngày đó (để quản lý thêm công tay)
  var daCo = {};
  rows.forEach(function (c) { daCo[c.userID] = true; });
  var chuaCham = getSheetData(TEN_SHEET.USERS)
    .filter(function (us) {
      if (!isActive_(us.TrangThai)) return false;
      if (daCo[normalizeStr_(us.UserID)]) return false;
      if (fPB && normalizeStr_(us.PhongBan) !== fPB) return false;
      if (fUser && normalizeStr_(us.UserID) !== fUser) return false;
      return true;
    })
    .map(function (us) {
      return { userID: normalizeStr_(us.UserID), hoTen: normalizeStr_(us.HoTen), phongBan: normalizeStr_(us.PhongBan) };
    });

  return { success: true, message: 'OK', data: { ngay: ngay, chamCong: rows, chuaCham: chuaCham } };
}

/**
 * Quản lý sửa công tay. Bắt buộc lý do nếu cấu hình YeuCauGhiChuKhiSuaCong = TRUE.
 * data = { managerUserID, chamCongID, gioVao, gioRa, trangThai, ghiChuQuanLy, lyDo }
 */
function updateAttendanceByManager(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
    if (!mgr) return { success: false, message: 'Bạn không có quyền sửa công.' };

    var cfg = getAttendanceConfigValues();
    var lyDo = normalizeStr_(data.lyDo);
    if (isTrue_(cfg.YeuCauGhiChuKhiSuaCong) && !lyDo) {
      return { success: false, message: 'Vui lòng nhập lý do chỉnh sửa công.' };
    }

    var rows = getSheetDataSafe_(TEN_SHEET.CHAM_CONG);
    var row = null;
    for (var i = 0; i < rows.length; i++) {
      if (normalizeStr_(rows[i].ChamCongID) === normalizeStr_(data.chamCongID)) { row = rows[i]; break; }
    }
    if (!row) return { success: false, message: 'Không tìm thấy dòng chấm công.' };

    var chanKhoa = checkKyKhoa_('CONG', normalizeDate_(row.Ngay)); if (chanKhoa) return chanKhoa; // V5 P4

    // Giờ mới: nếu không gửi lên thì giữ giá trị cũ
    var gioVao = (data.gioVao !== undefined && data.gioVao !== null && data.gioVao !== '') ? normalizeStr_(data.gioVao) : normalizeStr_(row.GioVao);
    var gioRa = (data.gioRa !== undefined && data.gioRa !== null && data.gioRa !== '') ? normalizeStr_(data.gioRa) : normalizeStr_(row.GioRa);
    if (gioVao && hhmmToMin_(gioVao) === null) return { success: false, message: 'Giờ vào không hợp lệ (HH:mm).' };
    if (gioRa && hhmmToMin_(gioRa) === null) return { success: false, message: 'Giờ ra không hợp lệ (HH:mm).' };

    var trangThai = normalizeStr_(data.trangThai);
    if (DS_TT_CHAM_CONG.indexOf(trangThai) < 0) trangThai = 'Quản lý chỉnh';

    var giaTriCu = 'Vào ' + (normalizeStr_(row.GioVao) || '--') + ' / Ra ' + (normalizeStr_(row.GioRa) || '--') + ' / ' + normalizeStr_(row.TrangThai);

    var update = {
      GioVao: gioVao, GioRa: gioRa, TrangThai: trangThai,
      NguoiSuaCuoi: normalizeStr_(mgr.UserID),
      ThoiGianCapNhat: nowStr_()
    };
    if (data.ghiChuQuanLy !== undefined) update.GhiChuQuanLy = normalizeStr_(data.ghiChuQuanLy);

    // Tính lại chỉ số nếu đủ giờ vào + ra (V3.2: theo giờ chuẩn của người đó)
    if (gioVao && gioRa) {
      var kq = calcAttendanceForUser_(normalizeStr_(row.UserID), normalizeStr_(row.PhongBan), normalizeDate_(row.Ngay), gioVao, gioRa);
      update.CaLam = kq.caLam;
      update.SoGioLam = String(kq.soGioLam);
      update.DiTre = kq.diTre ? 'TRUE' : 'FALSE';
      update.SoPhutTre = String(kq.soPhutTre);
      update.VeSom = kq.veSom ? 'TRUE' : 'FALSE';
      update.SoPhutVeSom = String(kq.soPhutVeSom);
      update.TangCa = kq.tangCa ? 'TRUE' : 'FALSE';
      update.SoGioTangCa = String(kq.soGioTangCa);
    }

    updateRowById(TEN_SHEET.CHAM_CONG, 'ChamCongID', row.ChamCongID, update);
    writeAttendanceHistory({
      recordID: normalizeStr_(row.ChamCongID),
      userID: normalizeStr_(row.UserID), hoTen: normalizeStr_(row.HoTen),
      hanhDong: 'Sửa công',
      giaTriCu: giaTriCu,
      giaTriMoi: 'Vào ' + (gioVao || '--') + ' / Ra ' + (gioRa || '--') + ' / ' + trangThai,
      nguoiThucHien: normalizeStr_(mgr.UserID),
      ghiChu: lyDo
    });

    return { success: true, message: 'Đã sửa công cho ' + normalizeStr_(row.HoTen) + ' và ghi lịch sử.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Quản lý thêm công tay cho nhân viên chưa có dòng chấm công.
 * data = { managerUserID, targetUserID, ngay, gioVao, gioRa, trangThai, ghiChuQuanLy, lyDo }
 */
function createAttendanceByManager(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
    if (!mgr) return { success: false, message: 'Bạn không có quyền thêm công.' };

    var cfg = getAttendanceConfigValues();
    var lyDo = normalizeStr_(data.lyDo);
    if (isTrue_(cfg.YeuCauGhiChuKhiSuaCong) && !lyDo) {
      return { success: false, message: 'Vui lòng nhập lý do thêm công tay.' };
    }

    var target = getUserById(data.targetUserID);
    if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };

    var ngay = normalizeDate_(data.ngay);
    if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };
    var chanKhoa = checkKyKhoa_('CONG', ngay); if (chanKhoa) return chanKhoa; // V5 P4
    if (findAttendanceRow_(target.UserID, ngay)) {
      return { success: false, message: 'Nhân viên đã có dòng chấm công ngày này. Hãy dùng chức năng Sửa.' };
    }

    var gioVao = normalizeStr_(data.gioVao), gioRa = normalizeStr_(data.gioRa);
    if (gioVao && hhmmToMin_(gioVao) === null) return { success: false, message: 'Giờ vào không hợp lệ (HH:mm).' };
    if (gioRa && hhmmToMin_(gioRa) === null) return { success: false, message: 'Giờ ra không hợp lệ (HH:mm).' };

    var trangThai = normalizeStr_(data.trangThai);
    if (DS_TT_CHAM_CONG.indexOf(trangThai) < 0) trangThai = 'Quản lý chỉnh';

    // V3.2: tính theo giờ chuẩn của người được thêm công
    var kq = calcAttendanceForUser_(normalizeStr_(target.UserID), normalizeStr_(target.PhongBan), ngay, gioVao, gioRa);
    var thoiGian = nowStr_();
    var ccID = generateChamCongID();

    appendRow(TEN_SHEET.CHAM_CONG, {
      ChamCongID: ccID,
      UserID: normalizeStr_(target.UserID),
      HoTen: normalizeStr_(target.HoTen),
      PhongBan: normalizeStr_(target.PhongBan),
      Ngay: ngay,
      GioVao: gioVao, GioRa: gioRa,
      CaLam: (gioVao && gioRa) ? kq.caLam : '',
      SoGioLam: String(kq.soGioLam),
      DiTre: kq.diTre ? 'TRUE' : 'FALSE', SoPhutTre: String(kq.soPhutTre),
      VeSom: kq.veSom ? 'TRUE' : 'FALSE', SoPhutVeSom: String(kq.soPhutVeSom),
      TangCa: kq.tangCa ? 'TRUE' : 'FALSE', SoGioTangCa: String(kq.soGioTangCa),
      TrangThai: trangThai,
      GhiChuQuanLy: normalizeStr_(data.ghiChuQuanLy),
      NguoiSuaCuoi: normalizeStr_(mgr.UserID),
      ThoiGianTao: thoiGian, ThoiGianCapNhat: thoiGian
    });
    writeAttendanceHistory({
      recordID: ccID,
      userID: normalizeStr_(target.UserID), hoTen: normalizeStr_(target.HoTen),
      hanhDong: 'Thêm công tay',
      giaTriCu: '',
      giaTriMoi: ngay + ' / Vào ' + (gioVao || '--') + ' / Ra ' + (gioRa || '--') + ' / ' + trangThai,
      nguoiThucHien: normalizeStr_(mgr.UserID),
      ghiChu: lyDo
    });

    return { success: true, message: 'Đã thêm công tay cho ' + normalizeStr_(target.HoTen) + ' ngày ' + ngay + '.' };
  } finally {
    lock.releaseLock();
  }
}

// ================== V3: BẢNG CÔNG THÁNG ==================

function getMonthlyAttendanceReport(userID, month, year, filters) {
  var mgr = checkHRPerm_(userID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem bảng công tháng.' };

  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var fPB = normalizeStr_((filters || {}).phongBan);

  // Gom dữ liệu 1 lần cho cả tháng (tránh đọc sheet lặp)
  var congTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    if (!congTheoUser[id]) congTheoUser[id] = { soNgayCong: 0, tongGioLam: 0, tongGioTangCa: 0, diTre: 0, veSom: 0 };
    var c = congTheoUser[id];
    var gioLam = Number(r.SoGioLam) || 0;
    if (gioLam > 0 || (normalizeStr_(r.GioVao) && normalizeStr_(r.GioRa))) c.soNgayCong++;
    c.tongGioLam += gioLam;
    c.tongGioTangCa += Number(r.SoGioTangCa) || 0;
    if (isTrue_(r.DiTre)) c.diTre++;
    if (isTrue_(r.VeSom)) c.veSom++;
  });

  var nghiTheoUser = {};
  getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TRANG_THAI.DA_DUYET) return; // chỉ tính nghỉ ĐÃ DUYỆT
    var ngay = normalizeDate_(r.NgayNghi);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    if (!nghiTheoUser[id]) nghiTheoUser[id] = { coPhep: 0, khongPhep: 0, om: 0, viecRieng: 0, khac: 0 };
    var ngayQD = normalizeStr_(r.CaNghi) === 'FULL' ? 1 : 0.5;
    var loai = normalizeStr_(r.LoaiNghi);
    if (loai === 'Có phép') nghiTheoUser[id].coPhep += ngayQD;
    else if (loai === 'Không phép') nghiTheoUser[id].khongPhep += ngayQD;
    else if (loai === 'Ốm') nghiTheoUser[id].om += ngayQD;
    else if (loai === 'Việc riêng') nghiTheoUser[id].viecRieng += ngayQD;
    else nghiTheoUser[id].khac += ngayQD;
  });

  var otTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.TANG_CA).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.DA_DUYET) return;
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    otTheoUser[id] = (otTheoUser[id] || 0) + (Number(r.SoGioTangCa) || 0);
  });

  var baoCao = getSheetData(TEN_SHEET.USERS)
    .filter(function (us) {
      if (!isActive_(us.TrangThai)) return false;
      if (fPB && normalizeStr_(us.PhongBan) !== fPB) return false;
      return true;
    })
    .map(function (us) {
      var id = normalizeStr_(us.UserID);
      var c = congTheoUser[id] || { soNgayCong: 0, tongGioLam: 0, tongGioTangCa: 0, diTre: 0, veSom: 0 };
      var n = nghiTheoUser[id] || { coPhep: 0, khongPhep: 0, om: 0, viecRieng: 0, khac: 0 };
      var tongGioTangCa = Math.round((c.tongGioTangCa + (otTheoUser[id] || 0)) * 100) / 100;
      var tongNghiQD = n.coPhep + n.khongPhep + n.om + n.viecRieng + n.khac;
      return {
        userID: id,
        hoTen: normalizeStr_(us.HoTen),
        phongBan: normalizeStr_(us.PhongBan),
        soNgayCong: c.soNgayCong,
        tongGioLam: Math.round(c.tongGioLam * 100) / 100,
        tongGioTangCa: tongGioTangCa,
        soLanDiTre: c.diTre,
        soLanVeSom: c.veSom,
        nghiCoPhep: n.coPhep,
        nghiKhongPhep: n.khongPhep,
        nghiOm: n.om,
        nghiViecRieng: n.viecRieng,
        tongNgayNghiQuyDoi: Math.round(tongNghiQD * 100) / 100,
        // Ngày công quy đổi = tổng giờ làm / 8h (tham khảo, V4 chốt cách tính chính thức)
        soNgayCongQuyDoi: Math.round(c.tongGioLam / 8 * 100) / 100
      };
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return a.hoTen < b.hoTen ? -1 : 1;
    });

  return { success: true, message: 'OK', data: { month: range.month, year: range.year, baoCao: baoCao } };
}

// ================== V3: HỒ SƠ NHÂN VIÊN ==================

function buildEmployeePayload_(r) {
  return {
    userID: normalizeStr_(r.UserID),
    hoTen: normalizeStr_(r.HoTen),
    soDienThoai: normalizeStr_(r.SoDienThoai),
    phongBan: normalizeStr_(r.PhongBan),
    chucVu: normalizeStr_(r.ChucVu),
    ngayVaoLam: normalizeDate_(r.NgayVaoLam),
    ngayNghiViec: normalizeDate_(r.NgayNghiViec),
    hinhThucLuong: normalizeStr_(r.HinhThucLuong),
    luongCoBan: parseMoney_(r.LuongCoBan),
    luongTheoGio: parseMoney_(r.LuongTheoGio),
    phuCapCoDinh: parseMoney_(r.PhuCapCoDinh),
    soTaiKhoan: normalizeStr_(r.SoTaiKhoan),
    tenNganHang: normalizeStr_(r.TenNganHang),
    trangThaiLamViec: normalizeStr_(r.TrangThaiLamViec),
    ghiChu: normalizeStr_(r.GhiChu),
    // V4.0: 2 cột nối cuối NHAN_VIEN (rỗng nếu chưa chạy setupSheetsV4 / chưa nhập)
    ngaySinh: normalizeDate_(r.NgaySinh),
    ngayKetThucThuViec: normalizeDate_(r.NgayKetThucThuViec)
  };
}

function findEmployeeRow_(userID) {
  var rows = getSheetDataSafe_(TEN_SHEET.NHAN_VIEN);
  var id = normalizeStr_(userID);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].UserID) === id) return rows[i];
  }
  return null;
}

function getEmployees(userID, filters) {
  var mgr = checkHRPerm_(userID, 'duocQuanLyNhanSu');
  if (!mgr) return { success: false, message: 'Bạn không có quyền quản lý nhân viên.' };

  var fPB = normalizeStr_((filters || {}).phongBan);
  var fTT = normalizeStr_((filters || {}).trangThai);

  var list = getSheetDataSafe_(TEN_SHEET.NHAN_VIEN)
    .map(buildEmployeePayload_)
    .filter(function (nv) {
      if (fPB && nv.phongBan !== fPB) return false;
      if (fTT && nv.trangThaiLamViec !== fTT) return false;
      return true;
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return a.hoTen < b.hoTen ? -1 : 1;
    });

  return { success: true, message: 'OK', data: list };
}

function getEmployeeDetail(userID, targetUserID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var laQuanLy = !!checkHRPerm_(userID, 'duocQuanLyNhanSu');
  if (!laQuanLy && normalizeStr_(userID) !== normalizeStr_(targetUserID)) {
    return { success: false, message: 'Bạn chỉ được xem hồ sơ của chính mình.' };
  }
  var row = findEmployeeRow_(targetUserID);
  if (!row) return { success: false, message: 'Chưa có hồ sơ nhân viên. Quản lý hãy tạo trong màn Quản lý nhân viên.' };
  return { success: true, message: 'OK', data: buildEmployeePayload_(row) };
}

/** Sinh UserID mới dạng U001, U002... theo số lớn nhất hiện có. */
function generateUserID_() {
  var maxSo = 0;
  getSheetData(TEN_SHEET.USERS).forEach(function (us) {
    var m = normalizeStr_(us.UserID).match(/^U(\d+)$/);
    if (m) maxSo = Math.max(maxSo, Number(m[1]));
  });
  if (maxSo > 0) return 'U' + ('00' + (maxSo + 1)).slice(-3);
  return 'U' + Utilities.formatDate(new Date(), TIMEZONE, 'HHmmss');
}

/**
 * Tạo nhân viên mới: thêm dòng USERS (để đăng nhập) + dòng NHAN_VIEN (hồ sơ).
 * data = { managerUserID, hoTen, maPIN, phongBan, chucVu, soDienThoai, ngayVaoLam,
 *          hinhThucLuong, luongCoBan, luongTheoGio, phuCapCoDinh, soTaiKhoan, tenNganHang, ghiChu }
 */
function createEmployee(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkHRPerm_(data.managerUserID, 'duocQuanLyNhanSu');
    if (!mgr) return { success: false, message: 'Bạn không có quyền thêm nhân viên.' };

    var hoTen = normalizeStr_(data.hoTen);
    var maPIN = normalizeStr_(data.maPIN);
    var phongBan = normalizeStr_(data.phongBan);
    if (!hoTen) return { success: false, message: 'Vui lòng nhập họ tên.' };
    if (!maPIN) return { success: false, message: 'Vui lòng nhập mã PIN.' };
    if (!phongBan) return { success: false, message: 'Vui lòng chọn phòng ban.' };

    // PIN không được trùng với bất kỳ user nào (kể cả đã khóa)
    var users = getSheetData(TEN_SHEET.USERS);
    for (var i = 0; i < users.length; i++) {
      if (normalizeStr_(users[i].MaPIN) === maPIN) {
        return { success: false, message: 'Mã PIN này đã có người dùng. Chọn PIN khác.' };
      }
    }

    var newID = generateUserID_();
    var thoiGian = nowStr_();
    var hinhThucLuong = normalizeStr_(data.hinhThucLuong);
    if (DS_HINH_THUC_LUONG.indexOf(hinhThucLuong) < 0) hinhThucLuong = 'Theo tháng';

    appendRow(TEN_SHEET.USERS, {
      UserID: newID, HoTen: hoTen, MaPIN: maPIN, PhongBan: phongBan,
      VaiTro: 'NhanVien',
      DuocXemDashboard: 'FALSE', DuocDuyetNghi: 'FALSE', DuocSuaCauHinh: 'FALSE',
      TrangThai: 'Active'
    });
    appendRow(TEN_SHEET.NHAN_VIEN, {
      UserID: newID, HoTen: hoTen,
      SoDienThoai: normalizeStr_(data.soDienThoai),
      PhongBan: phongBan,
      ChucVu: normalizeStr_(data.chucVu),
      NgayVaoLam: normalizeDate_(data.ngayVaoLam),
      HinhThucLuong: hinhThucLuong,
      LuongCoBan: String(parseMoney_(data.luongCoBan)),
      LuongTheoGio: String(parseMoney_(data.luongTheoGio)),
      PhuCapCoDinh: String(parseMoney_(data.phuCapCoDinh)),
      SoTaiKhoan: normalizeStr_(data.soTaiKhoan),
      TenNganHang: normalizeStr_(data.tenNganHang),
      TrangThaiLamViec: 'Đang làm',
      GhiChu: normalizeStr_(data.ghiChu),
      NgaySinh: normalizeDate_(data.ngaySinh),
      NgayKetThucThuViec: normalizeDate_(data.ngayKetThucThuViec),
      ThoiGianTao: thoiGian, ThoiGianCapNhat: thoiGian
    });
    writeAttendanceHistory({
      recordID: newID, userID: newID, hoTen: hoTen,
      hanhDong: 'Thêm nhân viên', giaTriCu: '', giaTriMoi: hoTen + ' / ' + phongBan,
      nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
    });

    return { success: true, message: 'Đã thêm nhân viên ' + hoTen + ' (' + newID + '). PIN đăng nhập: ' + maPIN };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Sửa hồ sơ nhân viên. Đồng bộ HoTen/PhongBan/MaPIN sang USERS nếu có gửi lên.
 * data = { managerUserID, targetUserID, ...các field cần sửa }
 */
function updateEmployee(data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var mgr = checkHRPerm_(data.managerUserID, 'duocQuanLyNhanSu');
    if (!mgr) return { success: false, message: 'Bạn không có quyền sửa nhân viên.' };

    var target = getUserById(data.targetUserID);
    if (!target) return { success: false, message: 'Không tìm thấy nhân viên trong USERS.' };
    var targetID = normalizeStr_(target.UserID);

    // Đổi PIN: kiểm tra trùng
    var maPIN = normalizeStr_(data.maPIN);
    if (maPIN) {
      var users = getSheetData(TEN_SHEET.USERS);
      for (var i = 0; i < users.length; i++) {
        if (normalizeStr_(users[i].MaPIN) === maPIN && normalizeStr_(users[i].UserID) !== targetID) {
          return { success: false, message: 'Mã PIN này đã có người dùng. Chọn PIN khác.' };
        }
      }
    }

    // Cập nhật NHAN_VIEN (nếu chưa có hồ sơ thì tạo)
    var capNhat = { ThoiGianCapNhat: nowStr_() };
    if (data.hoTen !== undefined) capNhat.HoTen = normalizeStr_(data.hoTen);
    if (data.soDienThoai !== undefined) capNhat.SoDienThoai = normalizeStr_(data.soDienThoai);
    if (data.phongBan !== undefined) capNhat.PhongBan = normalizeStr_(data.phongBan);
    if (data.chucVu !== undefined) capNhat.ChucVu = normalizeStr_(data.chucVu);
    if (data.ngayVaoLam !== undefined) capNhat.NgayVaoLam = normalizeDate_(data.ngayVaoLam);
    if (data.hinhThucLuong !== undefined && DS_HINH_THUC_LUONG.indexOf(normalizeStr_(data.hinhThucLuong)) >= 0) {
      capNhat.HinhThucLuong = normalizeStr_(data.hinhThucLuong);
    }
    if (data.luongCoBan !== undefined) capNhat.LuongCoBan = String(parseMoney_(data.luongCoBan));
    if (data.luongTheoGio !== undefined) capNhat.LuongTheoGio = String(parseMoney_(data.luongTheoGio));
    if (data.phuCapCoDinh !== undefined) capNhat.PhuCapCoDinh = String(parseMoney_(data.phuCapCoDinh));
    if (data.soTaiKhoan !== undefined) capNhat.SoTaiKhoan = normalizeStr_(data.soTaiKhoan);
    if (data.tenNganHang !== undefined) capNhat.TenNganHang = normalizeStr_(data.tenNganHang);
    if (data.trangThaiLamViec !== undefined) capNhat.TrangThaiLamViec = normalizeStr_(data.trangThaiLamViec);
    if (data.ghiChu !== undefined) capNhat.GhiChu = normalizeStr_(data.ghiChu);
    if (data.ngaySinh !== undefined) capNhat.NgaySinh = normalizeDate_(data.ngaySinh);
    if (data.ngayKetThucThuViec !== undefined) capNhat.NgayKetThucThuViec = normalizeDate_(data.ngayKetThucThuViec);

    var row = findEmployeeRow_(targetID);
    if (row) {
      updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', targetID, capNhat);
    } else {
      capNhat.UserID = targetID;
      capNhat.HoTen = capNhat.HoTen || normalizeStr_(target.HoTen);
      capNhat.PhongBan = capNhat.PhongBan || normalizeStr_(target.PhongBan);
      capNhat.TrangThaiLamViec = capNhat.TrangThaiLamViec || 'Đang làm';
      capNhat.ThoiGianTao = nowStr_();
      appendRow(TEN_SHEET.NHAN_VIEN, capNhat);
    }

    // Đồng bộ sang USERS những trường liên quan đăng nhập
    var capNhatUser = {};
    if (data.hoTen !== undefined) capNhatUser.HoTen = normalizeStr_(data.hoTen);
    if (data.phongBan !== undefined) capNhatUser.PhongBan = normalizeStr_(data.phongBan);
    if (maPIN) capNhatUser.MaPIN = maPIN;
    if (Object.keys(capNhatUser).length > 0) {
      updateRowById(TEN_SHEET.USERS, 'UserID', targetID, capNhatUser);
    }

    writeAttendanceHistory({
      recordID: targetID, userID: targetID, hoTen: normalizeStr_(target.HoTen),
      hanhDong: 'Sửa hồ sơ nhân viên', giaTriCu: '',
      giaTriMoi: Object.keys(capNhat).filter(function (k) { return k !== 'ThoiGianCapNhat'; }).join(', '),
      nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: normalizeStr_(data.lyDo)
    });

    return { success: true, message: 'Đã cập nhật hồ sơ nhân viên.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Khóa nhân viên nghỉ việc: USERS.TrangThai = Inactive, NHAN_VIEN = Nghỉ việc.
 * Không xóa dòng nào để giữ lịch sử.
 * data = { managerUserID, targetUserID, ngayNghiViec, ghiChu }
 */
function deactivateEmployee(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocQuanLyNhanSu');
  if (!mgr) return { success: false, message: 'Bạn không có quyền khóa nhân viên.' };

  var target = getUserById(data.targetUserID);
  if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
  if (normalizeStr_(target.UserID) === normalizeStr_(mgr.UserID)) {
    return { success: false, message: 'Không thể tự khóa tài khoản của chính mình.' };
  }

  var ngayNghiViec = normalizeDate_(data.ngayNghiViec) || todayStr_();

  updateRowById(TEN_SHEET.USERS, 'UserID', target.UserID, { TrangThai: 'Inactive' });
  var row = findEmployeeRow_(target.UserID);
  if (row) {
    updateRowById(TEN_SHEET.NHAN_VIEN, 'UserID', target.UserID, {
      TrangThaiLamViec: 'Nghỉ việc', NgayNghiViec: ngayNghiViec, ThoiGianCapNhat: nowStr_()
    });
  }
  writeAttendanceHistory({
    recordID: normalizeStr_(target.UserID), userID: normalizeStr_(target.UserID), hoTen: normalizeStr_(target.HoTen),
    hanhDong: 'Khóa nhân viên nghỉ việc', giaTriCu: 'Đang làm', giaTriMoi: 'Nghỉ việc từ ' + ngayNghiViec,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: normalizeStr_(data.ghiChu)
  });

  return { success: true, message: 'Đã khóa nhân viên ' + normalizeStr_(target.HoTen) + '. User này không đăng nhập được nữa.' };
}

// ================== V3: DASHBOARD NHÂN SỰ ==================

function getHRDashboard(userID, ngay) {
  var u = checkPermission(userID, 'DuocXemDashboard');
  if (!u) return { success: false, message: 'Bạn không có quyền xem dashboard nhân sự.' };

  ngay = normalizeDate_(ngay) || todayStr_();

  var users = getSheetData(TEN_SHEET.USERS).filter(function (us) { return isActive_(us.TrangThai); });

  // Chấm công của ngày
  var ccTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
    if (normalizeDate_(r.Ngay) !== ngay) return;
    ccTheoUser[normalizeStr_(r.UserID)] = buildAttendancePayload_(r);
  });

  // Nghỉ ĐÃ DUYỆT của ngày
  var nghiTheoUser = {};
  getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
    if (normalizeDate_(r.NgayNghi) !== ngay) return;
    if (normalizeStr_(r.TrangThai) !== TRANG_THAI.DA_DUYET) return;
    nghiTheoUser[normalizeStr_(r.UserID)] = { caNghi: normalizeStr_(r.CaNghi), loaiNghi: normalizeStr_(r.LoaiNghi) };
  });

  var tong = { tongActive: users.length, daChamVao: 0, chuaChamVao: 0, daChamRa: 0, diTre: 0, veSom: 0, nghi: 0, tangCa: 0 };
  var theoPB = {};
  var dsChuaChamVao = [], dsChuaChamRa = [], dsDiTre = [], dsVeSom = [], dsNghi = [];

  users.forEach(function (us) {
    var id = normalizeStr_(us.UserID);
    var pb = normalizeStr_(us.PhongBan);
    var ten = normalizeStr_(us.HoTen);
    if (!theoPB[pb]) theoPB[pb] = { tongActive: 0, coMat: 0, nghi: 0, chuaCham: 0, diTre: 0 };
    theoPB[pb].tongActive++;

    var cc = ccTheoUser[id];
    var nghiInfo = nghiTheoUser[id];

    if (cc && cc.gioVao) {
      // Có mặt (đã chấm vào)
      tong.daChamVao++;
      theoPB[pb].coMat++;
      if (cc.gioRa) tong.daChamRa++;
      else dsChuaChamRa.push({ hoTen: ten, phongBan: pb, gioVao: cc.gioVao });
      if (cc.diTre) { tong.diTre++; theoPB[pb].diTre++; dsDiTre.push({ hoTen: ten, phongBan: pb, soPhutTre: cc.soPhutTre }); }
      if (cc.veSom) { tong.veSom++; dsVeSom.push({ hoTen: ten, phongBan: pb, soPhutVeSom: cc.soPhutVeSom }); }
      if (cc.tangCa) tong.tangCa++;
    } else if (nghiInfo) {
      // Nghỉ đã duyệt (chưa chấm công)
      tong.nghi++;
      theoPB[pb].nghi++;
      dsNghi.push({ hoTen: ten, phongBan: pb, caNghi: nghiInfo.caNghi, loaiNghi: nghiInfo.loaiNghi });
    } else {
      // Chưa chấm vào
      tong.chuaChamVao++;
      theoPB[pb].chuaCham++;
      dsChuaChamVao.push({ hoTen: ten, phongBan: pb });
    }
  });

  // Cảnh báo phòng ban thiếu người (so với nhân sự tối thiểu ca SANG)
  var canhBao = [];
  Object.keys(theoPB).forEach(function (pb) {
    var toiThieu = getMinStaff_(pb, 'SANG');
    if (toiThieu > 0 && theoPB[pb].coMat < toiThieu) {
      canhBao.push(pb + ': chỉ có ' + theoPB[pb].coMat + ' người có mặt, thấp hơn mức tối thiểu ' + toiThieu + ' người.');
    }
  });

  return {
    success: true, message: 'OK',
    data: {
      ngay: ngay,
      tongQuan: tong,
      theoPhongBan: theoPB,
      dsChuaChamVao: dsChuaChamVao,
      dsChuaChamRa: dsChuaChamRa,
      dsDiTre: dsDiTre,
      dsVeSom: dsVeSom,
      dsNghi: dsNghi,
      canhBao: canhBao
    }
  };
}

// ================== V3: CẤU HÌNH CHẤM CÔNG (= CẤU HÌNH NHÂN SỰ) ==================

function getAttendanceConfig(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var p = buildUserPayload_(u);
  if (!p.duocQuanLyNhanSu && !p.duocSuaCong && !p.duocSuaCauHinh) {
    return { success: false, message: 'Bạn không có quyền xem cấu hình nhân sự.' };
  }

  // Trả về sheet + bổ sung các key mặc định chưa có trong sheet
  var trongSheet = {};
  var list = getSheetDataSafe_(TEN_SHEET.CAU_HINH_CHAM_CONG).map(function (r) {
    var key = normalizeStr_(r.Key);
    trongSheet[key] = true;
    return { key: key, value: normalizeStr_(r.Value), ghiChu: normalizeStr_(r.GhiChu) };
  });
  for (var k in CC_MAC_DINH) {
    if (!trongSheet[k]) list.push({ key: k, value: CC_MAC_DINH[k], ghiChu: '(mặc định, chưa lưu vào sheet)' });
  }
  return { success: true, message: 'OK', data: list };
}

/** data = { userID, key, value } */
function updateAttendanceConfig(data) {
  var mgr = checkHRPerm_(data.userID, 'duocQuanLyNhanSu');
  if (!mgr) return { success: false, message: 'Bạn không có quyền sửa cấu hình nhân sự.' };

  var key = normalizeStr_(data.key);
  var value = normalizeStr_(data.value);
  if (!key) return { success: false, message: 'Thiếu Key.' };

  var found = updateRowById(TEN_SHEET.CAU_HINH_CHAM_CONG, 'Key', key, { Value: value });
  if (!found) {
    appendRow(TEN_SHEET.CAU_HINH_CHAM_CONG, { Key: key, Value: value, GhiChu: '' });
  }
  writeAttendanceHistory({
    recordID: key, userID: '', hoTen: '',
    hanhDong: 'Sửa cấu hình nhân sự', giaTriCu: '', giaTriMoi: key + ' = ' + value,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã cập nhật ' + key + ' = ' + value + '.' };
}

// ================== V3: TẠM ỨNG ==================

function buildAdvancePayload_(r) {
  return {
    tamUngID: normalizeStr_(r.TamUngID),
    userID: normalizeStr_(r.UserID),
    hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan),
    ngayDeNghi: normalizeDate_(r.NgayDeNghi),
    soTien: parseMoney_(r.SoTien),
    lyDo: normalizeStr_(r.LyDo),
    trangThai: normalizeStr_(r.TrangThai),
    nguoiDuyet: normalizeStr_(r.NguoiDuyet),
    thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet),
    ghiChu: normalizeStr_(r.GhiChu)
  };
}

/** Nhân viên gửi đề nghị tạm ứng. data = { userID, soTien, lyDo } */
function submitAdvance(data) {
  var u = checkUserActive(data.userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };

  var soTien = parseMoney_(data.soTien);
  var lyDo = normalizeStr_(data.lyDo);
  if (soTien <= 0) return { success: false, message: 'Số tiền tạm ứng không hợp lệ.' };
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do tạm ứng.' };

  var id = generateAdvanceID();
  appendRow(TEN_SHEET.TAM_UNG, {
    TamUngID: id,
    UserID: normalizeStr_(u.UserID), HoTen: normalizeStr_(u.HoTen), PhongBan: normalizeStr_(u.PhongBan),
    NgayDeNghi: todayStr_(), SoTien: String(soTien), LyDo: lyDo,
    TrangThai: TT_TAM_UNG.CHO_DUYET
  });
  return { success: true, message: 'Đã gửi đề nghị tạm ứng ' + soTien.toLocaleString('vi-VN') + 'đ. Chờ quản lý duyệt.', data: { tamUngID: id } };
}

function getMyAdvances(userID) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var id = normalizeStr_(userID);
  var list = getSheetDataSafe_(TEN_SHEET.TAM_UNG)
    .filter(function (r) { return normalizeStr_(r.UserID) === id; })
    .map(buildAdvancePayload_)
    .sort(function (a, b) { return a.ngayDeNghi < b.ngayDeNghi ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

function getAllAdvances(userID, filters) {
  var mgr = checkHRPerm_(userID, 'duocDuyetTamUng');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem tạm ứng.' };

  var fTT = normalizeStr_((filters || {}).trangThai);
  var fPB = normalizeStr_((filters || {}).phongBan);
  var list = getSheetDataSafe_(TEN_SHEET.TAM_UNG)
    .map(buildAdvancePayload_)
    .filter(function (r) {
      if (fTT && r.trangThai !== fTT) return false;
      if (fPB && r.phongBan !== fPB) return false;
      return true;
    })
    .sort(function (a, b) { return a.ngayDeNghi < b.ngayDeNghi ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

function timTamUng_(tamUngID) {
  var rows = getSheetDataSafe_(TEN_SHEET.TAM_UNG);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].TamUngID) === normalizeStr_(tamUngID)) return rows[i];
  }
  return null;
}

/** data = { managerUserID, tamUngID, ghiChu } */
function approveAdvance(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocDuyetTamUng');
  if (!mgr) return { success: false, message: 'Bạn không có quyền duyệt tạm ứng.' };
  var r = timTamUng_(data.tamUngID);
  if (!r) return { success: false, message: 'Không tìm thấy đề nghị tạm ứng.' };
  if (normalizeStr_(r.TrangThai) !== TT_TAM_UNG.CHO_DUYET) {
    return { success: false, message: 'Chỉ duyệt được đề nghị đang "Chờ duyệt".' };
  }
  updateRowById(TEN_SHEET.TAM_UNG, 'TamUngID', r.TamUngID, {
    TrangThai: TT_TAM_UNG.DA_DUYET,
    NguoiDuyet: normalizeStr_(mgr.UserID), ThoiGianDuyet: nowStr_(),
    GhiChu: normalizeStr_(data.ghiChu) || normalizeStr_(r.GhiChu)
  });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.TamUngID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Duyệt tạm ứng', giaTriCu: TT_TAM_UNG.CHO_DUYET, giaTriMoi: TT_TAM_UNG.DA_DUYET,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: normalizeStr_(data.ghiChu)
  });
  return { success: true, message: 'Đã duyệt tạm ứng cho ' + normalizeStr_(r.HoTen) + '.' };
}

/** data = { managerUserID, tamUngID, lyDo } - bắt buộc lý do */
function rejectAdvance(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocDuyetTamUng');
  if (!mgr) return { success: false, message: 'Bạn không có quyền từ chối tạm ứng.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var r = timTamUng_(data.tamUngID);
  if (!r) return { success: false, message: 'Không tìm thấy đề nghị tạm ứng.' };
  if (normalizeStr_(r.TrangThai) !== TT_TAM_UNG.CHO_DUYET) {
    return { success: false, message: 'Chỉ từ chối được đề nghị đang "Chờ duyệt".' };
  }
  updateRowById(TEN_SHEET.TAM_UNG, 'TamUngID', r.TamUngID, {
    TrangThai: TT_TAM_UNG.TU_CHOI,
    NguoiDuyet: normalizeStr_(mgr.UserID), ThoiGianDuyet: nowStr_(),
    GhiChu: appendGhiChu_(normalizeStr_(r.GhiChu), 'Từ chối: ' + lyDo)
  });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.TamUngID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Từ chối tạm ứng', giaTriCu: TT_TAM_UNG.CHO_DUYET, giaTriMoi: TT_TAM_UNG.TU_CHOI,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: lyDo
  });
  return { success: true, message: 'Đã từ chối đề nghị tạm ứng.' };
}

/** data = { managerUserID, tamUngID } - chuyển Đã duyệt -> Đã chi */
function markAdvancePaid(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocDuyetTamUng');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xác nhận chi.' };
  var r = timTamUng_(data.tamUngID);
  if (!r) return { success: false, message: 'Không tìm thấy đề nghị tạm ứng.' };
  var chanKhoa = checkKyKhoa_('LUONG', normalizeDate_(r.NgayDeNghi)); if (chanKhoa) return chanKhoa; // V5 P4 (Q chốt: chỉ markAdvancePaid)
  if (normalizeStr_(r.TrangThai) !== TT_TAM_UNG.DA_DUYET) {
    return { success: false, message: 'Chỉ đánh dấu "Đã chi" cho đề nghị "Đã duyệt".' };
  }
  updateRowById(TEN_SHEET.TAM_UNG, 'TamUngID', r.TamUngID, { TrangThai: TT_TAM_UNG.DA_CHI });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.TamUngID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Đã chi tạm ứng', giaTriCu: TT_TAM_UNG.DA_DUYET, giaTriMoi: TT_TAM_UNG.DA_CHI,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã đánh dấu ĐÃ CHI cho ' + normalizeStr_(r.HoTen) + '.' };
}

// ================== V3: THƯỞNG / PHẠT / PHỤ CẤP / KHẤU TRỪ ==================

function buildBonusPayload_(r) {
  return {
    thuongPhatID: normalizeStr_(r.ThuongPhatID),
    userID: normalizeStr_(r.UserID),
    hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan),
    thang: Number(r.Thang) || 0,
    nam: Number(r.Nam) || 0,
    loai: normalizeStr_(r.Loai),
    soTien: parseMoney_(r.SoTien),
    lyDo: normalizeStr_(r.LyDo),
    nguoiTao: normalizeStr_(r.NguoiTao),
    thoiGianTao: normalizeStr_(r.ThoiGianTao),
    ghiChu: normalizeStr_(r.GhiChu)
  };
}

/** data = { managerUserID, targetUserID, thang, nam, loai, soTien, lyDo, ghiChu } */
function createBonusPenalty(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocChotLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền thêm thưởng/phạt.' };

  var target = getUserById(data.targetUserID);
  if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
  var loai = normalizeStr_(data.loai);
  if (DS_LOAI_THUONG_PHAT.indexOf(loai) < 0) return { success: false, message: 'Loại không hợp lệ.' };
  var soTien = parseMoney_(data.soTien);
  if (soTien <= 0) return { success: false, message: 'Số tiền không hợp lệ.' };
  var range = monthRange_(data.thang, data.nam);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var chanKhoa = checkKyKhoa_('LUONG', range.tuNgay); if (chanKhoa) return chanKhoa; // V5 P4
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do.' };

  var id = generateBonusPenaltyID();
  appendRow(TEN_SHEET.THUONG_PHAT, {
    ThuongPhatID: id,
    UserID: normalizeStr_(target.UserID), HoTen: normalizeStr_(target.HoTen), PhongBan: normalizeStr_(target.PhongBan),
    Thang: String(range.month), Nam: String(range.year),
    Loai: loai, SoTien: String(soTien), LyDo: lyDo,
    NguoiTao: normalizeStr_(mgr.UserID), ThoiGianTao: nowStr_(),
    GhiChu: normalizeStr_(data.ghiChu), TrangThai: 'Active'
  });
  writeAttendanceHistory({
    recordID: id, userID: normalizeStr_(target.UserID), hoTen: normalizeStr_(target.HoTen),
    hanhDong: 'Thêm ' + loai, giaTriCu: '', giaTriMoi: soTien.toLocaleString('vi-VN') + 'đ - ' + lyDo,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã thêm ' + loai + ' ' + soTien.toLocaleString('vi-VN') + 'đ cho ' + normalizeStr_(target.HoTen) + '.' };
}

function getBonusPenaltyList(userID, filters) {
  var mgr = checkHRPerm_(userID, 'duocXemBangLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem thưởng/phạt.' };

  var fThang = Number((filters || {}).thang) || 0;
  var fNam = Number((filters || {}).nam) || 0;
  var fPB = normalizeStr_((filters || {}).phongBan);

  var list = getSheetDataSafe_(TEN_SHEET.THUONG_PHAT)
    .filter(function (r) { return normalizeStr_(r.TrangThai) !== 'Deleted'; }) // xóa mềm
    .map(buildBonusPayload_)
    .filter(function (r) {
      if (fThang && r.thang !== fThang) return false;
      if (fNam && r.nam !== fNam) return false;
      if (fPB && r.phongBan !== fPB) return false;
      return true;
    })
    .sort(function (a, b) { return a.thoiGianTao < b.thoiGianTao ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

/** data = { managerUserID, thuongPhatID, soTien, lyDo, loai, ghiChu } */
function updateBonusPenalty(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocChotLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền sửa thưởng/phạt.' };

  var rows = getSheetDataSafe_(TEN_SHEET.THUONG_PHAT);
  var r = null;
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].ThuongPhatID) === normalizeStr_(data.thuongPhatID)) { r = rows[i]; break; }
  }
  if (!r || normalizeStr_(r.TrangThai) === 'Deleted') return { success: false, message: 'Không tìm thấy khoản thưởng/phạt.' };
  var chanKhoa = checkKyKhoa_('LUONG', normalizeStr_(r.Nam) + '-' + ('0' + Number(r.Thang)).slice(-2) + '-01'); if (chanKhoa) return chanKhoa; // V5 P4

  var update = {};
  if (data.soTien !== undefined) {
    var soTien = parseMoney_(data.soTien);
    if (soTien <= 0) return { success: false, message: 'Số tiền không hợp lệ.' };
    update.SoTien = String(soTien);
  }
  if (data.lyDo !== undefined && normalizeStr_(data.lyDo)) update.LyDo = normalizeStr_(data.lyDo);
  if (data.loai !== undefined && DS_LOAI_THUONG_PHAT.indexOf(normalizeStr_(data.loai)) >= 0) update.Loai = normalizeStr_(data.loai);
  if (data.ghiChu !== undefined) update.GhiChu = normalizeStr_(data.ghiChu);
  if (Object.keys(update).length === 0) return { success: false, message: 'Không có gì để cập nhật.' };

  updateRowById(TEN_SHEET.THUONG_PHAT, 'ThuongPhatID', r.ThuongPhatID, update);
  writeAttendanceHistory({
    recordID: normalizeStr_(r.ThuongPhatID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Sửa thưởng/phạt',
    giaTriCu: normalizeStr_(r.Loai) + ' ' + normalizeStr_(r.SoTien) + ' - ' + normalizeStr_(r.LyDo),
    giaTriMoi: JSON.stringify(update),
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã cập nhật khoản thưởng/phạt.' };
}

/** Xóa mềm (đánh dấu Deleted, không mất lịch sử). data = { managerUserID, thuongPhatID, lyDo } */
function deleteBonusPenalty(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocChotLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xóa thưởng/phạt.' };

  var rows = getSheetDataSafe_(TEN_SHEET.THUONG_PHAT);
  var r = null;
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].ThuongPhatID) === normalizeStr_(data.thuongPhatID)) { r = rows[i]; break; }
  }
  if (!r) return { success: false, message: 'Không tìm thấy khoản thưởng/phạt.' };
  var chanKhoa = checkKyKhoa_('LUONG', normalizeStr_(r.Nam) + '-' + ('0' + Number(r.Thang)).slice(-2) + '-01'); if (chanKhoa) return chanKhoa; // V5 P4

  updateRowById(TEN_SHEET.THUONG_PHAT, 'ThuongPhatID', r.ThuongPhatID, { TrangThai: 'Deleted' });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.ThuongPhatID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Xóa thưởng/phạt (xóa mềm)',
    giaTriCu: normalizeStr_(r.Loai) + ' ' + normalizeStr_(r.SoTien) + ' - ' + normalizeStr_(r.LyDo),
    giaTriMoi: 'Deleted',
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: normalizeStr_(data.lyDo)
  });
  return { success: true, message: 'Đã xóa khoản thưởng/phạt (giữ lại trong sheet để tra cứu).' };
}

// ================== V3: BẢNG LƯƠNG SƠ BỘ ==================

/**
 * Bảng lương sơ bộ V3.
 * - Theo giờ:  TongGioLam * LuongTheoGio + PhuCapCoDinh + Thưởng + Phụ cấp - Phạt - Khấu trừ - Tạm ứng đã chi
 * - Theo tháng: LuongCoBan + PhuCapCoDinh + Thưởng + Phụ cấp - Phạt - Khấu trừ - Tạm ứng đã chi
 * - Khoán/Khác: chỉ cộng/trừ các khoản, kèm cảnh báo "Cần kiểm tra lại".
 * Lưu ý V4: chưa tính hệ số tăng ca, chưa trừ lương ngày nghỉ không phép.
 */
function getPayrollDraft(userID, month, year, filters) {
  var mgr = checkHRPerm_(userID, 'duocXemBangLuong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem bảng lương.' };

  var range = monthRange_(month, year);
  if (!range) return { success: false, message: 'Tháng/năm không hợp lệ.' };
  var fPB = normalizeStr_((filters || {}).phongBan);

  // Gom số liệu tháng theo user
  var congTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.CHAM_CONG).forEach(function (r) {
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    if (!congTheoUser[id]) congTheoUser[id] = { gioLam: 0, gioTangCa: 0 };
    congTheoUser[id].gioLam += Number(r.SoGioLam) || 0;
    congTheoUser[id].gioTangCa += Number(r.SoGioTangCa) || 0;
  });
  getSheetDataSafe_(TEN_SHEET.TANG_CA).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.DA_DUYET) return;
    var ngay = normalizeDate_(r.Ngay);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    if (!congTheoUser[id]) congTheoUser[id] = { gioLam: 0, gioTangCa: 0 };
    congTheoUser[id].gioTangCa += Number(r.SoGioTangCa) || 0;
  });

  var nghiTheoUser = {};
  getSheetData(TEN_SHEET.LICH_NGHI).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TRANG_THAI.DA_DUYET) return;
    var ngay = normalizeDate_(r.NgayNghi);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    if (!nghiTheoUser[id]) nghiTheoUser[id] = { coPhep: 0, khongPhep: 0 };
    var ngayQD = normalizeStr_(r.CaNghi) === 'FULL' ? 1 : 0.5;
    if (normalizeStr_(r.LoaiNghi) === 'Có phép') nghiTheoUser[id].coPhep += ngayQD;
    else if (normalizeStr_(r.LoaiNghi) === 'Không phép') nghiTheoUser[id].khongPhep += ngayQD;
  });

  // Tạm ứng ĐÃ CHI trong tháng (theo ngày đề nghị)
  var tamUngTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.TAM_UNG).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) !== TT_TAM_UNG.DA_CHI) return;
    var ngay = normalizeDate_(r.NgayDeNghi);
    if (ngay < range.tuNgay || ngay > range.denNgay) return;
    var id = normalizeStr_(r.UserID);
    tamUngTheoUser[id] = (tamUngTheoUser[id] || 0) + parseMoney_(r.SoTien);
  });

  var tpTheoUser = {};
  getSheetDataSafe_(TEN_SHEET.THUONG_PHAT).forEach(function (r) {
    if (normalizeStr_(r.TrangThai) === 'Deleted') return;
    if (Number(r.Thang) !== range.month || Number(r.Nam) !== range.year) return;
    var id = normalizeStr_(r.UserID);
    if (!tpTheoUser[id]) tpTheoUser[id] = { thuong: 0, phat: 0, phuCap: 0, khauTru: 0 };
    var tien = parseMoney_(r.SoTien);
    var loai = normalizeStr_(r.Loai);
    if (loai === 'Thưởng') tpTheoUser[id].thuong += tien;
    else if (loai === 'Phạt') tpTheoUser[id].phat += tien;
    else if (loai === 'Phụ cấp') tpTheoUser[id].phuCap += tien;
    else if (loai === 'Khấu trừ') tpTheoUser[id].khauTru += tien;
  });

  var bangLuong = getSheetDataSafe_(TEN_SHEET.NHAN_VIEN)
    .map(buildEmployeePayload_)
    .filter(function (nv) {
      if (nv.trangThaiLamViec !== 'Đang làm') return false;
      if (fPB && nv.phongBan !== fPB) return false;
      return true;
    })
    .map(function (nv) {
      var cong = congTheoUser[nv.userID] || { gioLam: 0, gioTangCa: 0 };
      var nghi = nghiTheoUser[nv.userID] || { coPhep: 0, khongPhep: 0 };
      var tamUng = tamUngTheoUser[nv.userID] || 0;
      var tp = tpTheoUser[nv.userID] || { thuong: 0, phat: 0, phuCap: 0, khauTru: 0 };

      var luongGoc = 0;
      var canhBao = '';
      if (nv.hinhThucLuong === 'Theo giờ') {
        luongGoc = Math.round(cong.gioLam * nv.luongTheoGio);
        if (nv.luongTheoGio <= 0) canhBao = 'Cần kiểm tra lại: chưa khai lương theo giờ.';
        else if (cong.gioLam <= 0) canhBao = 'Cần kiểm tra lại: chưa có giờ công trong tháng.';
      } else if (nv.hinhThucLuong === 'Theo tháng') {
        luongGoc = nv.luongCoBan;
        if (nv.luongCoBan <= 0) canhBao = 'Cần kiểm tra lại: chưa khai lương cơ bản.';
      } else {
        canhBao = 'Cần kiểm tra lại: hình thức lương "' + nv.hinhThucLuong + '" tính tay ở V3.';
      }

      var tongTamTinh = luongGoc + nv.phuCapCoDinh + tp.thuong + tp.phuCap - tp.phat - tp.khauTru - tamUng;

      return {
        userID: nv.userID, hoTen: nv.hoTen, phongBan: nv.phongBan,
        hinhThucLuong: nv.hinhThucLuong,
        luongCoBan: nv.luongCoBan, luongTheoGio: nv.luongTheoGio, phuCapCoDinh: nv.phuCapCoDinh,
        tongGioLam: Math.round(cong.gioLam * 100) / 100,
        tongGioTangCa: Math.round(cong.gioTangCa * 100) / 100,
        nghiCoPhep: nghi.coPhep, nghiKhongPhep: nghi.khongPhep,
        tamUngDaChi: tamUng,
        thuong: tp.thuong, phat: tp.phat, phuCap: tp.phuCap, khauTru: tp.khauTru,
        tongTamTinh: tongTamTinh,
        canhBao: canhBao
      };
    })
    .sort(function (a, b) {
      if (a.phongBan !== b.phongBan) return a.phongBan < b.phongBan ? -1 : 1;
      return a.hoTen < b.hoTen ? -1 : 1;
    });

  return { success: true, message: 'OK', data: { month: range.month, year: range.year, bangLuong: bangLuong } };
}

// ================== V3: TĂNG CA ==================

function buildOvertimePayload_(r) {
  return {
    tangCaID: normalizeStr_(r.TangCaID),
    userID: normalizeStr_(r.UserID),
    hoTen: normalizeStr_(r.HoTen),
    phongBan: normalizeStr_(r.PhongBan),
    ngay: normalizeDate_(r.Ngay),
    gioBatDau: normalizeStr_(r.GioBatDau),
    gioKetThuc: normalizeStr_(r.GioKetThuc),
    soGioTangCa: Number(r.SoGioTangCa) || 0,
    lyDo: normalizeStr_(r.LyDo),
    trangThai: normalizeStr_(r.TrangThai),
    nguoiDuyet: normalizeStr_(r.NguoiDuyet),
    thoiGianDuyet: normalizeStr_(r.ThoiGianDuyet),
    ghiChu: normalizeStr_(r.GhiChu)
  };
}

/**
 * Quản lý tạo tăng ca thay nhân viên.
 * data = { managerUserID, targetUserID, ngay, gioBatDau, gioKetThuc, lyDo, duyetLuon }
 */
function createOvertime(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền tạo tăng ca.' };

  var target = getUserById(data.targetUserID);
  if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };

  var bd = hhmmToMin_(data.gioBatDau), kt = hhmmToMin_(data.gioKetThuc);
  if (bd === null || kt === null || kt <= bd) return { success: false, message: 'Giờ bắt đầu/kết thúc không hợp lệ.' };
  var soGio = roundWorkHours((kt - bd) / 60, getAttendanceConfigValues().LamTronGioCong);
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do tăng ca.' };

  var duyetLuon = data.duyetLuon === true;
  var id = generateOvertimeID();
  appendRow(TEN_SHEET.TANG_CA, {
    TangCaID: id,
    UserID: normalizeStr_(target.UserID), HoTen: normalizeStr_(target.HoTen), PhongBan: normalizeStr_(target.PhongBan),
    Ngay: ngay,
    GioBatDau: normalizeStr_(data.gioBatDau), GioKetThuc: normalizeStr_(data.gioKetThuc),
    SoGioTangCa: String(soGio), LyDo: lyDo,
    TrangThai: duyetLuon ? TT_TANG_CA.DA_DUYET : TT_TANG_CA.CHO_DUYET,
    NguoiDuyet: duyetLuon ? normalizeStr_(mgr.UserID) : '',
    ThoiGianDuyet: duyetLuon ? nowStr_() : ''
  });
  writeAttendanceHistory({
    recordID: id, userID: normalizeStr_(target.UserID), hoTen: normalizeStr_(target.HoTen),
    hanhDong: 'Tạo tăng ca', giaTriCu: '',
    giaTriMoi: ngay + ' ' + normalizeStr_(data.gioBatDau) + '-' + normalizeStr_(data.gioKetThuc) + ' (' + soGio + 'h)',
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: lyDo
  });
  return { success: true, message: 'Đã tạo tăng ca ' + soGio + 'h cho ' + normalizeStr_(target.HoTen) + (duyetLuon ? ' (đã duyệt).' : ' (chờ duyệt).') };
}

function getOvertimeList(userID, filters) {
  var u = checkUserActive(userID);
  if (!u) return { success: false, message: 'Tài khoản không hợp lệ.' };
  var laQuanLy = !!checkHRPerm_(userID, 'duocSuaCong');

  var fTT = normalizeStr_((filters || {}).trangThai);
  var fPB = normalizeStr_((filters || {}).phongBan);
  var fTuNgay = normalizeDate_((filters || {}).tuNgay);
  var fDenNgay = normalizeDate_((filters || {}).denNgay);

  var list = getSheetDataSafe_(TEN_SHEET.TANG_CA)
    .map(buildOvertimePayload_)
    .filter(function (r) {
      if (!laQuanLy && r.userID !== normalizeStr_(userID)) return false; // nhân viên chỉ xem của mình
      if (fTT && r.trangThai !== fTT) return false;
      if (fPB && r.phongBan !== fPB) return false;
      if (fTuNgay && r.ngay < fTuNgay) return false;
      if (fDenNgay && r.ngay > fDenNgay) return false;
      return true;
    })
    .sort(function (a, b) { return a.ngay < b.ngay ? 1 : -1; });
  return { success: true, message: 'OK', data: list };
}

function timTangCa_(tangCaID) {
  var rows = getSheetDataSafe_(TEN_SHEET.TANG_CA);
  for (var i = 0; i < rows.length; i++) {
    if (normalizeStr_(rows[i].TangCaID) === normalizeStr_(tangCaID)) return rows[i];
  }
  return null;
}

/** data = { managerUserID, tangCaID, ghiChu } */
function approveOvertime(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền duyệt tăng ca.' };
  var r = timTangCa_(data.tangCaID);
  if (!r) return { success: false, message: 'Không tìm thấy tăng ca.' };
  var chanKhoa = checkKyKhoa_('CONG', normalizeDate_(r.Ngay)); if (chanKhoa) return chanKhoa; // V5 P4
  if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.CHO_DUYET) {
    return { success: false, message: 'Chỉ duyệt được tăng ca "Chờ duyệt".' };
  }
  updateRowById(TEN_SHEET.TANG_CA, 'TangCaID', r.TangCaID, {
    TrangThai: TT_TANG_CA.DA_DUYET,
    NguoiDuyet: normalizeStr_(mgr.UserID), ThoiGianDuyet: nowStr_(),
    GhiChu: normalizeStr_(data.ghiChu) || normalizeStr_(r.GhiChu)
  });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.TangCaID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Duyệt tăng ca', giaTriCu: TT_TANG_CA.CHO_DUYET, giaTriMoi: TT_TANG_CA.DA_DUYET,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: ''
  });
  return { success: true, message: 'Đã duyệt tăng ca của ' + normalizeStr_(r.HoTen) + '.' };
}

/** data = { managerUserID, tangCaID, lyDo } */
function rejectOvertime(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền từ chối tăng ca.' };
  var lyDo = normalizeStr_(data.lyDo);
  if (!lyDo) return { success: false, message: 'Vui lòng nhập lý do từ chối.' };
  var r = timTangCa_(data.tangCaID);
  if (!r) return { success: false, message: 'Không tìm thấy tăng ca.' };
  var chanKhoa = checkKyKhoa_('CONG', normalizeDate_(r.Ngay)); if (chanKhoa) return chanKhoa; // V5 P4
  if (normalizeStr_(r.TrangThai) !== TT_TANG_CA.CHO_DUYET) {
    return { success: false, message: 'Chỉ từ chối được tăng ca "Chờ duyệt".' };
  }
  updateRowById(TEN_SHEET.TANG_CA, 'TangCaID', r.TangCaID, {
    TrangThai: TT_TANG_CA.TU_CHOI,
    NguoiDuyet: normalizeStr_(mgr.UserID), ThoiGianDuyet: nowStr_(),
    GhiChu: appendGhiChu_(normalizeStr_(r.GhiChu), 'Từ chối: ' + lyDo)
  });
  writeAttendanceHistory({
    recordID: normalizeStr_(r.TangCaID), userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen),
    hanhDong: 'Từ chối tăng ca', giaTriCu: TT_TANG_CA.CHO_DUYET, giaTriMoi: TT_TANG_CA.TU_CHOI,
    nguoiThucHien: normalizeStr_(mgr.UserID), ghiChu: lyDo
  });
  return { success: true, message: 'Đã từ chối tăng ca.' };
}

// ================== V3: LỊCH LÀM (NỀN CHO V4) ==================

function getWorkSchedule(userID, filters) {
  var mgr = checkHRPerm_(userID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền xem lịch làm.' };

  var fTuNgay = normalizeDate_((filters || {}).tuNgay);
  var fDenNgay = normalizeDate_((filters || {}).denNgay);

  var list = getSheetDataSafe_(TEN_SHEET.LICH_LAM)
    .map(function (r) {
      return {
        lichLamID: normalizeStr_(r.LichLamID), ngay: normalizeDate_(r.Ngay),
        userID: normalizeStr_(r.UserID), hoTen: normalizeStr_(r.HoTen), phongBan: normalizeStr_(r.PhongBan),
        caLam: normalizeStr_(r.CaLam), gioBatDau: normalizeStr_(r.GioBatDau), gioKetThuc: normalizeStr_(r.GioKetThuc),
        laNgayNghi: isTrue_(r.LaNgayNghi), ghiChu: normalizeStr_(r.GhiChu)
      };
    })
    .filter(function (r) {
      if (fTuNgay && r.ngay < fTuNgay) return false;
      if (fDenNgay && r.ngay > fDenNgay) return false;
      return true;
    })
    .sort(function (a, b) { return a.ngay < b.ngay ? -1 : 1; });
  return { success: true, message: 'OK', data: list };
}

/**
 * Tạo/sửa lịch làm đơn giản (V3 chưa có màn hình riêng - gọi qua API).
 * data = { managerUserID, lichLamID?, targetUserID, ngay, caLam, gioBatDau, gioKetThuc, laNgayNghi, ghiChu }
 */
function updateWorkSchedule(data) {
  var mgr = checkHRPerm_(data.managerUserID, 'duocSuaCong');
  if (!mgr) return { success: false, message: 'Bạn không có quyền sửa lịch làm.' };

  if (normalizeStr_(data.lichLamID)) {
    var update = { ThoiGianCapNhat: nowStr_() };
    if (data.caLam !== undefined) update.CaLam = normalizeStr_(data.caLam);
    if (data.gioBatDau !== undefined) update.GioBatDau = normalizeStr_(data.gioBatDau);
    if (data.gioKetThuc !== undefined) update.GioKetThuc = normalizeStr_(data.gioKetThuc);
    if (data.laNgayNghi !== undefined) update.LaNgayNghi = data.laNgayNghi === true ? 'TRUE' : 'FALSE';
    if (data.ghiChu !== undefined) update.GhiChu = normalizeStr_(data.ghiChu);
    var ok = updateRowById(TEN_SHEET.LICH_LAM, 'LichLamID', data.lichLamID, update);
    return ok ? { success: true, message: 'Đã cập nhật lịch làm.' } : { success: false, message: 'Không tìm thấy lịch làm.' };
  }

  var target = getUserById(data.targetUserID);
  if (!target) return { success: false, message: 'Không tìm thấy nhân viên.' };
  var ngay = normalizeDate_(data.ngay);
  if (!isValidDateStr_(ngay)) return { success: false, message: 'Ngày không hợp lệ.' };

  appendRow(TEN_SHEET.LICH_LAM, {
    LichLamID: generateLichLamID(),
    Ngay: ngay,
    UserID: normalizeStr_(target.UserID), HoTen: normalizeStr_(target.HoTen), PhongBan: normalizeStr_(target.PhongBan),
    CaLam: normalizeStr_(data.caLam) || 'FULL',
    GioBatDau: normalizeStr_(data.gioBatDau), GioKetThuc: normalizeStr_(data.gioKetThuc),
    LaNgayNghi: data.laNgayNghi === true ? 'TRUE' : 'FALSE',
    GhiChu: normalizeStr_(data.ghiChu),
    NguoiTao: normalizeStr_(mgr.UserID),
    ThoiGianTao: nowStr_(), ThoiGianCapNhat: nowStr_()
  });
  return { success: true, message: 'Đã tạo lịch làm cho ' + normalizeStr_(target.HoTen) + ' ngày ' + ngay + '.' };
}
