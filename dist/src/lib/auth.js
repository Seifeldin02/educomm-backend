"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthenticatedUser = getAuthenticatedUser;
exports.validateUser = validateUser;
exports.verifyAuth = verifyAuth;
exports.verifyToken = verifyToken;
const firebase_admin_1 = require("./firebase-admin");
async function getAuthenticatedUser(req) {
    try {
        const token = req.headers.get('Authorization')?.split('Bearer ')[1];
        if (!token) {
            throw new Error('No token provided');
        }
        const decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        return decodedToken;
    }
    catch (error) {
        throw new Error('Authentication failed');
    }
}
async function validateUser(req) {
    try {
        const user = await getAuthenticatedUser(req);
        if (!user) {
            throw new Error('User not authenticated');
        }
        return user;
    }
    catch (error) {
        throw new Error('User validation failed');
    }
}
async function verifyAuth(authHeader) {
    try {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        const token = authHeader.split('Bearer ')[1];
        if (!token) {
            return null;
        }
        const decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        return decodedToken;
    }
    catch (error) {
        console.error('Error verifying auth token:', error);
        return null;
    }
}
async function verifyToken(token) {
    try {
        const decodedToken = await firebase_admin_1.auth.verifyIdToken(token);
        return decodedToken;
    }
    catch (error) {
        console.error('Error verifying token:', error);
        throw new Error('Invalid token');
    }
}
