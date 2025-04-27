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
    } else if (request.type === 'findByQuestionId' && request.questionId) {
        // Xử lý tìm kiếm theo ID câu hỏi
        console.log('Search by question ID triggered:', request.questionId);
        findQuestionById(request.questionId, sender.tab.id);
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
    let exactMatch = null;
    let exactImageMatches = [];
    
    // Chuẩn hóa truy vấn để tăng độ chính xác khi so sánh
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    for (const question of questions) {
        // Chuẩn hóa nội dung câu hỏi từ cơ sở dữ liệu
        const normalizedContent = question.content.toLowerCase().trim().replace(/\s+/g, ' ');
        
        // Kiểm tra khớp chính xác trước tiên
        if (normalizedContent === normalizedQuery) {
            console.log('Found EXACT text match:', question.content);
            exactMatch = question;
            
            // Nếu cũng có hình ảnh khớp, đây là kết quả hoàn hảo
            if (imageSource && question.image) {
                const imageRatio = compareImageSources(imageSource, question.image);
                if (imageRatio > 0.9) {
                    console.log('Found exact match with high image similarity!');
                    // Trả về kết quả ngay lập tức với độ tin cậy cao nhất
                    const correctAnswers = question.mc_answers
                        .filter(answer => answer.is_answer === 1)
                        .map(answer => answer.text);
                    
                    return {
                        question: question.content,
                        answers: correctAnswers,
                        confidence: 1.0,
                        imageUrl: question.image || null,
                        questionId: question.id ? question.id.toString() : null
                    };
                }
            }
            
            // Nếu không có hình ảnh khớp, vẫn tiếp tục tìm kiếm để xem có kết quả nào tốt hơn không
        }
        
        // Tính điểm tương đồng văn bản
        let ratio = similarityScore(query, question.content);
        
        // Nếu có hình ảnh, so sánh thêm URL hình ảnh để nâng cao độ chính xác
        if (imageSource && question.image) {
            const imageRatio = compareImageSources(imageSource, question.image);
            
            // Nếu hình ảnh khớp cao, lưu lại để xử lý đặc biệt
            if (imageRatio > 0.9) {
                exactImageMatches.push({
                    question,
                    textRatio: ratio,
                    imageRatio
                });
            }
            
            // Tăng tỷ lệ khớp dựa trên độ tương đồng hình ảnh
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
    
    // Nếu có kết quả khớp chính xác về text, ưu tiên sử dụng
    if (exactMatch) {
        console.log('Using exact text match as best result');
        bestMatch = exactMatch;
        highestRatio = Math.max(highestRatio, 0.95); // Đảm bảo độ tin cậy cao
    }
    
    // Nếu có kết quả khớp chính xác về hình ảnh, xem xét ưu tiên
    if (exactImageMatches.length > 0) {
        // Sắp xếp theo độ tương đồng văn bản giảm dần
        exactImageMatches.sort((a, b) => b.textRatio - a.textRatio);
        const bestImageMatch = exactImageMatches[0];
        
        // Nếu độ tương đồng văn bản đủ cao, ưu tiên kết quả này
        if (bestImageMatch.textRatio > 0.7) {
            console.log('Using best image match as result due to high image similarity');
            bestMatch = bestImageMatch.question;
            highestRatio = Math.max(highestRatio, 0.9); // Đảm bảo độ tin cậy cao
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
    
    // Trích xuất ID của các đáp án đúng nếu có
    const answerIds = [];
    if (bestMatch.mc_answers) {
        bestMatch.mc_answers
            .filter(answer => answer.is_answer === 1)
            .forEach(answer => {
                if (answer.id) {
                    answerIds.push(answer.id.toString());
                }
                // Thêm các ID thay thế nếu có
                if (answer.option_id) {
                    answerIds.push(answer.option_id.toString());
                }
                if (answer.value) {
                    answerIds.push(answer.value.toString());
                }
            });
    }
    
    return {
        question: bestMatch.content,
        answers: correctAnswers,
        confidence: highestRatio,
        imageUrl: bestMatch.image || null,
        questionId: bestMatch.id ? bestMatch.id.toString() : null,
        answerIds: answerIds
    };
}

// Hàm tìm câu hỏi theo ID
function findQuestionById(questionId, tabId) {
    console.log('Finding question by ID:', questionId);
    
    // Lấy dữ liệu câu hỏi từ storage
    chrome.storage.local.get(['questions'], function(result) {
        if (!result.questions || result.questions.length === 0) {
            console.error('No questions found in storage');
            sendQuestionIdResult(tabId, questionId, null);
            return;
        }
        
        console.log('Searching through', result.questions.length, 'questions for ID:', questionId);
        
        // Tìm câu hỏi có ID khớp chính xác với questionId
        const exactMatch = result.questions.find(q => q.iid === questionId);
        
        if (exactMatch) {
            console.log('Found exact match for question ID:', questionId);
            
            // Lấy giá trị (value) của các đáp án đúng
            const correctValues = [];
            if (exactMatch.mc_answers && Array.isArray(exactMatch.mc_answers)) {
                exactMatch.mc_answers.forEach((answer, index) => {
                    if (answer.is_answer === 1) {
                        correctValues.push(index.toString());
                        console.log('Correct answer at index:', index, 'text:', answer.text);
                    }
                });
            }
            
            // Trả về kết quả với các đáp án đúng
            sendQuestionIdResult(tabId, questionId, {
                question: exactMatch.content,
                correctValues: correctValues,
                confidence: 1.0
            });
            return;
        }
        
        console.log('No exact match found for question ID:', questionId);
        sendQuestionIdResult(tabId, questionId, null);
    });
}

// Hàm gửi kết quả tìm kiếm theo ID về content script
function sendQuestionIdResult(tabId, questionId, data) {
    chrome.tabs.sendMessage(tabId, {
        type: 'questionIdResult',
        questionId: questionId,
        data: data
    }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('Error sending ID search result:', chrome.runtime.lastError);
        } else {
            console.log('ID search result sent successfully');
        }
    });
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