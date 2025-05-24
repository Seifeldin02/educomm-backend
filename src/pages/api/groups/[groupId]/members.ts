import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const { groupId } = req.query;
    const { members } = req.body;

    if (!groupId || typeof groupId !== 'string') {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'No members provided' });
    }

    // Get the group document
    const groupDoc = await adminDB.collection('groups').doc(groupId).get();

    if (!groupDoc.exists) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const groupData = groupDoc.data();

    // Check if user is the creator of the group
    if (groupData?.createdBy !== uid) {
      return res.status(403).json({ error: 'Only the group creator can add members' });
    }

    // Get existing members
    const existingMembers = groupData?.members || [];
    const existingEmails = new Set(existingMembers.map((m: any) => m.email.toLowerCase()));

    // Process new members
    const addedMembers = [];
    const errors = [];

    for (const email of members) {
      if (existingEmails.has(email.toLowerCase())) {
        errors.push(`${email} is already a member`);
        continue;
      }

      try {
        // Try to get user by email
        const userRecord = await adminAuth.getUserByEmail(email);
        
        // Get additional user info from Firestore
        const userDoc = await adminDB.collection('users').doc(userRecord.uid).get();
        const userData = userDoc.data();

        if (!userData) {
          errors.push(`User profile not found for email: ${email}`);
          continue;
        }

        addedMembers.push({
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userData.fullName || userRecord.displayName || email.split('@')[0],
          photoURL: userRecord.photoURL || null
        });
      } catch (error: any) {
        console.error(`Error processing member ${email}:`, error);
        errors.push(`Could not find user with email: ${email}`);
      }
    }

    if (addedMembers.length > 0) {
      try {
        // Update group with new members
        await adminDB.collection('groups').doc(groupId).update({
          members: [...existingMembers, ...addedMembers]
        });

        return res.status(200).json({
          success: true,
          addedMembers,
          errors: errors.length > 0 ? errors : undefined
        });
      } catch (error: any) {
        console.error('Error updating group with new members:', error);
        return res.status(500).json({ 
          error: 'Failed to update group with new members',
          details: error.message
        });
      }
    } else {
      return res.status(400).json({
        error: 'No valid members to add',
        errors
      });
    }
  } catch (error: any) {
    console.error('Error adding members:', error);
    return res.status(500).json({ 
      error: 'Failed to add members',
      details: error.message
    });
  }
} 