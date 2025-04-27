# Quiz Answer Finder Extension

Extension Chrome giúp tìm câu trả lời cho câu hỏi trắc nghiệm một cách nhanh chóng.

## Tính năng

- Tìm câu trả lời dựa trên độ tương đồng của câu hỏi
- Hoạt động trên mọi trang web
- Vô hiệu hóa chặn copy text
- Hiển thị kết quả dưới dạng tooltip
- Hỗ trợ tiếng Việt
- Tự động trả lời câu hỏi trắc nghiệm

## Cách cài đặt

1. Clone repository này về máy:
```bash
git clone https://github.com/hqhai/extension-find-question.git
```

2. Mở Chrome và truy cập `chrome://extensions/`

3. Bật "Developer mode" (góc phải trên)

4. Click "Load unpacked" và chọn thư mục chứa extension

## Cách sử dụng

1. Chọn (bôi đen) đoạn text chứa câu hỏi trên trang web
2. Click chuột phải và chọn "Tìm câu trả lời"
3. Nếu tìm thấy câu hỏi tương tự (độ tương đồng > 60%), extension sẽ hiển thị:
   - Câu hỏi gốc
   - Độ tương đồng
   - Câu trả lời đúng

### Tự động trả lời câu hỏi

1. Khi đang ở trang web có các câu hỏi trắc nghiệm (có cấu trúc tương tự như biểu mẫu), nhấn phím tắt **Alt+A**.
2. Extension sẽ tự động:
   - Phân tích từng câu hỏi trên trang
   - Tìm câu trả lời từ cơ sở dữ liệu 
   - Click chọn đáp án đúng
   - Tiếp tục với các câu hỏi tiếp theo tự động
3. Bạn cũng có thể:
   - Click chuột phải trên trang và chọn "Tự động trả lời tất cả câu hỏi"
   - Sử dụng nút điều khiển xuất hiện ở góc trên bên phải của trang

## Cấu trúc thư mục

```
FK-Extensions/
├── manifest.json      # Cấu hình extension
├── background.js      # Logic xử lý chính
├── content.js         # Script chạy trên trang web
└── question.json.txt  # Dữ liệu câu hỏi
```

## Công nghệ sử dụng

- Chrome Extension Manifest V3
- JavaScript
- Levenshtein Distance Algorithm (tính độ tương đồng văn bản)

## Đóng góp

Mọi đóng góp đều được hoan nghênh! Vui lòng tạo issue hoặc pull request.

## Cập nhật mới

- **Thêm phím tắt**: Bạn có thể sử dụng phím tắt **Alt+Q** để tìm câu trả lời cho câu hỏi đã chọn mà không cần phải sử dụng menu ngữ cảnh.
- **Tự động trả lời**: Sử dụng phím tắt **Alt+A** hoặc click chuột phải và chọn "Tự động trả lời tất cả câu hỏi" để tự động trả lời tất cả câu hỏi trên trang.

# Tiện Ích Mở Rộng Tự Động Trả Lời

## Mô Tả Tổng Quan
Tiện ích mở rộng này được thiết kế để tự động trả lời các câu hỏi trên trang web bằng cách sử dụng cơ sở dữ liệu có sẵn và các thuật toán so sánh văn bản.

## Các Tính Năng Mới
- **Tự Động Trả Lời Câu Hỏi**: Tính năng này cho phép tiện ích tự động chọn câu trả lời đúng dựa trên nội dung câu hỏi và hình ảnh liên quan.
- **Giao Diện Điều Khiển**: Thêm giao diện điều khiển cho phép người dùng bắt đầu và dừng tính năng tự động trả lời.
- **Bảo Vệ Phím Tắt**: Đảm bảo các phím tắt Alt+Q và Alt+A hoạt động bình thường mà không bị chặn bởi trang web.

## Cách Sử Dụng
1. Cài đặt tiện ích mở rộng vào trình duyệt.
2. Truy cập trang web có các câu hỏi cần trả lời.
3. Sử dụng giao diện điều khiển để bắt đầu hoặc dừng tính năng tự động trả lời.
4. Sử dụng phím tắt Alt+A để kích hoạt nhanh tính năng tự động trả lời.

## Cấu Trúc Mã Nguồn
- **content.js**: Chứa logic chính cho việc tự động trả lời và xử lý sự kiện.
- **background.js**: Xử lý các yêu cầu từ content script và quản lý cơ sở dữ liệu câu trả lời.

## Hướng Dẫn Cài Đặt
1. Tải mã nguồn về máy tính của bạn.
2. Mở trình duyệt và truy cập trang quản lý tiện ích mở rộng.
3. Bật chế độ nhà phát triển và tải tiện ích từ thư mục mã nguồn.
4. Tiện ích sẽ sẵn sàng để sử dụng trên các trang web hỗ trợ. 