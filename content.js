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
    // Alt+A được xử lý bởi autoAnswerManager.init() rồi
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
                        // Thêm kiểm tra cho Alt+A
                        if (event.altKey && (event.key === 'a' || event.key === 'A')) {
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
            
            // Ghi đè phương thức preventDefault để đảm bảo Alt+Q và Alt+A luôn hoạt động
            const originalPreventDefault = Event.prototype.preventDefault;
            Event.prototype.preventDefault = function() {
                if (this.type.startsWith('key') && this.altKey && (
                    this.key === 'q' || this.key === 'Q' || 
                    this.key === 'a' || this.key === 'A')
                ) {
                    // Không gọi preventDefault cho Alt+Q hoặc Alt+A
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
    .auto-answer-status {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        transition: opacity 0.5s;
    }
    .auto-answer-controls {
        position: fixed;
        top: 10px;
        right: 10px;
        background: white;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 10px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: Arial, sans-serif;
    }
    .auto-answer-controls button {
        margin: 5px;
        padding: 5px 10px;
        border: none;
        border-radius: 3px;
        background: #4285f4;
        color: white;
        cursor: pointer;
    }
    .auto-answer-controls button:hover {
        background: #3367d6;
    }
    .auto-answer-controls .status-indicator {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-left: 10px;
        background-color: #ccc;
        transition: background-color 0.3s;
    }
    .auto-answer-controls .status-indicator.active {
        background-color: #4CAF50;
    }
    .auto-answer-controls .status-text {
        display: inline-block;
        margin-left: 5px;
        font-size: 12px;
        color: #555;
    }
`;
document.head.appendChild(style);

// Tạo tooltip element
const tooltip = document.createElement('div');
tooltip.className = 'answer-tooltip';
document.body.appendChild(tooltip);

// Tạo thanh điều khiển tự động trả lời
const autoAnswerControls = document.createElement('div');
autoAnswerControls.className = 'auto-answer-controls';
autoAnswerControls.innerHTML = `
    <div>Tự động trả lời <span class="status-indicator"></span> <span class="status-text">Tắt</span></div>
    <button id="start-auto-answer">Bắt đầu</button>
    <button id="stop-auto-answer">Dừng lại</button>
`;
document.body.appendChild(autoAnswerControls);

// Tạo đối tượng quản lý trạng thái
const autoAnswerManager = {
    _isRunning: false,
    _statusIndicator: document.querySelector('.auto-answer-controls .status-indicator'),
    _statusText: document.querySelector('.auto-answer-controls .status-text'),
    
    get isRunning() {
        console.log('Reading isRunning value:', this._isRunning);
        return this._isRunning;
    },
    
    set isRunning(value) {
        // Chỉ xử lý nếu trạng thái thay đổi
        console.log(`Trying to set isRunning: ${this._isRunning} -> ${value}`);
        if (this._isRunning !== value) {
            console.log(`Auto answer state changing: ${this._isRunning} -> ${value}`);
            this._isRunning = value;
            this.updateUI();
            
            // Nếu tắt, hiển thị thông báo
            if (!value) {
                showStatus('Đã dừng tự động trả lời');
            }
        }
    },
    
    updateUI() {
        console.log('Updating UI with isRunning =', this._isRunning);
        if (this._statusIndicator) {
            if (this._isRunning) {
                this._statusIndicator.classList.add('active');
            } else {
                this._statusIndicator.classList.remove('active');
            }
        }
        
        if (this._statusText) {
            this._statusText.textContent = this._isRunning ? 'Đang chạy' : 'Tắt';
        }
        
        // Cập nhật trạng thái nút
        const startButton = document.getElementById('start-auto-answer');
        const stopButton = document.getElementById('stop-auto-answer');
        
        if (startButton) {
            startButton.disabled = this._isRunning;
            startButton.style.opacity = this._isRunning ? '0.5' : '1';
        }
        
        if (stopButton) {
            stopButton.disabled = !this._isRunning;
            stopButton.style.opacity = !this._isRunning ? '0.5' : '1';
        }
    },
    
    start() {
        console.log('Starting auto-answer');
        if (!this._isRunning) {
            this.isRunning = true;
            autoAnswerQuestions();
        } else {
            console.log('Auto-answer already running');
        }
    },
    
    stop() {
        console.log('Stopping auto-answer');
        this.isRunning = false;
    },
    
    init() {
        this.updateUI();
        
        // Gắn sự kiện cho các nút
        document.getElementById('start-auto-answer').addEventListener('click', () => {
            console.log('Start button clicked');
            this.start();
        });
        
        document.getElementById('stop-auto-answer').addEventListener('click', () => {
            console.log('Stop button clicked');
            this.stop();
        });
        
        // Gắn sự kiện phím tắt Alt+A
        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.key === 'a' || e.key === 'A')) {
                console.log('Alt+A keyboard shortcut detected');
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.start();
            }
        }, true);
    }
};

// Khởi tạo trình quản lý
autoAnswerManager.init();

// Hàm hiển thị trạng thái
function showStatus(message, duration = 3000) {
    let statusElement = document.querySelector('.auto-answer-status');
    
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.className = 'auto-answer-status';
        document.body.appendChild(statusElement);
    }
    
    statusElement.textContent = message;
    statusElement.style.opacity = '1';
    
    setTimeout(() => {
        statusElement.style.opacity = '0';
    }, duration);
}

// Hàm lấy văn bản đã chọn
function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Hàm xử lý tự động trả lời câu hỏi
function autoAnswerQuestions() {
    // Log thông tin khi bắt đầu
    console.log('autoAnswerQuestions started');
    
    if (!autoAnswerManager.isRunning) {
        console.log('Setting autoAnswerManager to running state');
        autoAnswerManager.isRunning = true;
    }
    
    showStatus('Đang tự động trả lời...');
    
    // Tìm tất cả các câu hỏi trên trang
    const questionPanels = document.querySelectorAll('.question-panel');
    console.log('Found question panels:', questionPanels.length);
    
    if (questionPanels.length === 0) {
        console.log('No questions found on page');
        showStatus('Không tìm thấy câu hỏi nào trên trang!');
        autoAnswerManager.isRunning = false;
        return;
    }
    
    // Đếm số câu hỏi đã trả lời
    let answeredCount = 0;
    let processedCount = 0;
    
    // Xử lý từng câu hỏi
    questionPanels.forEach((panel, index) => {
        if (!autoAnswerManager.isRunning) {
            console.log('Auto answer stopped, skipping remaining questions');
            return;
        }
        
        setTimeout(() => {
            if (!autoAnswerManager.isRunning) {
                console.log('Auto answer stopped during timeout');
                return;
            }
            
            // Tìm input radio đầu tiên để lấy thuộc tính name
            const firstRadio = panel.querySelector('input[type="radio"]');
            if (!firstRadio) {
                console.log('No radio input found in panel', index);
                processedCount++;
                return;
            }
            
            // Lấy thuộc tính name từ radio button để tìm câu hỏi
            const questionId = firstRadio.getAttribute('name');
            if (!questionId) {
                console.log('Radio input has no name attribute', index);
                processedCount++;
                return;
            }
            
            console.log('Found question ID from radio name:', questionId);
            
            // Tìm câu trả lời dựa trên ID câu hỏi
            findAnswerByQuestionId(questionId, (data) => {
                if (!autoAnswerManager.isRunning) {
                    console.log('Auto answer stopped during answer search');
                    return;
                }
                
                if (!data) {
                    console.log('No answer found in database for question ID:', questionId);
                    
                    // Nếu không tìm thấy bằng ID, thử tìm bằng nội dung câu hỏi
                    const questionContent = panel.querySelector('.question-content');
                    if (questionContent) {
                        const questionText = questionContent.textContent.trim();
                        const questionImage = questionContent.querySelector('img');
                        const imageSource = questionImage ? questionImage.src : null;
                        
                        findAnswerFromDatabase(questionText, imageSource, (textBasedData) => {
                            processAnswerData(textBasedData, panel, questionId);
                            processedCount++;
                            checkCompletion();
                        });
                    } else {
                        processedCount++;
                        checkCompletion();
                    }
                    return;
                }
                
                // Xử lý kết quả tìm được
                processAnswerData(data, panel, questionId);
                processedCount++;
                checkCompletion();
            });
            
            // Hàm kiểm tra và xử lý hoàn thành
            function checkCompletion() {
                console.log('Processed count:', processedCount, 'Total:', questionPanels.length);
                
                // Kiểm tra nếu đã xử lý hết tất cả câu hỏi
                if (processedCount === questionPanels.length && autoAnswerManager.isRunning) {
                    console.log('All questions processed');
                    const nextButton = document.querySelector('.btn-primary');
                    if (nextButton) {
                        console.log('Found next button, clicking in 1 second');
                        setTimeout(() => {
                            if (autoAnswerManager.isRunning) {
                                simulateClick(nextButton);
                                // Tiếp tục tự động trả lời sau khi trang mới được tải
                                setTimeout(() => {
                                    if (autoAnswerManager.isRunning) {
                                        autoAnswerQuestions();
                                    }
                                }, 1500);
                            }
                        }, 1000);
                    } else {
                        console.log('No next button found, finishing auto answer');
                        showStatus('Đã hoàn thành tự động trả lời!');
                        autoAnswerManager.isRunning = false;
                    }
                }
            }
            
            // Hàm xử lý dữ liệu đáp án
            function processAnswerData(data, panel, questionId) {
                if (!data) {
                    console.log('No answer data to process');
                    return;
                }
                
                console.log('Processing answer data:', data);
                
                // Lấy danh sách các đáp án đúng
                const correctAnswerValues = data.correctValues || [];
                console.log('Correct answer values:', correctAnswerValues);
                
                if (correctAnswerValues.length === 0) {
                    console.log('No correct answer values found');
                    return;
                }
                
                // Lấy tất cả radio buttons của câu hỏi này
                const radioButtons = panel.querySelectorAll(`input[type="radio"][name="${questionId}"]`);
                console.log('Found radio buttons:', radioButtons.length);
                
                let clicked = false;
                
                // Click vào đáp án đúng
                radioButtons.forEach((radio) => {
                    const value = radio.getAttribute('value');
                    console.log('Checking radio value:', value);
                    
                    if (correctAnswerValues.includes(value)) {
                        console.log('Found correct answer radio with value:', value);
                        simulateClick(radio);
                        clicked = true;
                        answeredCount++;
                        showStatus(`Đã trả lời ${answeredCount}/${questionPanels.length} câu hỏi (Khớp ID chính xác)`);
                    }
                });
                
                if (!clicked) {
                    console.log('Failed to find matching radio button for correct answer');
                }
            }
        }, index * 1000);
    });
}

// Hàm tìm câu trả lời dựa trên ID câu hỏi
function findAnswerByQuestionId(questionId, callback) {
    console.log('Searching for answer with question ID:', questionId);
    
    chrome.runtime.sendMessage({
        type: 'findByQuestionId',
        questionId: questionId,
        timestamp: Date.now()
    });
    
    // Lắng nghe phản hồi từ background script
    const messageListener = (message) => {
        if (message.type === 'questionIdResult' && message.questionId === questionId) {
            console.log('Received answer data for question ID:', questionId, message.data);
            
            // Gỡ bỏ event listener để tránh xung đột
            chrome.runtime.onMessage.removeListener(messageListener);
            callback(message.data);
        }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Timeout để tránh chờ vô hạn
    setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.log('Search by ID timeout reached');
        callback(null);
    }, 5000);
}

// Hàm chuẩn hóa URL hình ảnh
function normalizeImageUrl(url) {
    try {
        // Loại bỏ các tham số query không cần thiết
        const urlObj = new URL(url);
        // Giữ lại các tham số quan trọng nếu cần
        const importantParams = ['id', 'v', 'width', 'height'];
        const params = new URLSearchParams();
        importantParams.forEach(param => {
            if (urlObj.searchParams.has(param)) {
                params.append(param, urlObj.searchParams.get(param));
            }
        });
        // Tạo URL mới chỉ với các tham số quan trọng
        urlObj.search = params.toString();
        return urlObj.toString();
    } catch (e) {
        console.error('Error normalizing image URL:', e);
        return url;
    }
}

// Hàm tìm câu trả lời từ cơ sở dữ liệu (gửi yêu cầu đến background script)
function findAnswerFromDatabase(questionText, imageSource, callback) {
    // Chuẩn hóa dữ liệu trước khi gửi
    const normalizedQuestion = questionText.trim().replace(/\s+/g, ' ');
    const normalizedImageSource = imageSource ? normalizeImageUrl(imageSource) : null;
    
    console.log('Searching for answer with:', {
        question: normalizedQuestion,
        image: normalizedImageSource
    });
    
    chrome.runtime.sendMessage({
        type: 'manualSearch',
        text: normalizedQuestion,
        imageSource: normalizedImageSource,
        timestamp: Date.now() // Thêm timestamp để tránh cache
    });
    
    // Lắng nghe phản hồi từ background script với timeout dài hơn
    const messageListener = (message) => {
        if (message.type === 'showAnswer' && message.data) {
            console.log('Received answer data:', message.data);
            
            // Kiểm tra độ tin cậy của câu trả lời
            if (message.data.confidence < 0.6) {
                console.log('Answer confidence too low:', message.data.confidence);
                callback(null);
                return;
            }
            
            // Gỡ bỏ event listener để tránh xung đột
            chrome.runtime.onMessage.removeListener(messageListener);
            callback(message.data);
        }
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Tăng thời gian timeout lên để có thêm thời gian xử lý
    setTimeout(() => {
        chrome.runtime.onMessage.removeListener(messageListener);
        console.log('Search timeout reached');
        callback(null);
    }, 8000); // Tăng lên 8 giây
}

// Hàm mô phỏng click chuột
function simulateClick(element) {
    if (!element || element.disabled) return;
    
    try {
        // Tạo sự kiện click
        const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
        });
        
        // Phát sự kiện
        element.dispatchEvent(clickEvent);
        
        console.log('Đã click vào element:', element);
    } catch (error) {
        console.error('Lỗi khi click vào element:', error);
    }
}

// Cải thiện hàm tính độ tương đồng
function similarityScore(str1, str2) {
    // Chuẩn hóa chuỗi
    str1 = str1.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,!?;:'"]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    
    str2 = str2.toLowerCase().trim()
        .replace(/\s+/g, ' ')
        .replace(/[.,!?;:'"]/g, '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    
    if (str1 === str2) return 1.0;
    
    // Kiểm tra nếu một chuỗi chứa hoàn toàn chuỗi còn lại
    if (str1.includes(str2) || str2.includes(str1)) {
        return 0.9;
    }
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;
    
    // Tính khoảng cách Levenshtein
    const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
    
    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    
    // Tính điểm tương đồng dựa trên khoảng cách và độ dài
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    const similarity = 1 - (distance / maxLength);
    
    // Thêm trọng số cho các từ khóa quan trọng
    const keywords1 = new Set(str1.split(' '));
    const keywords2 = new Set(str2.split(' '));
    const commonWords = [...keywords1].filter(word => keywords2.has(word));
    const keywordBonus = commonWords.length / Math.max(keywords1.size, keywords2.size);
    
    // Kết hợp điểm tương đồng với bonus từ khóa
    return Math.min(1, similarity * 0.7 + keywordBonus * 0.3);
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

// Thêm xử lý message autoAnswer vào phần lắng nghe message từ background script
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
    else if (request.type === 'autoAnswer') {
        // Kích hoạt tự động trả lời
        console.log('Received autoAnswer message');
        autoAnswerManager.start();
        sendResponse({ success: true });
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