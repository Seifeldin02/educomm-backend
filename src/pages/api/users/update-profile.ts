import { NextApiRequest, NextApiResponse } from "next";
import { adminAuth, adminDB, admin } from "@/lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token)
    return res.status(401).json({ message: "Unauthorized - No token" });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { fullName, username } = req.body;

    if (!fullName || !username) {
      return res.status(400).json({ message: "Missing fullName or username" });
    }

    // Check if new username is already taken by another user
    const existingUser = await adminDB
      .collection("users")
      .where("username", "==", username)
      .get();

    const isTaken = existingUser.docs.some((doc) => doc.id !== uid);
    if (isTaken) {
      return res.status(409).json({ message: "Username already taken" });
    }

    await adminDB.collection("users").doc(uid).update({
      fullName,
      username,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "Profile updated" });
  } catch (err) {
    console.error("🔥 Failed to update profile:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
