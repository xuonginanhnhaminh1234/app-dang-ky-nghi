# CHECKLIST TEST - APP ĐĂNG KÝ NGHỈ

Dữ liệu mẫu: PIN `1111` (CSKH), `2222` (KyThuat), `3333` (GiaCong), `9999` (Quản lý).
Slot mặc định: CSKH 1/ca, KyThuat 1/ca, GiaCong 2/ca. SoNgayBaoTruoc = 2.

> Chọn "ngày test" = hôm nay + 3 ngày để không vướng hạn báo trước.

## 1. Đăng nhập
- [ ] Login PIN đúng (`1111`) → vào Home, thấy tên "Kiều Doan", phòng ban CSKH.
- [ ] Login PIN sai (`0000`) → báo "Mã PIN không đúng hoặc tài khoản đã bị khóa."
- [ ] Login PIN `9999` → Home hiện thêm: Dashboard, Duyệt nghỉ, Tạo đơn thay, Quản lý slot, Khóa ngày.
- [ ] Nhân viên (`1111`) KHÔNG thấy các nút quản lý.
- [ ] Đăng xuất → quay về màn Login. Mở lại trang → tự đăng nhập lại bằng session đã lưu.

## 2. Nhân viên đăng ký nghỉ
- [ ] `1111` đăng ký SANG ngày test → thành công, trạng thái "Chờ duyệt".
- [ ] Chọn ngày quá gần (hôm nay/ngày mai) → date picker chặn; nếu ép gửi → báo "Đăng ký nghỉ phải trước ít nhất 2 ngày."
- [ ] `1111` đăng ký SANG cùng ngày lần 2 → báo trùng đơn.
- [ ] `1111` đăng ký FULL cùng ngày → báo trùng (đã có SANG).
- [ ] Chọn loại nghỉ "Ốm" → ô Tính công tự nhảy sang "Chờ quyết định"; "Có phép" → "Tính phép".

## 3. Slot & yêu cầu đặc biệt (CSKH slot = 1)
- [ ] Sau khi `1111` giữ slot SANG: thêm 1 user CSKH khác vào sheet USERS (VD U004/PIN 4444), login `4444` đăng ký SANG cùng ngày → báo "Ca này đã đủ số người nghỉ." + hiện nút "Gửi yêu cầu đặc biệt".
- [ ] Bấm "Gửi yêu cầu đặc biệt" → tạo đơn trạng thái "Yêu cầu đặc biệt" (badge tím).
- [ ] Đăng ký FULL khi chỉ 1 trong 2 ca hết slot → vẫn báo hết slot (FULL chiếm cả 2 ca).
- [ ] Sửa `ChoPhepYeuCauDacBiet` = FALSE → hết slot thì KHÔNG hiện nút yêu cầu đặc biệt. (Nhớ bật lại TRUE.)

## 4. Lịch nghỉ của tôi
- [ ] `1111` xem "Lịch nghỉ của tôi" → thấy đủ: ngày, ca, loại, lý do, trạng thái, thời gian đăng ký.
- [ ] Hủy đơn "Chờ duyệt" → chuyển "Đã hủy", slot trả lại (user khác đăng ký lại được ca đó).
- [ ] Đơn "Đã duyệt" → KHÔNG có nút hủy.
- [ ] Nhân viên chỉ thấy đơn của chính mình.

## 5. PM duyệt / từ chối / hủy
- [ ] `9999` vào Duyệt nghỉ → thấy toàn bộ đơn, lọc theo ngày/phòng ban/trạng thái/nhân viên hoạt động.
- [ ] Duyệt đơn "Chờ duyệt" → chuyển "Đã duyệt", có người duyệt + thời gian duyệt (nhân viên xem thấy).
- [ ] Duyệt mà vướng nhân sự tối thiểu (CSKH tối thiểu 3, xưởng test ít người) → hiện cảnh báo, xác nhận thì vẫn duyệt được.
- [ ] Từ chối đơn: không nhập lý do → bị chặn; nhập lý do → chuyển "Từ chối", nhân viên thấy lý do từ chối, slot trả lại.
- [ ] Hủy đơn đã duyệt (nút Hủy của PM) → chuyển "Đã hủy", slot trả lại.
- [ ] Đổi Tính công trong thẻ đơn trước khi duyệt → giá trị mới được lưu.

## 6. Duyệt vượt slot
- [ ] Với đơn "Yêu cầu đặc biệt" (slot đã đầy): bấm "Duyệt" thường → báo "Slot đã đầy, vui lòng dùng Duyệt vượt slot..." kèm gợi ý.
- [ ] Bấm "Duyệt vượt slot" → đơn thành "Đã duyệt" + badge đỏ "VƯỢT SLOT", sheet cột VuotSlot = TRUE.

## 7. PM tạo đơn thay nhân viên
- [ ] Tạo đơn thay cho `2222` ngày MAI (vi phạm hạn báo trước) → vẫn tạo được (PM không bị giới hạn).
- [ ] Tạo với trạng thái ban đầu "Đã duyệt" → đơn hiện "Đã duyệt" luôn, cột TaoThayNhanVien = TRUE.
- [ ] Tạo khi ca đã đầy, KHÔNG tích vượt slot → báo hết slot, không tạo.
- [ ] Tạo khi ca đã đầy, CÓ tích vượt slot + trạng thái "Đã duyệt" → tạo được, VuotSlot = TRUE.
- [ ] Tạo trùng đơn nhân viên đã có → báo trùng.

## 8. Quản lý slot
- [ ] `9999` vào Quản lý slot: đặt slot riêng CSKH / SANG / ngày test = 2 → lưu OK, hiện trong danh sách.
- [ ] Sau khi tăng slot lên 2: nhân viên CSKH thứ 2 đăng ký SANG ngày đó → thành công (không cần yêu cầu đặc biệt).
- [ ] Ngày không có slot riêng → app dùng slot mặc định (kiểm tra bằng ngày khác).
- [ ] Sửa slot mặc định (nút Sửa) → giá trị mới có hiệu lực.
- [ ] Sửa nhân sự tối thiểu → cảnh báo dashboard thay đổi tương ứng.
- [ ] Sửa `SoNgayBaoTruoc` trong Cấu hình chung → hạn đăng ký trên form nhân viên đổi theo (đăng nhập lại/tải lại).

## 9. Khóa ngày
- [ ] Khóa TOÀN XƯỞNG cả ngày X → mọi nhân viên đăng ký ngày X đều báo "Ngày này tạm khóa đăng ký nghỉ."
- [ ] Khóa riêng CSKH ca SANG ngày Y → CSKH đăng ký SANG ngày Y bị chặn; CSKH đăng ký CHIEU ngày Y vẫn được; KyThuat đăng ký SANG ngày Y vẫn được.
- [ ] Khóa CSKH ca SANG → CSKH đăng ký FULL ngày đó cũng bị chặn (FULL dính ca SANG).
- [ ] Mở khóa → đăng ký lại bình thường.
- [ ] PM tạo đơn thay vào ngày khóa → cũng bị chặn.

## 10. Dashboard
- [ ] Card tổng quan đúng số: nghỉ hôm nay, ngày mai, chờ duyệt, đã duyệt, từ chối, yêu cầu đặc biệt.
- [ ] "Hôm nay ai nghỉ" nhóm theo phòng ban, phòng không ai nghỉ hiện "Không có ai nghỉ".
- [ ] "Ngày mai ai nghỉ" và "Tuần này ai nghỉ" hiển thị đúng (tuần = Thứ 2 → Chủ nhật).
- [ ] Bảng slot hôm nay/ngày mai: đã dùng / tối đa / còn lại đúng với dữ liệu.
- [ ] Có đơn duyệt vượt slot hôm nay/ngày mai → hiện cảnh báo đỏ "VƯỢT SLOT: ... 2/1".
- [ ] Phòng ban dưới mức nhân sự tối thiểu → hiện cảnh báo đỏ "NHÂN SỰ: ... chỉ còn N người...".

## 11. Dashboard tháng (Lịch nghỉ theo tháng)
- [ ] `9999` vào Dashboard → cuối trang có mục "📆 Lịch nghỉ theo tháng", mặc định đúng tháng/năm hiện tại.
- [ ] Bấm "Xem lịch tháng" → hiện thống kê tháng (tổng lượt, chờ duyệt, đã duyệt, đặc biệt, từ chối, đã hủy) khớp dữ liệu sheet.
- [ ] Danh sách theo ngày: chỉ hiện ngày có đơn, nhóm theo phòng ban, ngày trống không hiện.
- [ ] Lọc phòng ban = CSKH → chỉ còn đơn CSKH (cả danh sách lẫn thống kê).
- [ ] Lọc trạng thái = "Đã duyệt" → danh sách chỉ hiện đơn đã duyệt (thống kê trạng thái vẫn đếm đủ toàn tháng).
- [ ] Thống kê theo phòng ban: số lượt = số đơn Chờ duyệt/Đã duyệt/Yêu cầu đặc biệt (Từ chối/Đã hủy không tính).
- [ ] Top nhân viên: quy đổi đúng — SANG/CHIEU = 0.5 ngày, FULL = 1 ngày.
- [ ] Có đơn vượt slot trong tháng → hiện cảnh báo "⚠ dd/MM/yyyy - PB ca X: 2/1 người nghỉ, vượt slot."
- [ ] Phòng ban dưới nhân sự tối thiểu ngày nào đó trong tháng → hiện cảnh báo tương ứng.
- [ ] "Copy lịch nghỉ tháng" → dán vào Zalo ra đúng mẫu (📆 LỊCH NGHỈ THÁNG..., từng ngày, TỔNG HỢP, câu nhắc PM).
- [ ] "Copy thống kê tháng" → dán ra đủ: thống kê trạng thái, theo phòng ban, top nhân viên, cảnh báo.
- [ ] Chuyển sang tháng không có đơn → báo "Không có đơn nghỉ nào khớp bộ lọc trong tháng này."

## 12. Copy Zalo
- [ ] Dashboard: 3 nút "📋 Copy hôm nay / ngày mai / tuần này" nằm dưới card thống kê.
- [ ] Copy hôm nay → dán vào Zalo ra "📆 LỊCH NGHỈ HÔM NAY (dd/MM/yyyy)" + danh sách nhóm theo phòng ban + câu nhắc PM.
- [ ] Copy ngày không ai nghỉ → nội dung có "(Không có ai nghỉ)".
- [ ] Copy tuần này → danh sách nhóm theo từng ngày, mỗi ngày nhóm theo phòng ban.
- [ ] Duyệt nghỉ: mỗi đơn có nút copy, nhãn đổi theo trạng thái (Copy tin đăng ký / đã duyệt / từ chối / hủy).
- [ ] Đơn "Chờ duyệt" → copy ra mẫu "📌 CÓ ĐƠN ĐĂNG KÝ NGHỈ MỚI" đủ: nhân viên, phòng ban, ngày, ca, loại, lý do.
- [ ] Đơn "Yêu cầu đặc biệt" → mẫu đăng ký có thêm dòng "Loại đơn: YÊU CẦU ĐẶC BIỆT (hết slot)".
- [ ] Đơn "Đã duyệt" → mẫu "✅ ĐƠN NGHỈ ĐÃ ĐƯỢC DUYỆT" có Tính công; đơn duyệt vượt slot có thêm dòng lưu ý VƯỢT SLOT.
- [ ] Đơn "Từ chối" → mẫu "❌" có đúng lý do từ chối.
- [ ] Đơn "Đã hủy" → mẫu "⚠️ ĐƠN NGHỈ ĐÃ ĐƯỢC HỦY".
- [ ] Test copy trên điện thoại (Safari iOS + Chrome Android) → toast "Đã copy..." và dán ra đúng nội dung.

## 13. V3 - An toàn dữ liệu (LÀM TRƯỚC TIÊN)
- [ ] Backup Google Sheet (File → Make a copy) TRƯỚC khi dán code mới.
- [ ] Chạy setupSheets() → 9 sheet mới xuất hiện, 9 sheet cũ NGUYÊN VẸN (đếm số dòng LICH_NGHI trước/sau phải bằng nhau).
- [ ] NHAN_VIEN tự có hồ sơ mặc định từ USERS (chỉ khi NHAN_VIEN trống).
- [ ] Login PIN cũ vẫn được; đăng ký nghỉ / duyệt nghỉ / dashboard nghỉ tháng / copy Zalo nghỉ vẫn chạy như cũ.

## 14. V3 - Chấm công
- [ ] Nhân viên thấy nút Chấm công; chấm vào tạo dòng CHAM_CONG; chấm vào lần 2 bị chặn.
- [ ] Chấm ra cập nhật GioRa, tính SoGioLam (trừ nghỉ trưa nếu xuyên trưa); chấm ra lần 2 bị chặn.
- [ ] Chấm ra khi chưa chấm vào → báo lỗi.
- [ ] Vào sau 07:35 → DiTre TRUE; ra trước 17:25 → VeSom TRUE; ra sau 17:30 → tính tăng ca.
- [ ] Đặt ChoPhepNhanVienChamCong = FALSE → nhân viên không chấm được.

## 15. V3 - Công & bảng công
- [ ] "Công của tôi" đúng số liệu tháng; nhân viên không có API xem công người khác.
- [ ] Bảng công ngày: quản lý sửa giờ vào/ra → bắt nhập lý do → có dòng trong CHAM_CONG_HISTORY.
- [ ] Thêm công tay cho người chưa chấm; đánh dấu Nghỉ; không thêm được dòng thứ 2 cùng ngày.
- [ ] Bảng công tháng: nghỉ chỉ tính đơn "Đã duyệt" từ LICH_NGHI (quy đổi 0.5/1); copy bảng công chạy.

## 16. V3 - Nhân viên & phân quyền
- [ ] Thêm nhân viên mới (PIN không trùng) → login được bằng PIN mới.
- [ ] Sửa hồ sơ, đổi PIN; khóa nghỉ việc → USERS Inactive, không login được, không mất dữ liệu.
- [ ] User có DuocSuaCauHinh=TRUE (chủ xưởng) tự có đủ quyền nhân sự; cấp quyền lẻ cho PM bằng cách thêm dòng vào QUYEN_NHAN_SU.
- [ ] Nhân viên thường không thấy các nút quản lý.

## 17. V3 - Tạm ứng / thưởng phạt / tăng ca / lương
- [ ] Nhân viên gửi tạm ứng; quản lý duyệt → đã chi; từ chối phải nhập lý do; copy tin Zalo tạm ứng.
- [ ] Thêm/sửa/xóa (mềm) thưởng phạt theo tháng.
- [ ] Tạo tăng ca (duyệt luôn hoặc chờ duyệt); duyệt/từ chối; copy danh sách.
- [ ] Bảng lương sơ bộ: theo giờ = giờ × đơn giá; theo tháng = lương CB; cộng thưởng/phụ cấp, trừ phạt/khấu trừ/tạm ứng đã chi; thiếu dữ liệu hiện "Cần kiểm tra lại".
- [ ] Dashboard nhân sự: số liệu đúng; 4 nút copy Zalo chạy.

## 18. V3.2 - Giờ làm theo phòng ban
- [ ] Backup Sheet → dán Code.gs mới → chạy setupSheets() → có sheet CAU_HINH_CA_PHONG_BAN với 9 dòng mẫu, các sheet cũ + CHAM_CONG cũ nguyên vẹn.
- [ ] Mở /exec thấy "version":"V3.2".
- [ ] CSKH chấm vào 07:30 → không trễ; CSKH vào 08:00 → trễ 25 phút (đã trừ 5 phút cho phép).
- [ ] GiaCong chấm vào 08:00 → không trễ; GiaCong vào 07:45 → không trễ, không lỗi.
- [ ] GiaCong chấm ra 11:30 → về sớm 30p; ra 12:00 → đúng giờ.
- [ ] CSKH chấm ra 11:30 → đúng giờ; ra 11:00 → về sớm 30p.
- [ ] GiaCong làm FULL 08:00-17:30 → 8h công (trừ nghỉ trưa 12:00-13:30).
- [ ] Thêm dòng LICH_LAM cho 1 nhân viên (VD 09:00-13:00 ngày mai) → chấm công ngày đó tính theo lịch riêng, không theo giờ phòng ban.
- [ ] Màn Cấu hình nhân sự → mục "Cấu hình ca theo phòng ban": sửa giờ GiaCong ca CHIEU thành 13:00-17:00 → chấm công tính theo giờ mới, không sửa code.
- [ ] Tắt 1 dòng ca phòng ban → ca đó quay về dùng giờ chung toàn xưởng; Bật lại được.
- [ ] Bảng công ngày / bảng công tháng hiển thị trễ/sớm đúng theo giờ mới.
- [ ] App nghỉ phép cũ vẫn chạy; dữ liệu CHAM_CONG cũ không mất (số liệu cũ giữ nguyên, chỉ bản ghi mới tính theo giờ phòng ban).

## 19. V3.3 - Chấm công GPS
- [ ] Backup Sheet → dán Code.gs mới → chạy setupSheets() → có sheet CAU_HINH_DIA_DIEM_CHAM_CONG (dòng mẫu DD001, tọa độ trống) và CHAM_CONG có thêm 8 cột GPS ở CUỐI, dữ liệu cũ nguyên vẹn.
- [ ] Mở /exec thấy "version":"V3.3".
- [ ] Chưa cấu hình tọa độ xưởng → nhân viên chấm công báo "Chưa cấu hình vị trí xưởng, vui lòng quản lý thiết lập trước."
- [ ] Quản lý (9999) → Cấu hình nhân sự → mục "Cấu hình vị trí chấm công" hiện cảnh báo chưa có tọa độ.
- [ ] Đứng tại xưởng bấm "Lấy vị trí hiện tại làm vị trí xưởng" → trình duyệt xin quyền vị trí → lưu được Vĩ độ/Kinh độ, hiện khối xanh "Đã cấu hình".
- [ ] Nhân viên đứng trong bán kính 400m → chấm vào được, thông báo kèm "(cách xưởng Xm)".
- [ ] Đứng ngoài 400m (hoặc để test: tạm đổi tọa độ xưởng sang chỗ khác xa) → bị chặn: "Bạn đang ở cách xưởng {X}m, vượt quá bán kính cho phép 400m."
- [ ] Từ chối quyền vị trí trên điện thoại → app báo hướng dẫn bật lại, không cho chấm.
- [ ] Tắt định vị điện thoại → không cho chấm.
- [ ] Sheet CHAM_CONG lưu đủ ViDoVao/KinhDoVao/DoChinhXacVao/KhoangCachVao khi chấm vào; ViDoRa/KinhDoRa/DoChinhXacRa/KhoangCachRa khi chấm ra.
- [ ] Bật "Cho phép chấm ngoài vị trí" → ngoài bán kính vẫn chấm được nhưng GhiChuNhanVien có dòng "Chấm công ngoài vị trí cho phép: cách xưởng Xm". (Nhớ tắt lại sau khi test.)
- [ ] Đổi bán kính thành số khác (VD 100) → mức chặn thay đổi theo, không cần sửa code.
- [ ] App nghỉ phép cũ + bảng công ngày/tháng vẫn chạy; dữ liệu CHAM_CONG cũ không mất.

## 20. V3.3.2 - Netlify proxy (test trên điện thoại)
- [ ] Push đủ 3 file lên GitHub: index.html, netlify.toml, netlify/functions/api.js (đúng cấu trúc thư mục).
- [ ] Netlify → Environment variables có `APPS_SCRIPT_URL` = link dạng `https://script.google.com/macros/s/.../exec` (KHÔNG phải link /macros/library/d/...) → Trigger deploy lại.
- [ ] Netlify → Logs → Functions: thấy function `api` được deploy.
- [ ] Mở `https://ten-site.netlify.app/.netlify/functions/api` trên trình duyệt → thấy `{"success":false,"message":"Proxy chỉ hỗ trợ POST."}` (chứng tỏ function sống).
- [ ] Mở app Netlify trên ĐIỆN THOẠI → login PIN được (hết lỗi "Không kết nối được máy chủ").
- [ ] Trên điện thoại: chấm công GPS, đăng ký nghỉ, dashboard, copy Zalo đều chạy.
- [ ] Trên máy tính app vẫn chạy bình thường qua proxy.
- [ ] Cấu hình sai link (thử nghịch) → app báo lỗi rõ từ proxy chứ không im lặng: "Apps Script trả về dữ liệu không phải JSON..." hoặc "Proxy chưa cấu hình APPS_SCRIPT_URL...".

## 21. Lịch sử & dữ liệu
- [ ] Mỗi thao tác (tạo/hủy/duyệt/từ chối/duyệt vượt slot/tạo thay) đều có dòng trong sheet `LEAVE_HISTORY` với trạng thái trước/sau.
- [ ] Sheet `LICH_NGHI` ghi đủ cột: NguoiTao, TaoThayNhanVien, NguoiDuyet, ThoiGianDuyet, LyDoTuChoi.
- [ ] Đổi user `TrangThai` = Inactive trong USERS → user đó không login được nữa; mở app đang đăng nhập sẵn → bị đẩy về màn Login.
