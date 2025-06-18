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
    const { groupId } = req.query;
    const { messageId, timestamp, lastMessage } = req.body;
    if (!groupId || typeof groupId !== 'string' || !messageId || !timestamp) {
      return res.status(400).json({ error: 'Invalid groupId, messageId, or timestamp' });
    }
    // Get group info
    const groupDoc = await adminDB.collection('groups').doc(groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
    const groupData = groupDoc.data();
    const members = groupData?.members?.map((m: any) => m.uid) || [];
    // For each member except sender
    for (const memberId of members) {
      if (memberId === senderId) {
        console.log('Skip notification: recipient is sender');
        continue;
      }
      // Get lastRead
      const unreadDoc = await adminDB.collection('groups').doc(groupId).collection('unread').doc(memberId).get();
      const lastRead = unreadDoc.exists ? unreadDoc.data()?.lastRead : 0;
      if (lastRead && lastRead >= timestamp) {
        console.log('Skip notification: user is in chat (lastRead >= timestamp)');
        continue;
      }
      // Check for existing unread notification for this group
      const notifQuery = await adminDB.collection('notifications').doc(memberId).collection('items')
        .where('type', '==', 'group_message')
        .where('groupId', '==', groupId)
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
          type: 'group_message',
          groupId,
          groupName: groupData?.name || '',
          messageId,
          lastMessage: lastMessage,
          count: 1,
          timestamp,
          read: false,
        };
        await adminDB.collection('notifications').doc(memberId).collection('items').add(notification);
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in group notify-message:', error);
    return res.status(500).json({ error: 'Failed to notify group message' });
  }
} 