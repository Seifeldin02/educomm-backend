import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const { name, description, imageUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get user info for the creator
    const creatorUser = await adminAuth.getUser(uid);
    const creatorEmail = creatorUser.email || '';
    const username = creatorEmail.split('@')[0];

    // Create the group document with the creator as the first member
    const groupRef = adminDB.collection("groups").doc();
    const groupData = {
      id: groupRef.id,
      name,
      description: description || '',
      imageUrl: imageUrl || null,
      createdAt: new Date().toISOString(),
      createdBy: uid,
      members: [{
        uid: uid,
        email: creatorEmail,
        displayName: creatorUser.displayName || username,
        photoURL: creatorUser.photoURL || null
      }]
    };

    try {
      await groupRef.set(groupData);
      console.log('Group created successfully:', groupData);
    } catch (error) {
      console.error('Error saving group to database:', error);
      throw error;
    }

    // Return complete group data
    return res.status(200).json({
      success: true,
      group: groupData
    });
  } catch (error) {
    console.error("Error creating group:", error);
    return res.status(500).json({ 
      error: "Failed to create group",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
