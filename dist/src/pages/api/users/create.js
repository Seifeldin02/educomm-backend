"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
// Reusable CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};
async function handler(req, res) {
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
        const decoded = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
        const { uid } = decoded;
        const { username, role, fullName, email } = req.body;
        // Optional: Validate data here (you can also use zod on backend)
        const existing = await firebaseAdmin_1.adminDB
            .collection("users")
            .where("username", "==", username)
            .limit(1)
            .get();
        if (!existing.empty) {
            return res.status(409).json({ message: "Username is already taken" });
        }
        await firebaseAdmin_1.adminDB.collection("users").doc(uid).set({
            username,
            role,
            fullName,
            email,
            createdAt: firebaseAdmin_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.status(200).json({ message: "User profile created" });
    }
    catch (err) {
        console.error("🔥 Error verifying token or saving user:", err);
        return res
            .status(401)
            .json({ message: "Unauthorized or failed to store user" });
    }
}
