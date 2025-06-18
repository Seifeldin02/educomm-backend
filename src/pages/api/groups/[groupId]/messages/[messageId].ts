import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth, adminRealtimeDB } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Set CORS headers for all other responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== "DELETE") {
    res.setHeader('Allow', ['DELETE', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const { groupId, messageId } = req.query;

    if (!groupId || typeof groupId !== 'string' || !messageId || typeof messageId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID or message ID' });
    }

    // Get the group document to verify permissions
    const groupDoc = await adminDB.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupDoc.data();

    // Check if user is the creator of the group OR the sender of the message
    const messageRef = adminRealtimeDB.ref(`groupMessages/${groupId}/${messageId}`);
    const messageSnapshot = await messageRef.once('value');
    
    if (!messageSnapshot.exists()) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const messageData = messageSnapshot.val();
    const isGroupCreator = groupData?.createdBy === uid;
    const isMessageSender = messageData.senderId === uid;

    if (!isGroupCreator && !isMessageSender) {
      return res.status(403).json({ 
        error: 'Only the group creator or message sender can delete messages' 
      });
    }

    // Delete the message from Firebase Realtime Database
    await messageRef.remove();

    // Fetch group info to get members
    const groupDocAfterDelete = await adminDB.collection('groups').doc(groupId).get();
    if (groupDocAfterDelete.exists) {
      const groupDataAfterDelete = groupDocAfterDelete.data();
      const members = groupDataAfterDelete?.members || [];
      // Create notification for each member except sender
      for (const memberId of members) {
        if (memberId !== messageData.senderId) {
          const notification = {
            type: 'group_message',
            groupId,
            groupName: groupDataAfterDelete?.name || '',
            message: messageData.text,
            senderId: messageData.senderId,
            senderName: messageData.senderName,
            timestamp: Date.now(),
            read: false,
          };
          await adminDB.collection('notifications').doc(memberId).collection('items').add(notification);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
} 