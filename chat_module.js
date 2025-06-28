// Function to generate unique IDs for chat messages
function generateUniqueId() {
    return 'chat-msg-' + Math.random().toString(36).substr(2, 9);
}

// Function to append message to chat window
function appendMessage(sender, message, isTyping = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageElement = document.createElement('div');
    messageElement.classList.add('flex', 'items-start', 'mb-4');
    messageElement.id = generateUniqueId(); // Assign a unique ID

    let senderIconHtml = '';
    let messageBubbleClass = '';
    let messageTextColor = 'text-gray-800';

    if (sender === 'user') {
        messageElement.classList.add('justify-end'); // Align user message to the right
        senderIconHtml = `
            <div class="flex-shrink-0 bg-gray-300 text-gray-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold ml-2 order-2">คุณ</div>
        `;
        messageBubbleClass = 'bg-blue-500 text-white order-1'; // User messages on the right
    } else { // sender === 'ai'
        senderIconHtml = `
            <div class="flex-shrink-0 bg-blue-200 text-blue-800 rounded-full w-8 h-8 flex items-center justify-center text-sm font-semibold mr-2">AI</div>
        `;
        messageBubbleClass = 'bg-blue-100 text-gray-800'; // AI messages on the left
    }

    messageElement.innerHTML = `
        ${senderIconHtml}
        <div class="${messageBubbleClass} p-3 rounded-xl max-w-[80%] shadow-sm">
            ${isTyping ? '<div class="typing-indicator flex space-x-1"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' : `<p class="text-sm ${messageTextColor}">${message}</p>`}
        </div>
    `;

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
}

// Function to remove typing indicator
function removeTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        const typingIndicator = chatMessages.querySelector('.typing-indicator');
        if (typingIndicator && typingIndicator.parentElement) {
            typingIndicator.parentElement.parentElement.remove(); // Remove the entire message element
        }
    }
}

// Function to send message to Gemini AI
async function sendMessageToAI(userMessage, context = {}) {
    appendMessage('user', userMessage);
    appendMessage('ai', '', true); // Show typing indicator

    let chatHistory = [];
    let prompt = `คุณคือ EduBio AI ผู้ช่วยอัจฉริยะสำหรับเว็บไซต์ชีววิทยาออนไลน์ EduBio. 
    คุณสามารถตอบคำถามเกี่ยวกับเนื้อหาบทเรียน, ช่วยหาข้อมูลในเว็บไซต์, หรือตอบคำถามทั่วไปเกี่ยวกับชีววิทยา.
    
    ข้อมูลบทเรียนที่คุณสามารถใช้เป็นบริบทได้:
    ${JSON.stringify(context.lessonsData || {})}
    
    คำแนะนำพิเศษ:
    - ถ้าผู้ใช้ถามเกี่ยวกับเนื้อหาบทเรียนที่ให้มา ให้ใช้ข้อมูลจาก 'text' และ 'explanation' ของบทเรียนนั้นตอบ.
    - ถ้าผู้ใช้ถามถึงสิ่งที่ไม่แน่ใจว่าอยู่ในเว็บไซต์ ให้แนะนำว่าอาจจะต้องค้นหาจากแหล่งข้อมูลภายนอก (เช่น Google, Wikipedia) หรือระบุว่าคุณสามารถช่วยค้นหาข้อมูลในเว็บไซต์ได้เท่านั้น.
    - พยายามให้คำตอบที่กระชับและเป็นประโยชน์.
    
    คำถามของผู้ใช้: "${userMessage}"`;

    chatHistory.push({ role: "user", parts: [{ text: prompt }] });

    const payload = {
        contents: chatHistory,
        generationConfig: {
            // Optional: configure model generation parameters here if needed
            // temperature: 0.7,
            // maxOutputTokens: 200,
        }
    };

    // แก้ไข: ดึง API Key จากตัวแปร global __api_key หากมี, มิฉะนั้นใช้ค่าว่างเปล่าเพื่อให้ Canvas จัดการ
    // เพิ่มการตรวจสอบว่า __api_key ถูกส่งมาจาก Canvas environment หรือไม่
    const apiKey = typeof __api_key !== 'undefined' && __api_key ? __api_key : ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API error: ${response.status} - ${errorData.error.message}`);
        }

        const result = await response.json();
        removeTypingIndicator();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const aiResponseText = result.candidates[0].content.parts[0].text;
            appendMessage('ai', aiResponseText);
        } else {
            appendMessage('ai', 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้ โปรดลองอีกครั้ง');
            console.error('Unexpected API response structure:', result);
        }
    } catch (error) {
        removeTypingIndicator();
        appendMessage('ai', `ขออภัยครับ เกิดข้อผิดพลาดในการเชื่อมต่อกับ AI: ${error.message}`);
        console.error('Error communicating with Gemini API:', error);
    } finally {
        // Ensure chat input is cleared and enabled
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.value = '';
            chatInput.disabled = false;
            chatInput.focus(); // Focus input after response
        }
    }
}

// Global variable to hold lesson data context
let chatLessonsData = {};

// Function to set lessons data context from parent page
export function setChatContext(lessons) { // Exported for external use
    chatLessonsData = lessons;
    console.log("Chat module received lesson data context.");
}

// Main initialization function for the chat module
export function initChatModule() { // Exported for external use
    const openChatBtn = document.getElementById('openChatBtn');
    const chatModal = document.getElementById('chatModal');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    console.log("initChatModule fired.");
    console.log("openChatBtn element:", openChatBtn);
    console.log("chatModal element:", chatModal);

    if (openChatBtn) {
        openChatBtn.addEventListener('click', () => {
            console.log("Open chat button clicked.");
            if (chatModal) {
                // Toggle display for the modal to appear/disappear
                if (chatModal.classList.contains('hidden')) {
                    chatModal.classList.remove('hidden');
                    chatModal.style.display = 'flex'; // Explicitly set display to flex for positioning
                    console.log("Chat modal opened. Display style:", chatModal.style.display);
                    chatInput.focus(); // Focus on input when modal opens
                } else {
                    chatModal.classList.add('hidden');
                    chatModal.style.display = 'none'; // Explicitly set display to none
                    console.log("Chat modal closed. Display style:", chatModal.style.display);
                }
            } else {
                console.error("Chat modal element not found when trying to open!");
            }
        });
    } else {
        console.error("Open chat button (id='openChatBtn') not found in DOM.");
    }

    if (closeChatBtn) {
        closeChatBtn.addEventListener('click', () => {
            console.log("Close chat button clicked.");
            if (chatModal) {
                chatModal.classList.add('hidden');
                chatModal.style.display = 'none'; // Explicitly set display to none
                console.log("Chat modal closed. Display style:", chatModal.style.display);
            } else {
                console.error("Chat modal element not found when trying to close!");
            }
        });
    } else {
        console.error("Close chat button (id='closeChatBtn') not found in DOM.");
    }

    // Send message on button click
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', () => {
            console.log("Send chat button clicked.");
            const userMessage = chatInput.value.trim();
            if (userMessage) {
                chatInput.disabled = true; // Disable input while sending
                sendMessageToAI(userMessage, { lessonsData: chatLessonsData }); // Pass context
            }
        });
    } else {
        console.error("Send chat button (id='sendChatBtn') not found in DOM.");
    }

    // Send message on Enter key press
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log("Enter key pressed in chat input.");
                const userMessage = chatInput.value.trim();
                if (userMessage) {
                    chatInput.disabled = true; // Disable input while sending
                    sendMessageToAI(userMessage, { lessonsData: chatLessonsData }); // Pass context
                }
            }
        });
    } else {
        console.error("Chat input (id='chatInput') not found in DOM.");
    }
}

// Do NOT call initChatModule() here. It will be called from home.html/lesson_detail.html
// after chat_module.html content is loaded into the DOM.
