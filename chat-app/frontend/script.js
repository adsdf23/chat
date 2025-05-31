document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginMessage = document.getElementById('login-message');
    const registerMessage = document.getElementById('register-message');

    const authContainer = document.getElementById('auth-container');
    const chatContainer = document.getElementById('chat-container');
    const logoutButton = document.getElementById('logout-button');

    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');

    const API_BASE_URL = 'http://localhost:3000';
    const WS_URL = 'ws://localhost:3000'; // WebSocket URL

    let socket = null;
    let currentUserId = null;
    let currentUsername = null;

    // Function to display messages in the UI
    function showMessage(element, message, isSuccess) {
        element.textContent = message;
        element.className = isSuccess ? 'success-message' : 'error-message';
    }

    // Function to display chat messages
    function displayChatMessage(messageData) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message');

        let senderDisplay = "System";
        if (messageData.type === 'chat') {
            senderDisplay = messageData.senderUsername || 'Unknown User';
             // Check if the message is from the current user
            if (messageData.senderUserId === currentUserId) {
                msgDiv.classList.add('sent');
                senderDisplay = "You"; // Or keep username if preferred
            } else {
                msgDiv.classList.add('received');
            }
            msgDiv.textContent = `${senderDisplay}: ${messageData.content}`;
        } else if (messageData.type === 'info') {
            msgDiv.classList.add('info'); // Add a class for info messages for styling
            msgDiv.textContent = messageData.message;
        } else {
            // Generic display for other types or unformatted messages
             msgDiv.textContent = typeof messageData === 'string' ? messageData : JSON.stringify(messageData);
        }
        messagesDiv.appendChild(msgDiv);
        messagesDiv.scrollTop = messagesDiv.scrollHeight; // Scroll to bottom
    }

    // Initialize WebSocket connection
    function initWebSocket() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected.');
            return;
        }

        currentUserId = parseInt(localStorage.getItem('chatUserId'));
        currentUsername = localStorage.getItem('chatUsername');

        if (!currentUserId || !currentUsername) {
            console.error('User ID or Username not found for WebSocket connection.');
            // Optionally, force logout or show an error
            handleLogout();
            return;
        }

        // Append userId and username as query parameters
        socket = new WebSocket(`${WS_URL}?userId=${currentUserId}&username=${encodeURIComponent(currentUsername)}`);

        socket.onopen = () => {
            console.log('WebSocket connection established.');
            displayChatMessage({ type: 'info', message: 'Connected to chat!' });
        };

        socket.onmessage = (event) => {
            console.log('Message from server:', event.data);
            try {
                const messageData = JSON.parse(event.data);
                displayChatMessage(messageData);
            } catch (e) {
                console.error('Error parsing message from server:', e);
                displayChatMessage({ type: 'info', message: `Received raw: ${event.data}` }); // Display raw if not JSON
            }
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed.');
            displayChatMessage({ type: 'info', message: 'Disconnected from chat. Attempting to reconnect...' });
            // Simple reconnect logic (could be more sophisticated)
            // setTimeout(initWebSocket, 5000); // Attempt to reconnect after 5 seconds
            // For now, just inform the user. A robust app would handle this better.
            // If logout was not intentional, this indicates a problem.
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            displayChatMessage({ type: 'info', message: 'Error connecting to chat.' });
        };
    }

    // Send chat message
    sendButton.addEventListener('click', () => {
        const content = messageInput.value.trim();
        if (content && socket && socket.readyState === WebSocket.OPEN) {
            const messageToSend = {
                type: 'chat',
                content: content
                // senderUsername and senderUserId will be added by the backend
            };
            socket.send(JSON.stringify(messageToSend));
            // Display sent message immediately (optional, backend will broadcast it back)
            // displayChatMessage({ type: 'chat', content: content, senderUserId: currentUserId, senderUsername: currentUsername });
            messageInput.value = '';
        } else if (!socket || socket.readyState !== WebSocket.OPEN) {
            displayChatMessage({type: 'info', message: 'Not connected to chat. Please wait or try logging out and in.'});
        }
    });

    // Allow sending with Enter key
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default action (like form submission if it were in one)
            sendButton.click(); // Trigger send button click
        }
    });


    // Registration
    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        registerMessage.textContent = '';

        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage(registerMessage, data.message || 'Registration successful!', true);
                registerForm.reset();
            } else {
                showMessage(registerMessage, data.message || 'Registration failed.', false);
            }
        } catch (error) {
            console.error('Registration fetch error:', error);
            showMessage(registerMessage, 'An error occurred during registration.', false);
        }
    });

    // Login
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        loginMessage.textContent = '';

        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (response.ok) {
                showMessage(loginMessage, data.message || 'Login successful!', true);
                loginForm.reset();

                localStorage.setItem('chatUsername', data.username); // Store username from response
                localStorage.setItem('chatUserId', data.userId.toString()); // Store userId

                currentUserId = data.userId; // Set for current session
                currentUsername = data.username; // Set for current session

                authContainer.style.display = 'none';
                chatContainer.style.display = 'flex';
                messagesDiv.innerHTML = ''; // Clear previous messages
                initWebSocket(); // Initialize WebSocket after login
            } else {
                showMessage(loginMessage, data.message || 'Login failed.', false);
            }
        } catch (error) {
            console.error('Login fetch error:', error);
            showMessage(loginMessage, 'An error occurred during login.', false);
        }
    });

    function handleLogout() {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
        socket = null;
        localStorage.removeItem('chatUsername');
        localStorage.removeItem('chatUserId');
        currentUserId = null;
        currentUsername = null;

        authContainer.style.display = 'block';
        chatContainer.style.display = 'none';
        loginMessage.textContent = 'Logged out successfully.';
        loginMessage.className = 'success-message';
        registerMessage.textContent = '';
        messagesDiv.innerHTML = ''; // Clear chat messages on logout
    }

    // Logout
    logoutButton.addEventListener('click', handleLogout);

    // Check if user was already logged in
    if (localStorage.getItem('chatUserId') && localStorage.getItem('chatUsername')) {
         authContainer.style.display = 'none';
         chatContainer.style.display = 'flex';
         messagesDiv.innerHTML = ''; // Clear previous messages
         initWebSocket(); // Initialize WebSocket if already logged in
    }
});
