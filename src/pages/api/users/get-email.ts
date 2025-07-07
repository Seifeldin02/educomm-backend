import { NextApiRequest, NextApiResponse } from "next";
import { adminDB } from "@/lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://educomm-84fd5.web.app"); // Allow requests from your frontend
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); // Allow GET and OPTIONS methods
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); // Allow Content-Type and Authorization headers
  res.setHeader("Access-Control-Allow-Credentials", "true"); // Allow credentials

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const { identifier } = req.query; // identifier can be email OR username

  if (!identifier) {
    return res.status(400).json({ message: "Username or email required." });
  }

  try {
    let email: string | null = null;

    if ((identifier as string).includes("@")) {
      email = identifier as string; // It's already an email
    } else {
      const snapshot = await adminDB
        .collection("users")
        .where("username", "==", identifier)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ message: "Username not found." });
      }

      email = snapshot.docs[0].data().email;
    }

    return res.status(200).json({ email });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error." });
  }
}
