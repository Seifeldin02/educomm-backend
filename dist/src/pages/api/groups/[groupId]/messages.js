"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebase_1 = require("@/lib/firebase");
const auth_1 = require("@/lib/auth");
async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    const { groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ error: 'Invalid group ID' });
    }
    try {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const decodedToken = await (0, auth_1.verifyToken)(token);
        const userId = decodedToken.uid;
        // Check if user is a member of the group
        const groupRef = firebase_1.db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }
        const groupData = groupDoc.data();
        const isMember = groupData?.members.some((member) => member.uid === userId);
        if (!isMember) {
            return res.status(403).json({ error: 'Not a member of this group' });
        }
        if (req.method === 'GET') {
            // Get messages
            const messagesRef = groupRef.collection('messages')
                .orderBy('timestamp', 'desc')
                .limit(50);
            const messagesSnapshot = await messagesRef.get();
            const messages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return res.status(200).json({ messages: messages.reverse() });
        }
        if (req.method === 'POST') {
            const { text } = req.body;
            if (!text || typeof text !== 'string') {
                return res.status(400).json({ error: 'Invalid message text' });
            }
            // Get user data
            const userRef = firebase_1.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            const userData = userDoc.data();
            // Create message
            const messageRef = groupRef.collection('messages').doc();
            const message = {
                id: messageRef.id,
                text,
                senderId: userId,
                senderName: userData?.displayName || 'Unknown User',
                timestamp: Date.now()
            };
            await messageRef.set(message);
            return res.status(201).json({ message });
        }
        return res.status(405).json({ error: 'Method not allowed' });
    }
    catch (error) {
        console.error('Error handling messages:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
