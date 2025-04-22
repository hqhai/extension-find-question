// Thông báo cho background script biết content script đã sẵn sàng
chrome.runtime.sendMessage({ type: 'contentScriptReady' });

// Vô hiệu hóa chặn copy
document.addEventListener('copy', function(e) {
    e.stopPropagation();
}, true);

document.addEventListener('selectstart', function(e) {
    e.stopPropagation();
}, true);

// Vô hiệu hóa chặn phím
document.addEventListener('keydown', function(e) {
    // Cho phép các phím tắt Alt+Q hoạt động bình thường (không bị chặn)
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.stopPropagation();
        // Ngăn chặn trang web xử lý sự kiện
        e.stopImmediatePropagation();
        // Ngăn chặn hành vi mặc định của trình duyệt
        // e.preventDefault(); // Chỉ bật khi cần thiết
    }
}, true);

document.addEventListener('keyup', function(e) {
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
}, true);

// Vô hiệu hóa các thuộc tính chống copy và chặn phím
function enableInteractions() {
    const css = `
        * {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
            pointer-events: auto !important;
        }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
    
    // Loại bỏ các event listener có thể chặn phím
    const removeBlockingEvents = () => {
        try {
            // Bảo vệ tổ hợp phím Alt+Q
            const originalAddEventListener = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function(type, listener, options) {
                if (['keydown', 'keyup', 'keypress'].includes(type)) {
                    // Bọc listener trong một hàm mới để kiểm tra phím
                    const wrappedListener = function(event) {
                        // Nếu là Alt+Q, không gọi listener gốc
                        if (event.altKey && (event.key === 'q' || event.key === 'Q')) {
                            return;
                        }
                        // Ngược lại, gọi listener gốc
                        return listener.apply(this, arguments);
                    };
                    
                    // Gọi addEventListener gốc với listener đã được bọc
                    return originalAddEventListener.call(this, type, wrappedListener, options);
                }
                
                // Cho các loại sự kiện khác, gọi addEventListener gốc
                return originalAddEventListener.call(this, type, listener, options);
            };
            
            // Ghi đè phương thức preventDefault để đảm bảo Alt+Q luôn hoạt động
            const originalPreventDefault = Event.prototype.preventDefault;
            Event.prototype.preventDefault = function() {
                if (this.type.startsWith('key') && this.altKey && (this.key === 'q' || this.key === 'Q')) {
                    // Không gọi preventDefault cho Alt+Q
                    return;
                }
                // Gọi preventDefault gốc cho các sự kiện khác
                return originalPreventDefault.call(this);
            };
        } catch (error) {
            console.error('Error setting up keyboard protection:', error);
        }
    };
    
    try {
        removeBlockingEvents();
    } catch (error) {
        console.error('Error removing blocking events:', error);
    }
}
enableInteractions();

// Tạo và thêm style cho tooltip
const style = document.createElement('style');
style.textContent = `
    .answer-tooltip {
        position: fixed;
        z-index: 10000;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 10px;
        max-width: 300px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        font-size: 14px;
        display: none;
    }
    .answer-tooltip .confidence {
        color: #666;
        font-size: 12px;
        margin-bottom: 5px;
    }
    .answer-tooltip .answer {
        margin: 5px 0;
        padding: 5px;
        background: #f5f5f5;
        border-radius: 3px;
    }
`;
document.head.appendChild(style);

// Tạo tooltip element
const tooltip = document.createElement('div');
tooltip.className = 'answer-tooltip';
document.body.appendChild(tooltip);

// Hàm lấy văn bản đã chọn
function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Xử lý hiển thị tooltip
function showTooltip(data, x, y) {
    if (!data) {
        tooltip.style.display = 'none';
        return;
    }

    tooltip.innerHTML = `
        <div class="confidence">Độ tương đồng: ${(data.confidence * 100).toFixed(2)}%</div>
        <div><strong>Câu hỏi:</strong> ${data.question}</div>
        <div><strong>Câu trả lời:</strong></div>
        ${data.answers.map(answer => `<div class="answer">${answer}</div>`).join('')}
    `;

    // Điều chỉnh vị trí tooltip
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + 10;
    let top = y + 10;

    if (left + rect.width > viewportWidth) {
        left = viewportWidth - rect.width - 10;
    }
    if (top + rect.height > viewportHeight) {
        top = viewportHeight - rect.height - 10;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.display = 'block';
}

// Lắng nghe message từ background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message:', request);
    
    if (request.type === 'getSelectedText') {
        // Trả về văn bản đã chọn
        const selectedText = getSelectedText();
        sendResponse({ selectedText: selectedText });
    }
    else if (request.type === 'showAnswer') {
        try {
            // Lấy vị trí chuột từ event listener cuối cùng
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            showTooltip(request.data, rect.right, rect.bottom);
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error showing tooltip:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    return true; // Giữ kết nối để có thể gửi response bất đồng bộ
});

// Thêm hàm thủ công để kích hoạt tìm kiếm nếu phím tắt bị chặn
document.addEventListener('keydown', function(e) {
    if (e.altKey && (e.key === 'q' || e.key === 'Q')) {
        // Kích hoạt tìm kiếm thủ công
        const selectedText = getSelectedText();
        if (selectedText) {
            chrome.runtime.sendMessage({
                type: 'manualSearch',
                text: selectedText
            });
        }
    }
}, true);

// Đóng tooltip khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!tooltip.contains(e.target)) {
        tooltip.style.display = 'none';
    }
}); 