# HƯỚNG DẪN TRIỂN KHAI - APP ĐĂNG KÝ NGHỈ

Mô hình giống app quản lý bill QR: Google Sheets (database) → Apps Script (API) → Netlify (frontend).

---

## BƯỚC 1: Tạo Google Sheet + Backend

1. Vào https://sheets.new → tạo Google Sheet mới, đặt tên ví dụ: **DB Đăng ký nghỉ**.
2. Menu **Tiện ích mở rộng (Extensions) → Apps Script**.
3. Xóa hết code mặc định trong file `Code.gs`, dán toàn bộ nội dung file **Code.gs** của dự án vào.
4. Bấm **Lưu** (Ctrl+S).

## BƯỚC 2: Chạy setupSheets() để tạo database

1. Trong Apps Script, ở thanh chọn hàm (cạnh nút Run), chọn hàm **setupSheets**.
2. Bấm **Run (Chạy)**.
3. Lần đầu Google sẽ hỏi cấp quyền:
   - Bấm **Review permissions** → chọn tài khoản Google của bạn.
   - Nếu hiện cảnh báo "Google hasn't verified this app" → bấm **Advanced → Go to ... (unsafe)** → **Allow**.
4. Quay lại Google Sheet, kiểm tra đã có đủ 9 sheet:
   - `USERS`, `LICH_NGHI`, `CA_LAM`, `CAU_HINH_SLOT`, `CAU_HINH_MAC_DINH`, `NGAY_KHOA`, `CAU_HINH_CHUNG`, `LEAVE_HISTORY`, `NHAN_SU_TOI_THIEU`
5. Vào sheet `USERS`, sửa/thêm nhân viên thật của xưởng (có thể copy danh sách USERS từ app bill QR sang, chỉ cần đúng thứ tự cột: UserID, HoTen, MaPIN, PhongBan, VaiTro, DuocXemDashboard, DuocDuyetNghi, DuocSuaCauHinh, TrangThai).
   - PhongBan chỉ dùng: `CSKH`, `KyThuat`, `GiaCong`, `QuanLy`.
   - PM/quản lý: đặt `DuocXemDashboard = TRUE`, `DuocDuyetNghi = TRUE`, `DuocSuaCauHinh = TRUE`.
   - Chủ xưởng: TRUE cả 3 cột quyền (toàn quyền).

## BƯỚC 3: Deploy Web App (API)

1. Trong Apps Script bấm **Deploy → New deployment**.
2. Bấm biểu tượng bánh răng → chọn **Web app**.
3. Cấu hình:
   - **Description**: dang-ky-nghi v1
   - **Execute as**: **Me** (tài khoản của bạn)
   - **Who has access**: **Anyone** (Bất kỳ ai)
4. Bấm **Deploy** → copy **Web app URL** dạng:
   `https://script.google.com/macros/s/AKfycb.../exec`
5. Test nhanh: dán link đó vào trình duyệt, phải thấy JSON:
   `{"success":true,"message":"API Đăng ký nghỉ đang hoạt động..."}`

> ⚠️ Sau này nếu SỬA Code.gs, phải **Deploy → Manage deployments → Edit (bút chì) → Version: New version → Deploy** thì link /exec mới nhận code mới. Deploy kiểu này giữ nguyên link cũ, không phải sửa frontend.

## BƯỚC 4: Cấu hình frontend

1. Mở file **index.html**, tìm dòng gần cuối phần `<script>`:
   ```js
   const API_URL = 'DAN_LINK_APPS_SCRIPT_EXEC_VAO_DAY';
   ```
2. Thay bằng link /exec vừa copy:
   ```js
   const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

## BƯỚC 5: Đưa lên GitHub

1. Tạo repo mới trên GitHub, ví dụ: `app-dang-ky-nghi`.
2. Upload file `index.html` lên repo (nhánh `main`).
   - Cách nhanh không cần cài git: vào repo → **Add file → Upload files** → kéo thả `index.html` → Commit.
   - Hoặc dùng git:
     ```
     git init
     git add index.html
     git commit -m "App dang ky nghi v1"
     git branch -M main
     git remote add origin https://github.com/<user>/app-dang-ky-nghi.git
     git push -u origin main
     ```

## BƯỚC 6: Kết nối Netlify

1. Vào https://app.netlify.com → **Add new site → Import an existing project**.
2. Chọn **GitHub** → chọn repo `app-dang-ky-nghi`.
3. Build settings để trống hết (site tĩnh, không cần build command, publish directory = gốc repo).
4. Bấm **Deploy site**.
5. Netlify cấp link dạng `https://ten-gi-do.netlify.app` — có thể đổi tên trong **Site settings → Change site name**.
6. Từ nay mỗi lần push `index.html` mới lên GitHub, Netlify tự deploy lại.

## BƯỚC 7: Test trên điện thoại

1. Mở link Netlify trên điện thoại.
2. Đăng nhập bằng PIN mẫu:
   - Nhân viên CSKH: `1111` (Kiều Doan)
   - Nhân viên KyThuat: `2222` (Phúc Hậu)
   - Nhân viên GiaCong: `3333` (Mai)
   - Quản lý: `9999`
3. Chạy toàn bộ **CHECKLIST-TEST.md**.
4. Có thể "Thêm vào màn hình chính" (Add to Home Screen) để mở như app.

---

## V3.3.2 - NETLIFY FUNCTION PROXY (CẬP NHẬT CÁCH CẤU HÌNH API)

Từ V3.3.2, frontend KHÔNG gọi thẳng Apps Script nữa mà gọi qua proxy cùng domain:
`index.html` → `/.netlify/functions/api` → Apps Script `/exec`.

Repo giờ có thêm 2 file (phải nằm đúng vị trí):
```
index.html
netlify.toml
netlify/functions/api.js
```

Cấu hình link Apps Script cho proxy (chọn 1 trong 2):

**Cách 1 - Biến môi trường (khuyên dùng):**
1. Vào Netlify → Site configuration → **Environment variables** → Add a variable.
2. Key: `APPS_SCRIPT_URL`
3. Value: link /exec của bạn, dạng `https://script.google.com/macros/s/AKfycb.../exec`
4. **Deploys → Trigger deploy → Deploy site** (bắt buộc deploy lại thì function mới nhận biến).

**Cách 2 - Sửa thẳng file:** mở `netlify/functions/api.js`, thay chỗ
`DAN_LINK_APPS_SCRIPT_EXEC_VAO_DAY` bằng link /exec rồi push.

⚠️ **Link /exec đúng có dạng `https://script.google.com/macros/s/.../exec`**
(lấy từ Deploy → Manage deployments). KHÔNG dùng link `/macros/library/d/...`
(đó là link thư viện, gọi API sẽ lỗi).

Test nhanh proxy sau khi deploy: mở
`https://ten-site.netlify.app/.netlify/functions/api` trên trình duyệt
→ thấy `{"success":false,"message":"Proxy chỉ hỗ trợ POST."}` là function đã chạy
(GET bị chặn là đúng thiết kế).

## GHI CHÚ VẬN HÀNH

- **Đổi số ngày báo trước**: đăng nhập bằng tài khoản quản lý → Quản lý slot → Cấu hình chung → sửa `SoNgayBaoTruoc` (hoặc sửa trực tiếp sheet `CAU_HINH_CHUNG`).
- **Tắt yêu cầu đặc biệt**: sửa `ChoPhepYeuCauDacBiet` = `FALSE`.
- **Thêm nhân viên**: thêm dòng vào sheet `USERS`. Khóa nhân viên nghỉ việc: đổi `TrangThai` thành `Inactive` (không xóa dòng, để giữ lịch sử).
- **Slot / nhân sự tối thiểu / khóa ngày**: chỉnh trong app, không cần sửa code hay sửa sheet tay.
- **Lịch sử thao tác**: xem sheet `LEAVE_HISTORY` (ai tạo/duyệt/từ chối/hủy đơn nào, lúc nào).
- **Bảo mật mức nội bộ**: API mở "Anyone" nên đừng chia sẻ link Apps Script /exec ra ngoài; PIN chỉ chia cho nhân viên. Đây là app nội bộ, không dùng cho dữ liệu nhạy cảm.
