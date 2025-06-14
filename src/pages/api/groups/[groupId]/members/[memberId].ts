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
    const { groupId, memberId } = req.query;
    const { deleteMessages } = req.body;

    if (!groupId || typeof groupId !== 'string' || !memberId || typeof memberId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID or member ID' });
    }

    // Get the group document
    const groupDoc = await adminDB.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupDoc.data();

    // Check if user is the creator of the group
    if (groupData?.createdBy !== uid) {
      return res.status(403).json({ error: 'Only the group creator can remove members' });
    }

    // Check if member exists in the group
    const members = groupData.members || [];
    const memberIndex = members.findIndex((m: any) => m.uid === memberId);

    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Member not found in group' });
    }

    // Cannot remove the group creator
    if (memberId === groupData.createdBy) {
      return res.status(403).json({ error: 'Cannot remove the group creator' });
    }

    // If deleteMessages is true, delete all messages from this user
    if (deleteMessages) {
      const messagesRef = adminRealtimeDB.ref(`groupMessages/${groupId}`);
      const snapshot = await messagesRef.once('value');
      const messages = snapshot.val() || {};

      // Delete messages from the removed member
      const updates: { [key: string]: null } = {};
      Object.entries(messages).forEach(([key, value]: [string, any]) => {
        if (value.senderId === memberId) {
          updates[key] = null;
        }
      });

      if (Object.keys(updates).length > 0) {
        await messagesRef.update(updates);
      }
    }

    // Remove member from the group
    members.splice(memberIndex, 1);
    await adminDB.collection('groups').doc(groupId).update({
      members
    });

    return res.status(200).json({
      success: true,
      message: 'Member removed successfully'
    });
  } catch (error) {
    console.error('Error removing member:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
} 