// src/lib/firebaseAdmin.ts
import * as admin from "firebase-admin";
import path from "path";
import fs from "fs";

// Define global types for TypeScript
declare global {
  var firebaseApp: admin.app.App | undefined;
  var firebaseAuth: admin.auth.Auth | undefined;
  var firebaseFirestore: admin.firestore.Firestore | undefined;
  var firebaseDatabase: admin.database.Database | undefined;
}

function initializeFirebaseAdmin() {
  // Check if we already have initialized instances in global
  if (global.firebaseApp && global.firebaseAuth && global.firebaseFirestore && global.firebaseDatabase) {
    return {
      app: global.firebaseApp,
      auth: global.firebaseAuth,
      firestore: global.firebaseFirestore,
      database: global.firebaseDatabase
    };
  }

  let app: admin.app.App;
  
  try {
    // Try to get existing app
    app = admin.app();
    console.log('Using existing Firebase app');
  } catch (error) {
    // App doesn't exist, create it
    console.log('Creating new Firebase app');
    const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountPath, "utf8")
    );

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://educomm-84fd5-default-rtdb.firebaseio.com/"
    });
  }

  // Initialize services only if not already cached globally
  if (!global.firebaseAuth) {
    console.log('Initializing Firebase Auth');
    global.firebaseAuth = app.auth();
  }
  
  if (!global.firebaseFirestore) {
    console.log('Initializing Firebase Firestore');
    global.firebaseFirestore = app.firestore();
  }
  
  if (!global.firebaseDatabase) {
    console.log('Initializing Firebase Database');
    global.firebaseDatabase = app.database();
  }

  // Cache the app globally
  global.firebaseApp = app;

  return {
    app: global.firebaseApp,
    auth: global.firebaseAuth,
    firestore: global.firebaseFirestore,
    database: global.firebaseDatabase
  };
}

// Initialize and export
const { app: adminApp, auth: adminAuth, firestore: adminDB, database: adminRealtimeDB } = initializeFirebaseAdmin();

export { admin };
export { adminAuth };
export { adminDB };
export { adminRealtimeDB };
