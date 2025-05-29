import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

interface UserSearchResult {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL?: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Set CORS headers for all other responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== "GET") {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    await adminAuth.verifyIdToken(token);
    const { query } = req.query;

    if (!query || typeof query !== 'string' || query.length < 2) {
      return res.status(200).json({ users: [] });
    }

    const searchTerm = query.toLowerCase();

    // Search by email
    const emailQuery = adminDB
      .collection('users')
      .where('email', '>=', searchTerm)
      .where('email', '<=', searchTerm + '\uf8ff')
      .limit(5);

    // Search by username
    const usernameQuery = adminDB
      .collection('users')
      .where('username', '>=', searchTerm)
      .where('username', '<=', searchTerm + '\uf8ff')
      .limit(5);

    // Search by fullName
    const fullNameQuery = adminDB
      .collection('users')
      .where('fullName', '>=', searchTerm)
      .where('fullName', '<=', searchTerm + '\uf8ff')
      .limit(5);

    // Run all queries in parallel
    const [emailResults, usernameResults, fullNameResults] = await Promise.all([
      emailQuery.get(),
      usernameQuery.get(),
      fullNameQuery.get()
    ]);

    // Combine and deduplicate results
    const seenUids = new Set<string>();
    const users: UserSearchResult[] = [];

    const processResults = (snapshot: FirebaseFirestore.QuerySnapshot) => {
      snapshot.forEach(doc => {
        const data = doc.data();
        if (!seenUids.has(doc.id)) {
          seenUids.add(doc.id);
          users.push({
            uid: doc.id,
            email: data.email,
            displayName: data.fullName || data.displayName || data.email.split('@')[0],
            username: data.username || '',
          });
        }
      });
    };

    processResults(emailResults);
    processResults(usernameResults);
    processResults(fullNameResults);

    // Augment users with photoURL
    const usersWithPhotoURL: UserSearchResult[] = await Promise.all(
      users.map(async (userResult) => {
        let photoURL: string | null = null;
        try {
          const authUserRecord = await adminAuth.getUser(userResult.uid);
          photoURL = authUserRecord.photoURL || null;
        } catch (authError) {
          console.warn(`Failed to get auth record for user ${userResult.uid} during search, trying Firestore user doc:`, authError);
          try {
            const userDoc = await adminDB.collection('users').doc(userResult.uid).get();
            if (userDoc.exists) {
              const firestoreData = userDoc.data();
              photoURL = firestoreData?.photoURL || null;
            }
          } catch (firestoreError) {
            console.warn(`Failed to get Firestore user doc for ${userResult.uid} during search fallback:`, firestoreError);
          }
        }
        return {
          ...userResult,
          photoURL: photoURL,
        };
      })
    );

    // Sort results by relevance (exact matches first) on the augmented list
    usersWithPhotoURL.sort((a, b) => {
      const aExact =
        a.email.toLowerCase().startsWith(searchTerm) ||
        a.username.toLowerCase().startsWith(searchTerm) ||
        a.displayName.toLowerCase().startsWith(searchTerm);
      const bExact =
        b.email.toLowerCase().startsWith(searchTerm) ||
        b.username.toLowerCase().startsWith(searchTerm) ||
        b.displayName.toLowerCase().startsWith(searchTerm);
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return res.status(200).json({
      users: usersWithPhotoURL.slice(0, 10)
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
} 