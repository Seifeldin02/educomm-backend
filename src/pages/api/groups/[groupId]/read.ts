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
    const uid = decodedToken.uid;
    const { groupId } = req.query;
    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID' });
    }
    await adminDB.collection('groups').doc(groupId).collection('unread').doc(uid).set({ lastRead: Date.now() }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating lastRead:', error);
    return res.status(500).json({ error: 'Failed to update lastRead' });
  }
} 