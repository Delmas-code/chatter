// DOM Elements
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');
const currentUserElement = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const conversationsList = document.getElementById('conversations-list');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const messageFormContainer = document.getElementById('message-form-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// App State
let currentUser = null;
let activeReceiver = null;
let socket = null;
let activeConversations = new Set();

// Switch between login and register forms
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.style.display = 'flex';
    loginForm.style.display = 'none';
});


// Function to load user's previous conversations
async function loadConversations() {
    try {
        const response = await fetch('/conversations');
        const data = await response.json();
        
        if (response.ok) {
            // Add each conversation to the active conversations set
            data.conversations.forEach(username => {
                activeConversations.add(username);
            });
            
            // Update the conversations list in the UI
            updateConversationsList();
        } else {
            console.error('Error loading conversations:', data.message);
        }
    } catch (error) {
        console.error('Error loading conversations:', error);
    }
}

// Register form submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            registerMessage.textContent = data.message;
            registerMessage.classList.add('success');
            registerMessage.classList.remove('error');
            registerForm.reset();
            
            // Switch to login tab
            setTimeout(() => {
                loginTab.click();
                registerMessage.textContent = '';
            }, 2000);
        } else {
            registerMessage.textContent = data.message;
            registerMessage.classList.add('error');
            registerMessage.classList.remove('success');
        }
    } catch (error) {
        registerMessage.textContent = 'An error occurred. Please try again.';
        registerMessage.classList.add('error');
        registerMessage.classList.remove('success');
        console.error('Registration error:', error);
    }
});

// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user.username;
            loginMessage.textContent = data.message;
            loginMessage.classList.add('success');
            loginMessage.classList.remove('error');
            loginForm.reset();
            
            // Switch to chat interface
            setTimeout(() => {
                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                currentUserElement.textContent = currentUser;
                initializeSocket();
                // Load user's previous conversations
                loadConversations();
            }, 1000);
        } else {
            loginMessage.textContent = data.message;
            loginMessage.classList.add('error');
            loginMessage.classList.remove('success');
        }
    } catch (error) {
        loginMessage.textContent = 'An error occurred. Please try again.';
        loginMessage.classList.add('error');
        loginMessage.classList.remove('success');
        console.error('Login error:', error);
    }
});

// Logout functionality
logoutBtn.addEventListener('click', async () => {
    try {
        const response = await fetch('/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            currentUser = null;
            activeReceiver = null;
            
            // Disconnect socket
            if (socket) {
                socket.disconnect();
                socket = null;
            }
            
            // Clear UI state
            messagesContainer.innerHTML = '';
            conversationsList.innerHTML = '';
            searchResults.innerHTML = '';
            searchInput.value = '';
            activeConversations.clear();
            
            // Switch back to auth interface
            chatContainer.style.display = 'none';
            authContainer.style.display = 'block';
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Search for users
searchBtn.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    
    if (!query) return;
    
    try {
        const response = await fetch(`/search?username=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (response.ok) {
            displaySearchResults(data.users);
        } else {
            console.error('Search error:', data.message);
        }
    } catch (error) {
        console.error('Search error:', error);
    }
});

// Display search results
function displaySearchResults(users) {
    console.log(users)
    searchResults.innerHTML = '';
    
    if (users.length === 0) {
        searchResults.innerHTML = '<p>No users found</p>';
        return;
    }
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.classList.add('user-item');
        
        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = user.username;
        
        const chatButton = document.createElement('button');
        chatButton.classList.add('btn', 'btn-small');
        chatButton.textContent = 'Chat';
        chatButton.addEventListener('click', () => {
            startChat(user.username);
        });
        
        userElement.appendChild(usernameSpan);
        userElement.appendChild(chatButton);
        searchResults.appendChild(userElement);
    });
}

// Start a chat with a user
// function startChat(username) {
//     if (username === currentUser) return;
    
//     activeReceiver = username;
    
//     // Update chat header
//     chatHeader.innerHTML = `<h3>Chat with ${username}</h3>`;
    
//     // Show message form
//     messageFormContainer.style.display = 'block';

//     // Check if the conversation is already in activeConversations
//     const conversationExists = Array.from(activeConversations).some(convo => convo.username === username);
    
//     // Add to conversations list if not already there
//     if (!conversationExists) {
//         activeConversations.add({ username: username, unread_count: 0 });
//         updateConversationsList();
//     }

//     // Mark active conversation
//     const conversationItems = conversationsList.querySelectorAll('li');
//     conversationItems.forEach(item => {
//         if (item.dataset.username === username) {
//             item.classList.add('active');
//         } else {
//             item.classList.remove('active');
//         }
//     });
    
//     // Load chat history
//     loadChatHistory(username);

//     // Clear search results and search input
//     searchResults.innerHTML = '';
//     searchInput.value = '';
// }

function startChat(username) {
    if (username === currentUser) return;

    activeReceiver = username;

    // Update chat header
    chatHeader.innerHTML = `<h3>Chat with ${username}</h3>`;

    // Show message form
    messageFormContainer.style.display = 'block';

    // Check if the conversation is already in activeConversations
    const conversationExists = Array.from(activeConversations).some(convo => convo.username === username);

    // Add to conversations list if not already there
    if (!conversationExists) {
        activeConversations.add({ username: username, unread_count: 0 });
        updateConversationsList();
    }

    // Mark active conversation
    const conversationItems = conversationsList.querySelectorAll('li');
    conversationItems.forEach(item => {
        if (item.dataset.username === username) {
            item.classList.add('active');
            // Reset unread count in UI immediately
            const unreadBadge = item.querySelector('.unread-count');
            if (unreadBadge) {
                unreadBadge.remove();
            }
            // Reset unread count in activeConversations data
            const activeConvo = Array.from(activeConversations).find(c => c.username === username);
            if (activeConvo) {
                activeConvo.unread_count = 0;
            }
        } else {
            item.classList.remove('active');
        }
    });

    // Load chat history
    loadChatHistory(username);

    // Clear search results and search input
    searchResults.innerHTML = '';
    searchInput.value = '';

    // Mark loaded incoming messages as read
    setTimeout(() => { // Use setTimeout to ensure messages are loaded
        const incomingMessages = messagesContainer.querySelectorAll('.message-incoming:not([data-read])');
        incomingMessages.forEach(msgElement => {
            const messageId = msgElement.dataset.messageId;
            if (messageId) {
                socket.emit('read_message', { message_id: messageId });
                msgElement.dataset.read = true; // Mark as read in UI to avoid re-triggering
            }
        });
    }, 500); // Adjust the timeout as needed
}


// Update conversations list
function updateConversationsList() {
    conversationsList.innerHTML = '';

    activeConversations.forEach(convo => {
        const listItem = document.createElement('li');
        listItem.textContent = convo.username; // Or however you display the name
        listItem.dataset.username = convo.username;

        if (convo.username === activeReceiver) {
            listItem.classList.add('active');
        }

        // Display unread count
        if (convo.unread_count > 0) {
            const unreadBadge = document.createElement('span');
            unreadBadge.textContent = `(${convo.unread_count})`;
            unreadBadge.classList.add('unread-count'); // Style this
            listItem.appendChild(unreadBadge);
        }

        listItem.addEventListener('click', () => {
            startChat(convo.username);
            // Reset unread count when chat is opened
            convo.unread_count = 0;
            updateConversationsList();
        });

        conversationsList.appendChild(listItem);
    });
}

// Load chat history
async function loadChatHistory(username) {
    try {
        const response = await fetch(`/chat/${username}`);
        const data = await response.json();
        
        if (response.ok) {
            displayMessages(data.messages);
        } else {
            console.error('Error loading chat history:', data.message);
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Display messages
function displayMessages(messages) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No messages yet. Start the conversation!';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.color = '#888';
        emptyMessage.style.marginTop = '20px';
        messagesContainer.appendChild(emptyMessage);
        return;
    }
    
    messages.forEach(message => {
        displayMessage(message);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function displayMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message-bubble');
    messageElement.dataset.messageId = message._id;

    const contentElement = document.createElement('div');
    contentElement.textContent = message.content;

    const timestampElement = document.createElement('div');
    timestampElement.classList.add('message-timestamp');
    const timestamp = new Date(message.created_at || message.timestamp);
    timestampElement.textContent = formatTimestamp(timestamp);

    messageElement.appendChild(contentElement);
    messageElement.appendChild(timestampElement);
    messagesContainer.appendChild(messageElement);

    if (message.sender === currentUser) {
        messageElement.classList.add('message-outgoing');
        // Status ticks for outgoing messages
        const statusDiv = document.createElement('div');
        statusDiv.classList.add('message-status');
        const sentTick = document.createElement('span');
        sentTick.innerHTML = '✓';
        statusDiv.appendChild(sentTick);
        statusDiv.classList.add('outgoing-status'); // Add a class for easier targeting later

        // let deliveredTick;
        // if (message.delivered_at) {
        //     deliveredTick = document.createElement('span');
        //     deliveredTick.innerHTML = '✓';
        //     statusDiv.appendChild(deliveredTick);
        // }

        let readTicks;
        if (message.read_at) {
            readTicks = document.createElement('span');
            readTicks.innerHTML = '✓✓';
            readTicks.style.color = 'blue';
            statusDiv.appendChild(readTicks);
        }
        messageElement.appendChild(statusDiv);
    } else {
        messageElement.classList.add('message-incoming');
    }
}

function formatTimestamp(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return `Today at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    } else {
        return `${date.toLocaleDateString()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
}

// Send message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const content = messageInput.value.trim();
    
    if (!content || !activeReceiver) return;
    
    // Send message through socket
    socket.emit('send_message', {
        receiver: activeReceiver,
        content: content
    });
    
    // Clear input
    messageInput.value = '';
});

// Initialize Socket.IO connection
function initializeSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Socket connected');
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });


    socket.on('receive_message', (message) => {
        // Add sender to conversations if not already there
        const conversationExists = Array.from(activeConversations).some(convo => convo.username === message.sender);
        if (!conversationExists) {
            activeConversations.add({ username: message.sender, unread_count: 1 }); // Initialize with 1 unread message
            updateConversationsList();
        } else if (activeReceiver !== message.sender) {
            // Find the conversation object in the Set and update unread count
            for (const convo of activeConversations) {
                if (convo.username === message.sender) {
                    convo.unread_count = (convo.unread_count || 0) + 1;
                    break; // Exit the loop once found and updated
                }
            }
            updateConversationsList();
        }
    
        // Display message if it's from the active conversation
        if (activeReceiver === message.sender) {
            displayMessage(message);
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            // TODO: Add notification for new message
            console.log(`New message from ${message.sender}`);
        }
    });


    socket.on('message_sent', (message) => {
        // Display sent message
        if (activeReceiver === message.receiver) {
            displayMessage(message);
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });


    socket.on('message_delivered', (data) => {
        const messageElements = messagesContainer.querySelectorAll(`.message-bubble.message-outgoing[data-message-id="${data.message_id}"]`);
        messageElements.forEach(el => {
            const statusDiv = el.querySelector('.outgoing-status');
            if (statusDiv && !statusDiv.querySelector('.delivered-tick')) {
                const deliveredTick = document.createElement('span');
                // deliveredTick.innerHTML = '✓';
                // deliveredTick.classList.add('delivered-tick');
                // statusDiv.appendChild(deliveredTick);
            }
        });
    });

    messagesContainer.addEventListener('scroll', () => {
        const messageElements = messagesContainer.querySelectorAll('.message-bubble.message-incoming:not([data-read])');
        messageElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= messagesContainer.clientHeight) {
                const messageId = el.dataset.messageId; // Get the stored _id
                if (messageId) {
                    socket.emit('read_message', { message_id: messageId });
                    el.dataset.read = true;
                }
            }
        });
    });

    // socket.on('message_read', (data) => {
    //     const messageElements = messagesContainer.querySelectorAll(`.message-bubble.message-outgoing[data-message-id="${data.message_id}"]`);
    //     messageElements.forEach(el => {
    //         const statusDiv = el.querySelector('.outgoing-status');
    //         if (statusDiv) {
    //             const deliveredTick = statusDiv.querySelector('.delivered-tick');
    //             // statusDiv.removeChild('span');
    //             if (deliveredTick) {
    //                 deliveredTick.remove(); // Remove the single delivered tick
    //             }
    //             if (!statusDiv.querySelector('.read-ticks')) {
    //                 const readTicks = document.createElement('span');
    //                 readTicks.innerHTML = '✓✓';
    //                 readTicks.style.color = 'blue';
    //                 readTicks.classList.add('read-ticks');
    //                 statusDiv.appendChild(readTicks);
    //             }
    //         }
    //     });
    // });

    socket.on('message_read', (data) => {
        const messageElements = messagesContainer.querySelectorAll(`.message-bubble.message-outgoing[data-message-id="${data.message_id}"]`);
        messageElements.forEach(el => {
            const statusDiv = el.querySelector('.outgoing-status');
            if (statusDiv) {
                // Remove any existing ticks first
                statusDiv.innerHTML = ''; 
                const readTicks = document.createElement('span');
                readTicks.innerHTML = '✓';
                // readTicks.style.color = 'blue';
                readTicks.classList.add('read-ticks');
                statusDiv.appendChild(readTicks);
            }
        });
    });
    
}