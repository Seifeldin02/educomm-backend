"use strict";
// backend/src/pages/api/users/verify-role.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS")
        return res.status(200).end();
    if (req.method !== "POST")
        return res.status(405).end();
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const decoded = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
        const userDoc = await firebaseAdmin_1.adminDB.collection("users").doc(decoded.uid).get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: "User profile not found." });
        }
        const userRole = userDoc.data()?.role;
        const { requiredRole } = req.body;
        if (requiredRole && userRole !== requiredRole) {
            return res.status(403).json({ message: "Invalid role." });
        }
        return res.status(200).json({ message: "Role verified", role: userRole });
    }
    catch (err) {
        console.error("🔥 verify-role error:", err);
        return res.status(500).json({ message: "Server error." });
    }
}
