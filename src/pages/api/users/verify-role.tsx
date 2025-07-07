// backend/src/pages/api/users/verify-role.ts

import { NextApiRequest, NextApiResponse } from "next";
import { adminAuth, adminDB } from "@/lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "https://educomm-84fd5.web.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDB.collection("users").doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const userRole = userDoc.data()?.role;
    const { requiredRole } = req.body;

    // If no role is required (public route), just return the user's role
    if (!requiredRole) {
      return res
        .status(200)
        .json({ message: "Role retrieved", role: userRole });
    }

    // Validate that user has a role
    if (!userRole) {
      return res.status(400).json({
        message: "User role not set",
        details: {
          userRole: "not set",
          requiredRole,
        },
      });
    }

    // Case-insensitive comparison of roles
    if (userRole.toLowerCase() !== requiredRole.toLowerCase()) {
      return res.status(403).json({
        message: "Invalid role for this route",
        details: {
          userRole,
          requiredRole,
          reason: "Role mismatch",
        },
      });
    }

    return res.status(200).json({ message: "Role verified", role: userRole });
  } catch (err) {
    console.error("🔥 verify-role error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
