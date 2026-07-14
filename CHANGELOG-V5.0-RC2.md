# CHANGELOG V5.0-RC2 (13/07/2026)

> **Quyết định chủ dự án 13/07/2026:** triển khai THẲNG từ production V3.3.3 lên V5
> (đã có backup đầy đủ). Không phát triển thêm tính năng mới - chỉ hoàn thiện những gì
> V5.0-RC1 đã có backend, kiểm định bằng test, và đơn giản hóa GPS.
> Backend version: `V5.0-RC2`. Nền code: V5.0-RC1 (đã chứa toàn bộ P1-P4).

## 1. GPS: FAIL-CLOSED ĐƠN GIẢN - GỠ TOÀN BỘ LỚP NGOẠI LỆ (mục 9-10 chỉ đạo)

Luật duy nhất: **có địa điểm Active hợp lệ → có GPS → đạt độ chính xác → trong bán kính → cho chấm; thiếu bất kỳ điều kiện nào → chặn.** Trường hợp đặc biệt: PM sửa công tay / thêm công tay / phiếu điều chỉnh — đều có audit.

**Đã GỠ khỏi backend:** sheet NGOAI_LE_GPS (không tạo nữa), key CheDoGPSKhanCap, cột ChamNgoaiViTri, `setupSheetsV402()`, 6 API (getGPSExceptions, proposeGPSException, grantGPSException, approveGPSException, revokeGPSException, setEmergencyGPSMode) + 6 route tương ứng, các hàm getNgoaiLeGPSHopLe_/ghiNhanDungNgoaiLe_/buildNgoaiLePayload_/kiemTraDuLieuNgoaiLe_/taoDongNgoaiLe_/chuanHoaThoiGian_. `validateAttendanceLocation_` viết lại chỉ còn A-D (không tham số userID, không trường `ngoaiLe`). Giữ lại `laChuXuong_`/`loiQuyenChuXuong_` (V5 dùng chung).

**Đã GỠ khỏi frontend:** card "🚨 Chế độ khẩn cấp & ngoại lệ GPS" + toàn bộ JS ngoại lệ; checkbox "Cho phép chấm ngoài vị trí" (đã ngưng hiệu lực từ V4.0.2); các nhánh hiển thị khẩn cấp/ngoại lệ ở màn Chấm công. Frontend không gửi request khi thiếu GPS (không còn nhánh "trừ khi có ngoại lệ").

**Lưu ý dữ liệu:** nếu Sheet production từng chạy setupSheetsV402 (có sẵn NGOAI_LE_GPS/cột ChamNgoaiViTri/key CheDoGPSKhanCap) thì các dữ liệu đó VÔ HẠI - code mới không đọc/ghi chúng, không cần xóa.

## 2. RÀ 4 API CHƯA KIỂM FLAG (mục 8 chỉ đạo) - ĐÃ CHỐT

| API | RC1 | RC2 |
|---|---|---|
| getPayrollV5 | chỉ check quyền duocXemBangLuong | + `checkModule_('SalaryHistory')` — flag tắt thì dùng lương sơ bộ cũ (getPayrollDraft) |
| getLockedPayroll | chỉ check quyền | + `checkModule_('PayrollLock')` |
| exportPayrollTSV | chỉ check quyền | thừa hưởng flag qua getLockedPayroll |
| updateKPIConfig | chỉ check quyền DuocSuaCauHinh | + `checkModule_('KPI')` |

(getLockStatus giữ không flag - read-only, trả trạng thái khóa, vô hại.)

## 3. SETUP HỢP NHẤT TỪ V3.3.3

`setupSheetsV5()` giờ **tự gọi `setupSheetsV4()`** trước rồi làm phần V5 → chạy được THẲNG từ nền V3.3.3, một lần duy nhất, idempotent (lần 2 trả báo cáo rỗng - có test). Tạo: 7 sheet V4 + 2 cột NHAN_VIEN (NgaySinh, NgayKetThucThuViec) + ChuXuongUserID rỗng + 13 flag FALSE + 7 sheet V5 + PHIEN_XU_LY_PM + cột NgayChinhThuc (NHAN_VIEN), CoDieuChinh (CHAM_CONG) + key SoNgayPhepThang=2, CongChuanMacDinh=26.

## 4. 2 BUG RC1 DO BỘ TEST PHÁT HIỆN - ĐÃ SỬA

1. 🔴 **TEN_SHEET thiếu key PHIEN_XU_LY_PM** → RC1 sẽ tạo/ghi sheet tên `undefined`; chốt ngày và Dashboard PM hỏng trên production. RC2 khai báo đúng.
2. **BangLuongID không duy nhất giữa các lần chốt** (cùng giây) → ký nhận có thể trỏ nhầm bản cũ. RC2 thêm `-L<lanChot>-` vào ID.

## 5. FRONTEND V5 HOÀN CHỈNH (trước đó = 0 màn hình V5)

- **Home NV 4 nút:** ⏱ Chấm công · 📝 Xin nghỉ (gộp 2 tab Đăng ký + Lịch của tôi) · 💰 Lương (công + phiếu lương + ký nhận) · 📋 Khác (Lịch nghỉ, Công của tôi, Tạm ứng + Tăng ca/Đổi ca/Về sớm theo flag).
- **Màn mới:** scr-luongnv (phiếu lương 7 con số + THỰC NHẬN + diễn giải giai đoạn + Ký nhận + In), scr-khac, scr-doica, scr-vesom, scr-tangcatoi, scr-pmdash (KPI thanh 3 màu + nhập 1 chạm + Cần xử lý duyệt/từ chối tại chỗ 6 loại đơn + Hôm nay + Nhắc nhở + Chốt ngày với lý do tồn + copy báo cáo Zalo), scr-dieuchinh (phiếu sửa công lời thường, không lộ "cấp A/B"), scr-quyetdinh (+ lịch sử lương), scr-chotky (chốt/mở khóa công-lương, bảng lương trước/sau chốt, Copy dán Excel), scr-owner (khối số + copy Zalo).
- Card chỉ tiêu KPI trong Cấu hình nhân sự; xem KPI ngày khác trong Dashboard PM; mục "Toàn xưởng" cho quản lý ở màn đổi ca/về sớm.
- Mọi nút V5 **ẩn mặc định**, chỉ hiện theo flag + quyền (mnPMDash/mnDieuChinh/mnQuyetDinh/mnChotKy/mnOwner); `resetV4UI_` dọn sạch khi đổi user trên máy dùng chung; flag FALSE → không có request ngầm nào của module đó.
- ⚠️ **Khác V3.3.3 duy nhất khi mọi flag FALSE:** bố cục Home (4 nút NV thay vì dàn nút phẳng - các chức năng cũ vẫn nguyên, chỉ dời vào "Khác"/tab). Toàn bộ NGHIỆP VỤ giữ nguyên 100% (có 84 test chứng minh).

## 6. FLAG (tất cả seed FALSE - mục 3-4 chỉ đạo)

13 flag: ReminderCenter (Dashboard PM + chốt ngày), Birthday, Probation, ShiftRequest, EarlyLeave, Overtime, Announcement, PayrollLock (khóa công/lương + guard 11 hàm), SalaryConfirm (phiếu lương + ký nhận), OwnerDashboard, KPI, AttendanceV2 (event + phiếu điều chỉnh), SalaryHistory (quyết định NS + lịch sử lương + bảng lương V5).
Hợp đồng flag FALSE: nút ẩn, API trả "Chức năng đang tắt.", không request ngầm, guard khóa kỳ trả null → app = V3.3.3.

## 7. BỘ TEST TỰ ĐỘNG - TÁI LẬP VÀ LƯU VÀO REPO (mục 5-7 chỉ đạo)

Thư mục `test/` (commit vào repo Git - không thất lạc như bộ 95 test cũ):
- `harness.js` - mock Apps Script (SpreadsheetApp/CacheService/LockService/Utilities...) chạy nguyên văn Code.gs trong Node.
- 8 file test - **84 test, 84 PASS**:
  1. Regression V3.3.3 (20): login, nghỉ + slot + đặc biệt + vượt slot, chấm công GPS, tính công V3.2, lịch riêng, sửa công tay + audit, tạm ứng, thưởng phạt, tăng ca, lương sơ bộ, cache, doGet/doPost.
  2. Hợp đồng flag FALSE (7): 39 API V5 bị chặn, 6 API ngoại lệ GPS hết route, không ghi event, guard vô hiệu, giá trị flag lạ = FALSE, TEST chặn NV thường.
  3. GPS fail-closed (12): đủ ma trận A-D + không còn trường ngoại lệ + PM sửa công tay làm van.
  4. V5 P1 (9): KPI, đổi ca (duyệt ghi LICH_LAM), về sớm, OT NV, PM Dashboard, chốt ngày (needLyDo).
  5. V5 P2 (8): event dual-write, phiếu A hiệu lực ngay + tính lại công, phiếu B chủ xưởng duyệt + chặn PM, 2 vai, vô hiệu.
  6. V5 P3 (12): quyết định NS tự áp, lịch sử lương append-only, thử việc 85% tự tính, chia giai đoạn Q2 (kiểm đúng số tiền), phép 2 ngày (đủ biên), công chuẩn, mốc tăng lương 6 tháng.
  7. V5 P4 (7): guard đúng nhóm hàm, snapshot LanChot/HieuLuc, mở khóa giữ chữ ký bản cũ, chốt lại ký lại, TSV, dashboard chủ.
  8. Cross-check (8): 116 route đều có handler, frontend gọi đủ/đúng 39 API V5, mọi onclick có hàm, cú pháp 2 file, sạch vết ngoại lệ GPS.
- **Chạy: `node test/run-tests.js`** (không cần cài gì thêm, Node >= 16).

## 8. FILE THAY ĐỔI

| File | Thay đổi |
|---|---|
| Code.gs | Mục 1-4 ở trên. API cũ V3.3.3 giữ nguyên 100% |
| index.html | Mục 1 (gỡ) + mục 5 (thêm) |
| test/ (MỚI) | Harness + 84 test |
| CHANGELOG-V5.0-RC2.md, CHECKLIST-TEST-V5.0-RC2.md, HUONG-DAN-TRIEN-KHAI-V5.md | Mới |
| netlify.toml, netlify/functions/api.js | **KHÔNG đổi** |

## 9. ROLLBACK 3 LỚP (giữ nguyên cơ chế đã kiểm chứng)

1. Tắt flag module lỗi (không cần deploy) → hành vi V3.3.3.
2. Apps Script → Manage deployments → trỏ về version V3.3.3. Sheet/cột mới vô hại với code cũ.
3. Netlify → publish lại deploy trước.
