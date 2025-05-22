"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
async function handler(req, res) {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173"); // Allow requests from your frontend
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); // Allow GET and OPTIONS methods
    res.setHeader("Access-Control-Allow-Headers", "Content-Type"); // Allow Content-Type header
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
        let email = null;
        if (identifier.includes("@")) {
            email = identifier; // It's already an email
        }
        else {
            const snapshot = await firebaseAdmin_1.adminDB
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
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server error." });
    }
}
