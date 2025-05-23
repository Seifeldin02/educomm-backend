import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
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

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const { groupId } = req.query;

      if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ error: 'Invalid group ID' });
      }

      // Get the group document
      const groupDoc = await adminDB.collection('groups').doc(groupId).get();

      if (!groupDoc.exists) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const groupData = groupDoc.data();

      // Check if user is a member of the group
      const isMember = groupData?.members.some((member: any) => member.uid === uid);
      if (!isMember) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

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

      // Format the group data with member details
      const group = {
        id: groupDoc.id,
        name: groupData?.name,
        description: groupData?.description,
        imageUrl: groupData?.imageUrl || null,
        createdAt: groupData?.createdAt,
        createdBy: groupData?.createdBy,
        members: groupData?.members.map((member: any) => {
          // Try to get user data from our database first
          const dbUserData = usersMap.get(member.uid) || usersMap.get(member.email?.toLowerCase());
          const username = member.email?.split('@')[0] || 'Unknown User';
          
          // Use database fullName if available, otherwise use stored displayName or username
          const displayName = dbUserData?.fullName || member.displayName || username;
          
          return {
            uid: member.uid,
            email: member.email || '',
            displayName: displayName,
            photoURL: member.photoURL || null
          };
        }) || []
      };

      return res.status(200).json({
        success: true,
        group
      });
    } catch (error) {
      console.error('Error fetching group:', error);
      return res.status(500).json({ error: 'Failed to fetch group' });
    }
  } else if (req.method === "PUT") {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const { groupId } = req.query;
      const { name, description, imageUrl } = req.body;

      if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ error: 'Invalid group ID' });
      }

      // Get the group document
      const groupDoc = await adminDB.collection('groups').doc(groupId).get();

      if (!groupDoc.exists) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const groupData = groupDoc.data();

      // Check if user is the creator of the group
      if (groupData?.createdBy !== uid) {
        return res.status(403).json({ error: 'Only the group creator can update the group' });
      }

      // Update the group
      await adminDB.collection('groups').doc(groupId).update({
        name: name || groupData.name,
        description: description || groupData.description,
        imageUrl: imageUrl || groupData.imageUrl
      });

      return res.status(200).json({
        success: true,
        message: 'Group updated successfully'
      });
    } catch (error) {
      console.error('Error updating group:', error);
      return res.status(500).json({ error: 'Failed to update group' });
    }
  } else if (req.method === "DELETE") {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const { groupId } = req.query;

      if (!groupId || typeof groupId !== 'string') {
        return res.status(400).json({ error: 'Invalid group ID' });
      }

      // Get the group document
      const groupDoc = await adminDB.collection('groups').doc(groupId).get();

      if (!groupDoc.exists) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const groupData = groupDoc.data();

      // Check if user is the creator of the group
      if (groupData?.createdBy !== uid) {
        return res.status(403).json({ error: 'Only the group creator can delete the group' });
      }

      // Delete the group
      await adminDB.collection('groups').doc(groupId).delete();

      return res.status(200).json({
        success: true,
        message: 'Group deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting group:', error);
      return res.status(500).json({ error: 'Failed to delete group' });
    }
  } else {
    res.setHeader('Allow', ['GET', 'PUT', 'DELETE', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
} 