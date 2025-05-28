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
  // Always set CORS headers first, before any other operations
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verify authorization for all non-OPTIONS requests
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === "GET") {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;

      // Get all users from database to ensure we have full names
      const usersSnapshot = await adminDB.collection("users").get();
      const usersMap = new Map();
      
      // Create a map of uid to user data including fullName
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.uid) {
          usersMap.set(userData.uid, userData);
        } else if (userData.email) {
          // Also map by email as a fallback
          usersMap.set(userData.email.toLowerCase(), userData);
        }
      });

      // Get all groups first
      const groupsSnapshot = await adminDB
        .collection('groups')
        .get();

      // Filter groups where user is a member
      const groups = groupsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            imageUrl: data.imageUrl || null,
            createdAt: data.createdAt,
            createdBy: data.createdBy,
            members: data.members || []
          };
        })
        .filter(group => 
          group.members.some((member: any) => member.uid === uid)
        )
        .map(group => ({
          ...group,
          members: group.members.map((member: any) => {
            const dbUserData = usersMap.get(member.uid) || usersMap.get(member.email?.toLowerCase());
            const username = member.email?.split('@')[0] || 'Unknown User';
            const displayName = dbUserData?.fullName || member.displayName || username;
            
            return {
              uid: member.uid,
              email: member.email || '',
              displayName: displayName,
              photoURL: member.photoURL || null
            };
          })
        }));

      return res.status(200).json({
        success: true,
        groups
      });
    } else if (req.method === "POST") {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const { name, description, imageUrl } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

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

      await groupRef.set(groupData);
      return res.status(200).json({
        success: true,
        group: groupData
      });
    } else {
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
} 