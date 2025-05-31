const express = require('express');
const bcrypt = require('bcrypt');
const http = require('http'); // Import http module
const WebSocket = require('ws'); // Import ws module

const app = express();
const server = http.createServer(app); // Create HTTP server from Express app
const wss = new WebSocket.Server({ server }); // Create WebSocket server attached to HTTP server

const PORT = process.env.PORT || 3000;

app.use(express.json());

const users = []; // In-memory store for users

// Keep track of connected clients
// A Map can store userId -> WebSocket connection
const clients = new Map();

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (users.find(user => user.username === username)) {
            return res.status(400).json({ message: 'Username already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: users.length + 1, username, password: hashedPassword };
        users.push(newUser);
        console.log('User registered:', newUser);
        res.status(201).json({ message: 'User registered successfully', userId: newUser.id });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid username or password' });
        }
        console.log('User logged in:', user.username, 'userId:', user.id);
        res.status(200).json({ message: 'Login successful', userId: user.id, username: user.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in' });
    }
});

// WebSocket server logic
wss.on('connection', (ws, req) => {
    // Extract userId from query parameter (example: ws://localhost:3000?userId=1)
    // This is a simple way to associate a WebSocket connection with a user.
    // A more robust solution might involve a token sent after login.
    const urlParams = new URLSearchParams(req.url.slice(1)); // Slice off the leading '/' or '/?'
    const userId = parseInt(urlParams.get('userId'));
    const username = urlParams.get('username'); // Get username as well

    if (!userId || !username) {
        console.log('Connection attempt without userId or username. Closing.');
        ws.close();
        return;
    }

    console.log(`Client connected: userId ${userId} (${username})`);
    clients.set(userId, { ws, username }); // Store WebSocket connection and username

    // Broadcast a 'user connected' message (optional)
    broadcastMessage(JSON.stringify({ type: 'info', message: `${username} has joined the chat.` }), userId, true);


    ws.on('message', (message) => {
        console.log(`Received message from userId ${userId} (${username}): ${message}`);
        // For now, assume message is a string. For structured messages, parse JSON.
        // Let's make it structured: { type: "chat", content: "Hello", senderUsername: "userA" }
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'chat') {
                // Add sender information before broadcasting
                const messageToSend = JSON.stringify({
                    type: 'chat',
                    content: parsedMessage.content,
                    senderUsername: username,
                    senderUserId: userId,
                    timestamp: new Date().toISOString()
                });
                broadcastMessage(messageToSend, userId); // Broadcast to others
            }
        } catch (e) {
            console.error("Failed to parse message or not a chat message:", e);
            // Optionally send an error back to the sender or just log
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: userId ${userId} (${username})`);
        clients.delete(userId);
        // Broadcast a 'user disconnected' message (optional)
        broadcastMessage(JSON.stringify({ type: 'info', message: `${username} has left the chat.` }), userId, true);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for userId ${userId} (${username}):`, error);
        // Ensure client is removed if an error causes disconnection
        if (clients.has(userId)) {
            clients.delete(userId);
            broadcastMessage(JSON.stringify({ type: 'info', message: `${username} has left due to an error.` }), userId, true);
        }
    });
});

// Function to broadcast messages to all clients (or all except sender)
function broadcastMessage(message, senderUserId, includeSender = false) {
    clients.forEach((clientData, id) => {
        if (clientData.ws.readyState === WebSocket.OPEN) {
            if (includeSender || id !== senderUserId) {
                clientData.ws.send(message);
            }
        }
    });
}

// Start the server
server.listen(PORT, () => {
    console.log(`Server (HTTP and WebSocket) is running on http://localhost:${PORT}`);
});
