// 🚨 IMPORTANT: REPLACE THIS KEY WITH YOUR ACTUAL GOOGLE AI API KEY 🚨
const GEMINI_API_KEY = "AIzaSyDJ5hbH0K2sgtIbMmQMwXrWDzkiSzVkXhE"; 
const MODEL_NAME = "gemini-2.5-flash"; 

// State
// The messages array will store the conversation history to maintain context
// MUST use 'user' and 'model' roles, alternating, for the Gemini API.
let messages = []; 
let isLoading = false;

// DOM Elements
const messagesArea = document.getElementById('messagesArea');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// --- EVENT LISTENERS ---

// Auto-resize textarea
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// Handle Enter key
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send button click
sendButton.addEventListener('click', sendMessage);

// --- UTILITY FUNCTIONS ---

/**
 * Creates the HTML structure for a single message.
 * @param {('user'|'assistant')} role - Role used for CSS styling (user or assistant).
 * @param {string} content - The text content of the message.
 * @returns {string} HTML string
 */
function createMessageHTML(role, content) {
    const isUser = role === 'user';
    // Replace \n with <br> for HTML line breaks
    const contentHTML = content.replace(/\n/g, '<br>');
    return `
        <div class="message ${role}">
            <div class="message-avatar">
                ${isUser ? 
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' :
                    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>'
                }
            </div>
            <div class="message-content">
                <div class="message-bubble">${contentHTML}</div>
            </div>
        </div>
    `;
}

// Create typing indicator HTML
function createTypingIndicator() {
    return `
        <div class="typing-indicator" id="typingIndicator">
            <div class="message-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"></path><rect width="16" height="12" x="4" y="8" rx="2"></rect><path d="M2 14h2"></path><path d="M20 14h2"></path><path d="M15 13v2"></path><path d="M9 13v2"></path></svg>
            </div>
            <div class="typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        </div>
    `;
}

// Show error message in the chat flow
function showError(message) {
    const errorHTML = `<div class="error-message">🚨 ${message}</div>`;
    messagesArea.insertAdjacentHTML('beforeend', errorHTML);
    scrollToBottom();
}

// Scroll to bottom of the messages area
function scrollToBottom() {
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Update UI state (button, input, welcome screen removal)
function updateUI() {
    const welcome = messagesArea.querySelector('.welcome');
    if (welcome && messages.length > 0) {
        welcome.remove();
    }

    sendButton.disabled = isLoading;
    messageInput.disabled = isLoading;
}

// --- MAIN CHAT LOGIC ---

/**
 * Sends the user message to the Gemini API and handles the response.
 */
async function sendMessage() {
    const userText = messageInput.value.trim();
    if (!userText || isLoading) return;

    // 1. Setup UI and update history with user message
    messages.push({ role: 'user', parts: [{ text: userText }] });
    messagesArea.insertAdjacentHTML('beforeend', createMessageHTML('user', userText));
    
    messageInput.value = '';
    messageInput.style.height = 'auto'; 
    
    isLoading = true;
    updateUI();

    // 2. Show typing indicator
    messagesArea.insertAdjacentHTML('beforeend', createTypingIndicator());
    scrollToBottom();

    const typingIndicator = document.getElementById('typingIndicator');

    try {
        // 3. Prepare API Call
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: messages }) 
        });

        // Remove typing indicator immediately after API response is received
        if (typingIndicator) typingIndicator.remove();

        // 4. Handle HTTP Errors
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `API Error: Status ${response.status}`;
            throw new Error(errorMessage);
        }

        let data = await response.json();
        let botReply = "No response text found from the AI.";

        // 5. Robust Response Parsing
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];

            if (candidate.content?.parts?.[0]?.text) {
                botReply = candidate.content.parts[0].text;
            } else if (candidate.finishReason && candidate.finishReason !== 'STOP') {
                botReply = `[Response Blocked] The content may have violated safety policies. Reason: ${candidate.finishReason}`;
            }
        }
        
        // 6. FIX: Add assistant message to history using the correct 'model' role
        messages.push({ role: 'model', parts: [{ text: botReply }] }); 
        
        // 7. Render message to UI using the 'assistant' class
        messagesArea.insertAdjacentHTML('beforeend', createMessageHTML('assistant', botReply));
        scrollToBottom();

    } catch (error) {
        if (typingIndicator) typingIndicator.remove();
        
        console.error('Gemini API Error:', error);
        showError(error.message || 'An unexpected error occurred. Check your API key and console for details.');
        
        // Remove the last user message from history on failure
        messages.pop(); 

    } finally {
        isLoading = false;
        updateUI();
    }
}

// Initial UI update to set button state on load
updateUI();