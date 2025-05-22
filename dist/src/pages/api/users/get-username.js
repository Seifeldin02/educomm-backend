"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    if (req.method !== "GET") {
        return res.status(405).json({ message: "Method not allowed" });
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.split("Bearer ")[1];
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    try {
        const decodedToken = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
        const userDoc = await firebaseAdmin_1.adminDB
            .collection("users")
            .doc(decodedToken.uid)
            .get();
        if (!userDoc.exists) {
            return res.status(404).json({ message: "User not found" });
        }
        const username = userDoc.data()?.username;
        if (!username) {
            return res
                .status(404)
                .json({ message: "Username not set for this user" });
        }
        return res.status(200).json({ username });
    }
    catch (error) {
        console.error("Error fetching username:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
