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
    const { username } = req.query;
    if (!username || typeof username !== "string") {
        return res.status(400).json({ message: "Invalid username" });
    }
    const snapshot = await firebaseAdmin_1.adminDB
        .collection("users")
        .where("username", "==", username)
        .limit(1)
        .get();
    if (!snapshot.empty) {
        return res.status(409).json({ message: "Username already exists" });
    }
    return res.status(200).json({ message: "Username is available" });
}
