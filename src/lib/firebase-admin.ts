import * as admin from 'firebase-admin';
import path from 'path';

// Initialize Firebase Admin
const serviceAccount = require(path.join(process.cwd(), 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

export const db = admin.firestore();
export const auth = admin.auth(); 