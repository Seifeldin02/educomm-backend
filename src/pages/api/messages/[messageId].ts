import { NextApiRequest, NextApiResponse } from "next";
import { adminAuth, adminRealtimeDB } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
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
    res.setHeader("Allow", ["DELETE", "OPTIONS"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const { messageId } = req.query;
    const { chatId } = req.body;

    if (
      !messageId ||
      typeof messageId !== "string" ||
      !chatId ||
      typeof chatId !== "string"
    ) {
      return res.status(400).json({ error: "Invalid message ID or chat ID" });
    }

    // Get the message to verify the sender
    const messageRef = adminRealtimeDB.ref(
      `directMessages/${chatId}/${messageId}`
    );
    const messageSnapshot = await messageRef.once("value");

    if (!messageSnapshot.exists()) {
      return res.status(404).json({ error: "Message not found" });
    }

    const messageData = messageSnapshot.val();

    // Check if user is the sender of the message
    if (messageData.senderId !== uid) {
      return res.status(403).json({
        error: "Only the message sender can delete this message",
      });
    }

    // Delete the message from Firebase Realtime Database
    await messageRef.remove();

    return res.status(200).json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting direct message:", error);
    return res.status(500).json({ error: "Failed to delete message" });
  }
}
