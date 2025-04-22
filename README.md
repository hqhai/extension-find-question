# Quiz Answer Finder Extension

Extension Chrome giúp tìm câu trả lời cho câu hỏi trắc nghiệm một cách nhanh chóng.

## Tính năng

- Tìm câu trả lời dựa trên độ tương đồng của câu hỏi
- Hoạt động trên mọi trang web
- Vô hiệu hóa chặn copy text
- Hiển thị kết quả dưới dạng tooltip
- Hỗ trợ tiếng Việt

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

- **Thêm phím tắt**: Bây giờ bạn có thể sử dụng phím tắt **Alt+Q** để tìm câu trả lời cho câu hỏi đã chọn mà không cần phải sử dụng menu ngữ cảnh. 