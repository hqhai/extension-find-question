// Biến để theo dõi trạng thái content script
let contentScriptReady = false;

// Lắng nghe thông báo từ content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'contentScriptReady') {
        contentScriptReady = true;
        console.log('Content script ready in tab:', sender.tab.id);
    } else if (request.type === 'manualSearch' && request.text) {
        // Xử lý tìm kiếm thủ công từ content script
        console.log('Manual search triggered with text:', request.text);
        processSelectedText(request.text, sender.tab.id, request.imageSource || null);
    }
});

// Hàm tìm và trả về câu trả lời
function processSelectedText(selectedText, tabId, imageSource = null) {
    console.log('Selected text:', selectedText);
    console.log('Image source:', imageSource);
    
    // Lấy dữ liệu câu hỏi từ storage
    chrome.storage.local.get(['questions'], function(result) {
        console.log('Got questions from storage:', result.questions ? result.questions.length : 0);
        
        if (result.questions) {
            const answer = findAnswer(result.questions, selectedText, imageSource);
            console.log('Found answer:', answer);
            
            // Gửi kết quả về content script
            chrome.tabs.sendMessage(tabId, {
                type: 'showAnswer',
                data: answer
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    // Nếu content script chưa sẵn sàng, reload tab và thử lại
                    chrome.tabs.reload(tabId);
                } else if (response && response.success) {
                    console.log('Answer shown successfully');
                } else if (response && response.error) {
                    console.error('Error showing answer:', response.error);
                }
            });
        } else {
            console.error('No questions found in storage');
        }
    });
}

// Hàm tính độ tương đồng giữa hai chuỗi
function similarityScore(str1, str2) {
    str1 = str1.toLowerCase();
    str2 = str2.toLowerCase();
    
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;
    
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
    
    return 1 - (matrix[len1][len2] / Math.max(len1, len2));
}

// Hàm tính độ tương đồng giữa hai URL hình ảnh
function compareImageSources(src1, src2) {
    if (!src1 || !src2) return 0;
    
    // Trích xuất phần tên file từ đường dẫn URL
    try {
        const getFileName = (url) => {
            // Loại bỏ querystring và hash nếu có
            const cleanUrl = url.split('?')[0].split('#')[0];
            // Lấy phần tên file
            const parts = cleanUrl.split('/');
            return parts[parts.length - 1];
        };
        
        const filename1 = getFileName(src1);
        const filename2 = getFileName(src2);
        
        // So sánh tên file
        return similarityScore(filename1, filename2);
    } catch (error) {
        console.error('Error comparing image sources:', error);
        return 0;
    }
}

// Hàm tìm câu trả lời
function findAnswer(questions, query, imageSource = null) {
    console.log('Searching for:', query);
    console.log('With image source:', imageSource);
    console.log('Number of questions:', questions.length);
    
    let bestMatch = null;
    let highestRatio = 0;
    
    for (const question of questions) {
        let ratio = similarityScore(query, question.content);
        
        // Nếu có hình ảnh, so sánh thêm URL hình ảnh để nâng cao độ chính xác
        if (imageSource && question.image) {
            const imageRatio = compareImageSources(imageSource, question.image);
            // Nếu hình ảnh khớp cao, tăng độ tương đồng tổng thể
            if (imageRatio > 0.7) {
                ratio = Math.max(ratio, (ratio + imageRatio) / 2);
                console.log('Image match boost for question:', question.content, 'New ratio:', ratio);
            }
        }
        
        if (ratio > highestRatio) {
            highestRatio = ratio;
            bestMatch = question;
        }
    }
    
    console.log('Best match ratio:', highestRatio);
    
    if (highestRatio < 0.6) {
        console.log('No match found');
        return null;
    }
    
    const correctAnswers = bestMatch.mc_answers
        .filter(answer => answer.is_answer === 1)
        .map(answer => answer.text);
    
    console.log('Found answer:', correctAnswers);
    
    return {
        question: bestMatch.content,
        answers: correctAnswers,
        confidence: highestRatio
    };
}

// Khởi tạo context menu và load dữ liệu
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
    
    // Tạo context menu
    chrome.contextMenus.create({
        id: "findAnswer",
        title: "Tìm câu trả lời",
        contexts: ["selection"]
    });

    // Thêm context menu cho tự động trả lời
    chrome.contextMenus.create({
        id: "autoAnswer",
        title: "Tự động trả lời tất cả câu hỏi",
        contexts: ["page"]
    });

    // Load dữ liệu câu hỏi
    console.log('Loading questions...');
    fetch(chrome.runtime.getURL('question.json.txt'))
        .then(response => {
            console.log('Got response:', response.status);
            return response.json();
        })
        .then(data => {
            console.log('Parsed JSON data');
            const questions = data.result.questions.result;
            console.log('Number of questions loaded:', questions.length);
            chrome.storage.local.set({ questions: questions }, () => {
                console.log('Questions saved to storage');
            });
        })
        .catch(error => {
            console.error('Error loading questions:', error);
        });
});

// Xử lý khi click vào context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "findAnswer") {
        processSelectedText(info.selectionText, tab.id);
    } else if (info.menuItemId === "autoAnswer") {
        // Gửi lệnh tự động trả lời đến content script
        chrome.tabs.sendMessage(tab.id, { type: 'autoAnswer' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending auto-answer message:', chrome.runtime.lastError);
            }
        });
    }
});

// Lắng nghe phím tắt
chrome.commands.onCommand.addListener((command, tab) => {
    console.log('Command received:', command);
    if (command === 'find-answer') {
        // Lấy text đã bôi đen từ trang hiện tại
        chrome.tabs.sendMessage(tab.id, { type: 'getSelectedText' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
                return;
            }
            
            if (response && response.selectedText) {
                processSelectedText(response.selectedText, tab.id);
            } else {
                console.error('No text selected or unable to get selected text');
            }
        });
    } else if (command === 'auto-answer') {
        // Gửi lệnh tự động trả lời đến content script
        chrome.tabs.sendMessage(tab.id, { type: 'autoAnswer' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending auto-answer message:', chrome.runtime.lastError);
            }
        });
    }
}); 