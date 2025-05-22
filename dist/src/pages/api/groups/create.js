"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { name, description, imageUrl } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Name is required" });
        }
        const decodedToken = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;
        // Get user info for the creator
        const creatorUser = await firebaseAdmin_1.adminAuth.getUser(uid);
        const creatorEmail = creatorUser.email || '';
        const username = creatorEmail.split('@')[0];
        // Create the group document with the creator as the first member
        const groupRef = firebaseAdmin_1.adminDB.collection("groups").doc();
        const groupData = {
            id: groupRef.id,
            name,
            description: description || '',
            imageUrl: imageUrl || null,
            createdAt: new Date().toISOString(),
            createdBy: uid,
            members: [{
                    uid: uid,
                    email: creatorEmail,
                    displayName: creatorUser.displayName || username,
                    photoURL: creatorUser.photoURL || null
                }]
        };
        try {
            await groupRef.set(groupData);
            console.log('Group created successfully:', groupData);
        }
        catch (error) {
            console.error('Error saving group to database:', error);
            throw error;
        }
        // Return complete group data
        return res.status(200).json({
            success: true,
            group: groupData
        });
    }
    catch (error) {
        console.error("Error creating group:", error);
        return res.status(500).json({
            error: "Failed to create group",
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
