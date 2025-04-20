// Thông báo cho background script biết content script đã sẵn sàng
chrome.runtime.sendMessage({ type: 'contentScriptReady' });

// Vô hiệu hóa chặn copy
document.addEventListener('copy', function(e) {
    e.stopPropagation();
}, true);

document.addEventListener('selectstart', function(e) {
    e.stopPropagation();
}, true);

// Vô hiệu hóa các thuộc tính chống copy
function enableTextSelection() {
    const css = `
        * {
            -webkit-user-select: text !important;
            -moz-user-select: text !important;
            -ms-user-select: text !important;
            user-select: text !important;
        }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
}
enableTextSelection();

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
    if (request.type === 'showAnswer') {
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

// Đóng tooltip khi click ra ngoài
document.addEventListener('click', (e) => {
    if (!tooltip.contains(e.target)) {
        tooltip.style.display = 'none';
    }
}); 