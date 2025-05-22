// pages/api/users/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { adminAuth, adminDB, admin } from "@/lib/firebaseAdmin";
// Reusable CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "OPTIONS") {
    res.writeHead(200, corsHeaders);
    return res.end();
  }

  // Handle POST
  if (req.method !== "POST") {
    res.writeHead(405, corsHeaders);
    return res.end();
  }

  res.writeHead(200, corsHeaders);

  const token = req.headers.authorization?.split("Bearer ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token" });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);

    const { uid } = decoded;
    const { username, role, fullName, email } = req.body;

    // Optional: Validate data here (you can also use zod on backend)

    const existing = await adminDB
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!existing.empty) {
      return res.status(409).json({ message: "Username is already taken" });
    }
    await adminDB.collection("users").doc(uid).set({
      username,
      role,
      fullName,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ message: "User profile created" });
  } catch (err: any) {
    console.error("🔥 Error verifying token or saving user:", err);
    return res
      .status(401)
      .json({ message: "Unauthorized or failed to store user" });
  }
}
