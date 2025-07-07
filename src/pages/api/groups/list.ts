import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "https://educomm-84fd5.web.app");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Get all users from database to ensure we have full names
    const usersSnapshot = await adminDB.collection("users").get();
    const usersMap = new Map();

    // Create a map of uid to user data including fullName
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.uid) {
        usersMap.set(userData.uid, userData);
      } else if (userData.email) {
        // Also map by email as a fallback
        usersMap.set(userData.email.toLowerCase(), userData);
      }
    });

    // Get all groups first
    const groupsSnapshot = await adminDB.collection("groups").get();

    // Filter groups where user is a member
    const groups = groupsSnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description,
          imageUrl: data.imageUrl || null,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          members: data.members || [],
        };
      })
      .filter((group) =>
        group.members.some((member: any) => member.uid === uid)
      )
      .map((group) => ({
        ...group,
        members: group.members.map((member: any) => {
          // Try to get user data from our database first
          const dbUserData =
            usersMap.get(member.uid) ||
            usersMap.get(member.email?.toLowerCase());
          const username = member.email?.split("@")[0] || "Unknown User";

          // Use database fullName if available, otherwise use stored displayName or username
          const displayName =
            dbUserData?.fullName || member.displayName || username;

          return {
            uid: member.uid,
            email: member.email || "",
            displayName: displayName,
            photoURL: member.photoURL || null,
          };
        }),
      }));

    return res.status(200).json({
      success: true,
      groups,
    });
  } catch (error) {
    console.error("Error fetching groups:", error);
    return res.status(500).json({ error: "Failed to fetch groups" });
  }
}
