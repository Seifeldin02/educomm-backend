"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.convertTimestampToString = void 0;
const firebase_admin_1 = require("./firebase-admin");
Object.defineProperty(exports, "db", { enumerable: true, get: function () { return firebase_admin_1.db; } });
// Helper function to convert Firestore timestamp to ISO string
const convertTimestampToString = (timestamp) => {
    if (!timestamp)
        return null;
    return timestamp.toDate().toISOString();
};
exports.convertTimestampToString = convertTimestampToString;
