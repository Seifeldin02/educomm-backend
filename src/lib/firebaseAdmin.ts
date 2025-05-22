// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

if (!admin.apps.length) {
  const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");
  const serviceAccount = JSON.parse(
    fs.readFileSync(serviceAccountPath, "utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };
export const adminAuth = admin.auth();
export const adminDB = admin.firestore();
