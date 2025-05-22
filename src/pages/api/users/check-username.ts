import type { NextApiRequest, NextApiResponse } from "next";
import { adminDB } from "@/lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { username } = req.query;

  if (!username || typeof username !== "string") {
    return res.status(400).json({ message: "Invalid username" });
  }

  const snapshot = await adminDB
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return res.status(409).json({ message: "Username already exists" });
  }

  return res.status(200).json({ message: "Username is available" });
}
