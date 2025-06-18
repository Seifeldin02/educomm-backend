import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const senderId = decodedToken.uid;
    const { chatId } = req.query;
    const { messageId, timestamp, lastMessage } = req.body;
    if (!chatId || typeof chatId !== 'string' || !messageId || !timestamp) {
      return res.status(400).json({ error: 'Invalid chatId, messageId, or timestamp' });
    }
    // Get chat info
    const chatDoc = await adminDB.collection('chats').doc(chatId).get();
    if (!chatDoc.exists) return res.status(404).json({ error: 'Chat not found' });
    const chatData = chatDoc.data();
    const participants = Object.keys(chatData?.participants || {});
    const recipientId = participants.find((id) => id !== senderId);
    if (!recipientId) return res.status(400).json({ error: 'Recipient not found' });
    // Defensive: skip if recipient is sender
    if (recipientId === senderId) {
      console.log('Skip notification: recipient is sender');
      return res.status(200).json({ success: true, skipped: 'recipient is sender' });
    }
    // Get lastRead
    const unreadDoc = await adminDB.collection('directMessages').doc(chatId).collection('unread').doc(recipientId).get();
    const lastRead = unreadDoc.exists ? unreadDoc.data()?.lastRead : 0;
    if (lastRead && lastRead >= timestamp) {
      console.log('Skip notification: user is in chat (lastRead >= timestamp)');
      return res.status(200).json({ success: true, skipped: 'user is in chat' });
    }
    // Check for existing unread notification for this chat
    const notifQuery = await adminDB.collection('notifications').doc(recipientId).collection('items')
      .where('type', '==', 'direct_message')
      .where('chatId', '==', chatId)
      .where('read', '==', false)
      .limit(1)
      .get();
    if (!notifQuery.empty) {
      // Update existing notification: increment count, update lastMessage/timestamp
      const notifDoc = notifQuery.docs[0];
      const notifData = notifDoc.data();
      await notifDoc.ref.update({
        count: (notifData.count || 1) + 1,
        lastMessage: lastMessage,
        timestamp,
        read: false
      });
    } else {
      // Create new notification
      const notification = {
        type: 'direct_message',
        chatId,
        messageId,
        lastMessage: lastMessage,
        count: 1,
        timestamp,
        read: false,
      };
      await adminDB.collection('notifications').doc(recipientId).collection('items').add(notification);
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in chat notify-message:', error);
    return res.status(500).json({ error: 'Failed to notify direct message' });
  }
} 