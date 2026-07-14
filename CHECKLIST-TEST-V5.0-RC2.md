# CHECKLIST TEST THỰC TẾ V5.0-RC2

> Làm theo THỨ TỰ. Mục 0 phải PASS toàn bộ trước khi bật bất kỳ flag nào.
> Test tự động (84 test) phải PASS trước khi deploy: `node test/run-tests.js`.

## 0. REGRESSION V3.3.3 (mọi flag FALSE - ngay sau deploy)
- [ ] /exec hiện `"version":"V5.0-RC2"`. setupSheetsV5 chạy lần 2 trả báo cáo rỗng.
- [ ] Đếm số dòng LICH_NGHI, CHAM_CONG, USERS, NHAN_VIEN trước/sau setup PHẢI bằng nhau; cột cũ nguyên thứ tự, cột mới nằm CUỐI.
- [ ] Login PIN nhân viên + quản lý; mở lại app tự đăng nhập.
- [ ] Home nhân viên: 4 nút (Chấm công / Xin nghỉ / Lương / Khác); KHÔNG có nút V5 quản lý nào; không popup.
- [ ] "Xin nghỉ" 2 tab hoạt động; đăng ký nghỉ + duyệt + từ chối + hủy như cũ.
- [ ] Chấm công GPS: trong xưởng vào/ra bình thường có "(cách xưởng Xm)".
- [ ] "Lương" của NV hiện ghi chú "chưa bật phiếu lương điện tử" + nút Công của tôi / Tạm ứng chạy như cũ.
- [ ] "Khác": Lịch nghỉ / Công của tôi / Tạm ứng; KHÔNG có Tăng ca/Đổi ca/Về sớm (flag FALSE).
- [ ] Bảng công ngày/tháng, dashboard nghỉ + nhân sự, thưởng phạt, lương sơ bộ, copy Zalo như cũ.
- [ ] Cấu hình nhân sự: KHÔNG còn card "Chế độ khẩn cấp & ngoại lệ GPS"; KHÔNG còn checkbox "Cho phép chấm ngoài vị trí".

## 1. GPS FAIL-CLOSED ĐƠN GIẢN
- [ ] Tắt định vị điện thoại → app chặn ngay tại máy, không gửi request; từ chối quyền → chặn kèm hướng dẫn.
- [ ] Tạm đổi tọa độ xưởng đi xa (qua app) → chấm bị chặn "ngoài khu vực (cách xưởng Xm)" NGAY.
- [ ] Tạm đặt dòng địa điểm Inactive → chặn "Chưa cấu hình địa điểm"; màn chấm công hiện cảnh báo đỏ. (Bật lại sau test.)
- [ ] Sửa ViDo="abc" qua sheet (đợi 5' hoặc sửa qua app) → chặn "không hợp lệ".
- [ ] Trường hợp đặc biệt: PM thêm/sửa công tay ở Bảng công ngày → được, bắt nhập lý do, có dòng CHAM_CONG_HISTORY.

## 2. F1 - Dashboard PM + KPI + đổi ca/về sớm/OT (bật TEST → thử → TRUE)
- [ ] Bật ReminderCenter=TEST: quản lý thấy nút 🎛️ Dashboard PM; NHÂN VIÊN THƯỜNG không thấy gì.
- [ ] Dashboard PM: khối "Cần xử lý" gom nghỉ/tăng ca chờ; Duyệt/Từ chối tại chỗ chạy, từ chối bắt nhập lý do; badge giảm.
- [ ] Khối "Hôm nay": đã vào X/Y, đi trễ, nghỉ, chưa vào, chưa checkout đúng thực tế.
- [ ] Chốt ngày khi còn việc → bắt nhập lý do tồn; chốt xong sinh báo cáo, Copy dán Zalo đúng; PHIEN_XU_LY_PM có dòng mới.
- [ ] Bật KPI: card KPI hiện từng bộ phận + thanh màu; nhập số bill 1 chạm → lưu; chỉ tiêu mặc định sửa trong Cấu hình nhân sự; xem KPI ngày khác.
- [ ] Bật ShiftRequest/EarlyLeave/Overtime (TRUE): NV thấy trong "Khác"; gửi đổi ca → PM duyệt trên Dashboard → LICH_LAM có dòng, chấm công ngày đó tính ca mới; về sớm duyệt → ghi chú vào bảng công; NV đăng ký OT → duyệt → OT vào bảng công tháng; NV hủy được đơn chờ của mình.

## 3. F2 - Phiếu sửa công (AttendanceV2=TEST → TRUE)
- [ ] PM thấy nút ✏️ Sửa công (phiếu). Tạo phiếu "Bù giờ vào" → hiệu lực NGAY, bảng công ngày tính lại, dòng có CoDieuChinh.
- [ ] Tạo phiếu "Đặt lại giờ công (đổi tiền)" → trạng thái "Đang chờ chủ xưởng"; PM khác duyệt bị chặn; chủ xưởng duyệt → áp vào bảng công.
- [ ] Chủ xưởng tự tạo tự duyệt phiếu đổi tiền → phiếu ghi rõ 2 vai.
- [ ] Vô hiệu phiếu → bắt lý do; dữ liệu công KHÔNG tự hoàn tác (đúng thiết kế).
- [ ] Chấm công sau khi bật: CHAM_CONG_EVENT có event CHECKIN/CHECKOUT append-only.

## 4. F3 - Lương & quyết định nhân sự (SalaryHistory=TEST → chạy song song 1 kỳ)
- [ ] Tạo quyết định "Chuyển chính thức" (nhập lương + ngày hiệu lực) → chủ xưởng duyệt → LICH_SU_LUONG có bản ghi, NHAN_VIEN có NgayChinhThuc.
- [ ] Đổi lương GIỮA THÁNG → Bảng lương V5 tự chia 2 giai đoạn, diễn giải từng đoạn bằng lời thường, số tiền = lương ÷ công chuẩn × công thực tế từng đoạn.
- [ ] Nghỉ Có phép 1 ngày trong tháng → phiếu lương: phép đã nghỉ 1, "+ Phép không nghỉ: 1 ngày = X đ"; nghỉ quá 2 ngày → cảnh báo vượt hạn mức, phần vượt không tính công.
- [ ] Đến kỳ 6 tháng → tên NV hiện ở Nhắc nhở của Dashboard PM; duyệt Tăng lương → mốc tự dời.
- [ ] **CHẠY SONG SONG:** Bảng lương V5 đối chiếu Bảng lương sơ bộ cũ cùng tháng - mọi chênh lệch giải thích được từng dòng (phép, giai đoạn, OT chỉ tính đơn duyệt).

## 5. F4 - Chốt công/lương + ký nhận + dashboard chủ (PayrollLock, SalaryConfirm, OwnerDashboard)
- [ ] Chốt CÔNG tháng → sửa công/duyệt nghỉ/OT của tháng đó bị chặn với thông báo rõ; tháng khác vẫn thao tác bình thường.
- [ ] Chốt LƯƠNG khi chưa chốt công → bị chặn; chốt công rồi → chốt lương OK, BANG_LUONG có snapshot LanChot=1 HieuLuc=TRUE.
- [ ] NV mở "Lương" → thấy phiếu 7 con số + THỰC NHẬN → "✅ Tôi đã nhận lương" → ký xong không gỡ được; ký lần 2 bị chặn.
- [ ] Chủ xưởng mở khóa LƯƠNG (bắt lý do) → bản cũ HieuLuc=FALSE còn nguyên chữ ký; chốt lại → LanChot=2, NV ký lại bản mới; PM thường không mở khóa được.
- [ ] Thưởng phạt/tạm ứng "đã chi" của tháng đã chốt lương → bị chặn.
- [ ] Copy dán Excel (TSV) ra đủ cột; Dashboard chủ xưởng: khối số đúng + "Việc PM chưa xử lý" + copy Zalo.

## 6. AN TOÀN & MÁY DÙNG CHUNG
- [ ] Quản lý logout → nhân viên login cùng máy: mọi nút/badge V5 của quản lý biến mất ngay.
- [ ] Tắt mạng → Home vẫn hiện (nút V5 ẩn), không crash, không logout.
- [ ] Log Executions không in số tiền lương.

## KẾT QUẢ
- [ ] Mục 0-1 PASS → cho toàn xưởng dùng như V3.3.3. Mỗi mục 2→5 PASS thực tế ≥3 ngày mới bật đợt sau.
