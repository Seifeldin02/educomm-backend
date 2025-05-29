import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const currentUserId = decodedToken.uid;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    if (userId === currentUserId) {
      return res.status(400).json({ error: "Cannot create chat with yourself" });
    }

    // Check if chat already exists between these users
    const chatsRef = adminDB.collection("chats");
    const existingChat = await chatsRef
      .where(`participants.${currentUserId}`, "==", true)
      .where(`participants.${userId}`, "==", true)
      .limit(1)
      .get();

    if (!existingChat.empty) {
      const chatDoc = existingChat.docs[0];
      return res.status(200).json({ chatId: chatDoc.id });
    }

    // Create new chat
    const chatRef = adminDB.collection("chats").doc();
    await chatRef.set({
      participants: {
        [currentUserId]: true,
        [userId]: true
      },
      createdAt: new Date().toISOString(),
      lastMessage: null
    });

    return res.status(200).json({ chatId: chatRef.id });
  } catch (error) {
    console.error("Error creating chat:", error);
    return res.status(500).json({ error: "Failed to create chat" });
  }
} 