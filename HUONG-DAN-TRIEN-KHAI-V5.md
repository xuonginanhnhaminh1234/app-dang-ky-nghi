# HƯỚNG DẪN TRIỂN KHAI V5.0-RC2 (từ production V3.3.3)

> Điều kiện: đã có **backup đầy đủ** (quyết định 13/07/2026). Toàn bộ flag V5 mặc định FALSE
> → ngay sau deploy, app hoạt động như V3.3.3. Bật dần từng module sau khi test thực tế.

## BƯỚC 0: KIỂM TRA TEST TỰ ĐỘNG (trên máy tính, trước khi đụng production)

```
cd app-dang-ky-nghi
node test/run-tests.js
```
Phải thấy `TẤT CẢ TEST PASS ✅` (84/84). FAIL bất kỳ → DỪNG, không deploy.

## BƯỚC 1: BACKUP (bắt buộc, dù đã có)

1. Google Sheet → File → **Make a copy** (đặt tên `Backup-truoc-V5-<ngày>`).
2. Apps Script → Manage deployments → ghi lại version đang chạy (để rollback).
3. Commit repo Git hiện tại, tag `v3.3.3-truoc-v5`.

## BƯỚC 2: BACKEND

1. Mở Apps Script → Ctrl+A dán toàn bộ `Code.gs` mới → Save.
2. Chọn hàm **setupSheetsV5** → Run → xem Execution log:
   - Các dòng `[V4-SETUP]`/`[V5-SETUP] SẼ TẠO/SẼ NỐI/SẼ SEED ...` và `KẾT QUẢ: {...}`.
   - Đối chiếu: 7 sheet V4 + 7 sheet V5 + PHIEN_XU_LY_PM mới; NHAN_VIEN nối cột NgaySinh, NgayKetThucThuViec, NgayChinhThuc; CHAM_CONG nối cột CoDieuChinh; CAU_HINH_MODULE có 13 dòng FALSE; CAU_HINH_CHUNG có ChuXuongUserID (rỗng), SoNgayPhepThang=2, CongChuanMacDinh=26.
   - **Chạy setupSheetsV5 lần 2** → KẾT QUẢ phải rỗng (idempotent).
3. **Deploy → Manage deployments → bút chì → New version → Deploy** (giữ nguyên link /exec).
4. Mở link /exec → phải thấy `"version":"V5.0-RC2"`.

## BƯỚC 3: CẤU HÌNH BẮT BUỘC TRƯỚC KHI NHÂN VIÊN CHẤM CÔNG

1. **ChuXuongUserID**: đăng nhập chủ xưởng → Quản lý slot → Cấu hình chung → điền UserID thật của chủ xưởng. (Thiếu → không duyệt được phiếu đổi tiền/quyết định/mở khóa.)
2. **Địa điểm GPS** (fail-closed - thiếu là CẢ XƯỞNG bị chặn chấm): sheet CAU_HINH_DIA_DIEM_CHAM_CONG phải có ≥1 dòng Active với ViDo/KinhDo thật + BanKinhMet > 0 + **BatBuocGPS=TRUE**. Cách nhanh: Cấu hình nhân sự → "🎯 Lấy vị trí hiện tại làm vị trí xưởng" (đứng giữa xưởng).
3. Nên deploy NGOÀI giờ chấm công cao điểm.

## BƯỚC 4: FRONTEND

1. **⚠ Đồng bộ repo lồng** `app-dang-ky-nghi/app-dang-ky-nghi/` (repo git thật nối Netlify): copy `index.html`, `Code.gs`, thư mục `test/`, các file .md mới vào repo → kiểm tra index.html trong repo có chữ `V5.0-RC2`... rồi mới push.
2. Push lên GitHub → Netlify tự deploy. `netlify.toml` + `netlify/functions/api.js` không đổi.
3. Mở app trên điện thoại → login → Home phải hiện bố cục 4 nút nhân viên; KHÔNG có nút V5 nào của quản lý (flag đang FALSE).

## BƯỚC 5: REGRESSION TRÊN PRODUCTION (flag FALSE)

Chạy mục 0 của CHECKLIST-TEST-V5.0-RC2.md: login, chấm công GPS vào/ra, đăng ký + duyệt nghỉ, bảng công ngày/tháng, tạm ứng, thưởng phạt, lương sơ bộ, copy Zalo — tất cả như V3.3.3.

## BƯỚC 6: BẬT DẦN MODULE (mỗi đợt PASS mới sang đợt sau)

Cấu hình nhân sự → card Module: đặt **TEST** (chỉ quản lý thấy) → dùng thật ≥3 ngày → **TRUE**.

| Đợt | Flag bật | Không đụng tiền? |
|---|---|---|
| F1 | ReminderCenter, KPI, ShiftRequest, EarlyLeave, Overtime (+ Birthday/Probation/Announcement nếu muốn) | ✅ an toàn |
| F2 | AttendanceV2 (event + phiếu điều chỉnh) | ✅ (phiếu B mới đổi tiền, phải chủ xưởng duyệt) |
| F3 | SalaryHistory (quyết định NS, lịch sử lương, bảng lương V5) | ⚠️ CHẠY SONG SONG 1 KỲ LƯƠNG đối chiếu với lương sơ bộ cũ trước khi tin |
| F4 | PayrollLock, SalaryConfirm, OwnerDashboard | ⚠️ khóa dữ liệu - bật cuối cùng |

Trước F3: nhập NgayChinhThuc + tạo bản ghi lương ban đầu cho từng NV (qua Quyết định nhân sự loại "Chuyển chính thức"/"Tăng lương", hoặc để hệ fallback lương trong hồ sơ NHAN_VIEN - vẫn đúng).

## ROLLBACK

1. **Nhẹ nhất:** tắt flag module lỗi = FALSE (qua app, hiệu lực ngay).
2. **Backend:** Manage deployments → trỏ về version V3.3.3 đã ghi ở Bước 1. Sheet/cột mới vô hại với code cũ - KHÔNG xóa gì.
3. **Frontend:** Netlify → Deploys → publish lại deploy trước.
4. Cả xưởng bị chặn chấm công oan → 99% do cấu hình địa điểm (Bước 3.2): sửa qua app có hiệu lực NGAY - đây là xử lý đúng, không phải rollback. Trường hợp đặc biệt từng người: PM sửa công tay (Bảng công ngày) - có lưu lịch sử.
