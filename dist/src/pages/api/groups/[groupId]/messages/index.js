"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
async function handler(req, res) {
    if (req.method === "GET") {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token)
            return res.status(401).json({ message: 'Unauthorized' });
        try {
            const decodedToken = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
            const uid = decodedToken.uid;
            const { groupId } = req.query;
            if (!groupId || typeof groupId !== 'string') {
                return res.status(400).json({ error: 'Invalid group ID' });
            }
            // Get the group document
            const groupDoc = await firebaseAdmin_1.adminDB.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                return res.status(404).json({ error: 'Group not found' });
            }
            const groupData = groupDoc.data();
            // Check if user is a member of the group
            const isMember = groupData?.members.some((member) => member.uid === uid);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }
            // Get messages
            const messagesSnapshot = await firebaseAdmin_1.adminDB
                .collection('groups')
                .doc(groupId)
                .collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            const messages = messagesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            return res.status(200).json({
                success: true,
                messages
            });
        }
        catch (error) {
            console.error('Error fetching messages:', error);
            return res.status(500).json({ error: 'Failed to fetch messages' });
        }
    }
    else if (req.method === "POST") {
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token)
            return res.status(401).json({ message: 'Unauthorized' });
        try {
            const decodedToken = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
            const uid = decodedToken.uid;
            const { groupId } = req.query;
            const { content } = req.body;
            if (!groupId || typeof groupId !== 'string') {
                return res.status(400).json({ error: 'Invalid group ID' });
            }
            if (!content) {
                return res.status(400).json({ error: 'Message content is required' });
            }
            // Get the group document
            const groupDoc = await firebaseAdmin_1.adminDB.collection('groups').doc(groupId).get();
            if (!groupDoc.exists) {
                return res.status(404).json({ error: 'Group not found' });
            }
            const groupData = groupDoc.data();
            // Check if user is a member of the group
            const isMember = groupData?.members.some((member) => member.uid === uid);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this group' });
            }
            // Get user info
            const userDoc = await firebaseAdmin_1.adminDB.collection('users').doc(uid).get();
            const userData = userDoc.data();
            // Create message
            const messageRef = firebaseAdmin_1.adminDB
                .collection('groups')
                .doc(groupId)
                .collection('messages')
                .doc();
            const message = {
                id: messageRef.id,
                content,
                senderId: uid,
                senderName: userData?.fullName || userData?.displayName || 'Unknown User',
                senderEmail: userData?.email || '',
                createdAt: new Date().toISOString()
            };
            await messageRef.set(message);
            return res.status(200).json({
                success: true,
                message
            });
        }
        catch (error) {
            console.error('Error creating message:', error);
            return res.status(500).json({ error: 'Failed to create message' });
        }
    }
    else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}
