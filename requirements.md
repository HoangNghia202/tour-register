# DESIGN SPECIFICATION & ARCHITECTURE
## WEBSITE ĐĂNG KÝ TOUR DU LỊCH VÙNG TRUNG BỘ 2026

---

## 1. TỔNG QUAN HỆ THỐNG & TỔNG CỦA MÀN HÌNH (SCREEN FLOW)

```
┌────────────────────────────────────────────────────────┐
│ Màn 1: Welcome & Nhập Mã Số Nhân Viên (MSNV)            │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
     [MSNV Không Hợp Lệ]        [MSNV Hợp Lệ]
               │                         │
               ▼                         ▼
┌──────────────────────────┐   ┌─────────────────────────────────────────┐
│ Thông báo Cảnh báo Red   │   │ Màn 2: Danh Sách Tour (Đà Lạt/Nha Trang)│
│ (Liên hệ Hoàng DM-24776) │   └────────────────────┬────────────────────┘
└──────────────────────────┘                        │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │ Màn 3: Form Đăng Ký Chi Tiết           │
                               │ - Người thân đi cùng (Max 2 Trẻ + 2 NL) │
                               │ - Hình thức & Điểm đón (7 tỉnh)         │
                               │ - Bảng giá tham khảo (Realtime)         │
                               │ - Checkbox xác nhận thông tin           │
                               └────────────────────┬────────────────────┘
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │ Màn 4: Vé Mời Sự Kiện (Event Ticket)    │
                               │ (Định dạng như mẫu thiết kế đính kèm)   │
                               └─────────────────────────────────────────┘
```

---

## 2. CHI TIẾT TỪNG MÀN HÌNH & CHỨC NĂNG (SCREEN SPECIFICATIONS)

### 2.1. Màn hình 1: Welcome & Xác thực Mã Số Nhân Viên
- **Giao diện:**
    - Banner sự kiện: *Tour Du Lịch Vùng Trung Bộ 2026*.
    - Ô input nhập **Mã số nhân viên (MSNV)**.
    - Nút `[ Kiểm tra ]`.
- **Luồng xử lý (Business Rules):**
    - Tra cứu MSNV trong cơ sở dữ liệu đã chuẩn bị trước.
    - **Trường hợp KHÔNG CÓ trong danh sách:**
      Hiển thị thông báo đỏ:
      > *"User nhân viên không nằm trong danh sách đăng ký tham gia Du Lịch, vui lòng liên hệ Hoàng DM - 24776 để được hỗ trợ."*
    - **Trường hợp HỢP LỆ:**
      Chuyển qua Màn hình 2 để chọn Tour tương ứng với địa điểm đã phân công sẵn cho nhân viên đó.

---

### 2.2. Màn hình 2: Màn Hình Đăng Ký / Chọn Tour

Tùy thuộc vào danh sách phân công địa điểm đối với MSNV đã nhập:

#### A. Phân công đi **ĐÀ LẠT** (Hiển thị dạng card)
- **Số lượng Tour:** Chỉ có 1 Tour duy nhất.
- **Giới hạn số chỗ:** Tối đa **750 người** (Realtime capacity display, ví dụ: *Còn lại 320/750 chỗ*).
- **Thông tin hiển thị:** Tên Tour, Hình ảnh đại diện, Địa điểm.
- **File đính kèm:** Link/Nút `[Xem lịch trình Tour / Địa điểm du lịch (PDF)]` $
  ightarrow$ Click mở tab mới (`target="_blank"`).
- **Nút đăng kí:** Click để mở form đăng kí.

#### B. Phân công đi **NHA TRANG** (Hiển thị dạng card cho mỗi đợt tour)
- **Số lượng Tour:** Có 4 lựa chọn tour tương ứng với các đợt đi:
    1. **Nha Trang 1:** Khởi hành từ 28/09 – 30/09 (Max: 450 chỗ)
    2. **Nha Trang 2:** Khởi hành từ 07/10 – 09/10 (Max: 450 chỗ)
    3. **Nha Trang 3:** Khởi hành từ 19/10 – 21/10 (Max: 450 chỗ)
    4. **Nha Trang 4:** Khởi hành từ 21/10 – 23/10 (Max: 450 chỗ)
- **Thông tin từng Tour:** Tên đợt, ngày khởi hành, địa điểm, hình ảnh, badge số lượng còn lại realtime (`Slot còn lại/450`).
- **File đính kèm:** Đường link PDF lịch trình tương ứng từng đợt (Mở tab mới view file).
- - **Nút đăng kí:** Click để mở form đăng kí.

---

### 2.3. Màn hình 3: Form Đăng Ký Chi Tiết & Tùy Chọn

Khi bấm **"Đăng ký"** ở Tour chọn lựa, form nhập thông tin xuất hiện bao gồm:

#### 1. Đăng ký người thân đi cùng
- Có nút `[+ Thêm người thân]` để chọn thêm.
- **Ràng buộc số lượng tối đa:**
    - Trẻ em dưới 10 tuổi: Tối đa **2 trẻ** (Trẻ 1 - Trẻ 2).
    - Người lớn trên 10 tuổi: Tối đa **2 người** (Người thân 1 - Người thân 2).
- **Thông tin chi tiết cần nhập cho từng người thân:**
    - Họ và tên
    - Ngày / Tháng / Năm sinh *(Hệ thống tự động validation độ tuổi thuộc nhóm Trẻ em hay Người lớn)*
    - Giới tính (Nam / Nữ)
    - Mối quan hệ với Nhân Viên (Vợ/Chồng, Con, Bố/Mẹ...)

#### 2. Hình thức di chuyển
- Chọn 1 trong 2 hình thức:
    - `[ ] Tự túc theo Tour Công ty`
    - `[ ] Di chuyển theo Xe Tour`
- Khi chọn **Di chuyển theo Xe Tour**, hiển thị Dropdown chọn **1 trong 7 Điểm đón**:
    1. Hà Tĩnh
    2. Quảng Bình
    3. Quảng Trị
    4. TP. Huế
    5. Đà Nẵng
    6. Quảng Nam
    7. Quảng Ngãi

#### 3. Bảng giá Tour tham khảo (Realtime Pricing Calculator)
- Tự động tính toán tổng số tiền dự kiến dựa theo các thông tin đã điền:
    - Chi phí cho Nhân viên: **0 VNĐ** (100% Công ty tài trợ).
    - Chi phí Người lớn đi kèm: `Đơn giá người lớn × Số lượng người lớn`.
    - Chi phí Trẻ em đi kèm: `Đơn giá trẻ em × Số lượng trẻ em`.
    - **TỔNG TIỀN DỰ KIẾN:** Displays total calculation.

#### 4. Xác nhận thông tin
- Tickbox bắt buộc: `[ ] Tôi đã kiểm tra đầy đủ và xác nhận thông tin chính xác.`
- Button `[ Xác nhận thông tin chính xác ]` *(Chỉ cho phép click khi đã tick checkbox).*

---

### 2.4. Màn hình 4: Vé Mời Tham Gia Tour Du Lịch (Event Ticket)

Sau khi nhấn xác nhận, hệ thống xuất vé mời điện tử hiển thị trực tiếp trên giao diện và cho phép **Tải ảnh vé (.png)**.

**Mẫu Layout Vé Mời (Đã chuẩn hóa theo thiết kế đính kèm):**

```
+-----------------------------------------------------------------+
|  [LOGO BRANDS: TGDD | DMX | TopZone | An Khang | EraBlue...]   |
|                                                                 |
|                         VÙNG HNO+                               |
|                 VÉ MỜI SỰ KIỆN 2026                             |
|                                                                 |
|                   Nguyễn Thị Phương Linh                        |
|                                                                 |
|  +-----------------------------------------------------------+  |
|  | Mã số Nhân viên:                             8830         |  |
|  | Bộ phận:                  BP Quản Lý Siêu Thị - ĐMX        |  |
|  | Siêu thị:         TGD_NAN_VIN - 180 Nguyễn Du              |  |
|  | Tên Tour:                                  Đà Lạt         |  |
|  | Ngày khởi hành:                        28/09/2026         |  |
|  | Địa điểm đón:                            Đà Nẵng         |  |
|  +-----------------------------------------------------------+  |
|                                                                 |
|            VƯỢT ĐỈNH IPO VƯƠN TẦM KHU VỰC                       |
|                  MỖI NĂM VƯỢT TRỘI                              |
|             5 NĂM NHÂN ĐÔI GIÁ TRỊ                              |
|                                                                 |
|   Hãy cùng chúng tôi tạo nên những khoảnh khắc đáng nhớ!        |
|   Chào mừng bạn đến với siêu sự kiện du lịch 2026 vùng HNO+     |
+-----------------------------------------------------------------+