"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTIONS = void 0;
exports.GET = GET;
const headers_1 = require("next/headers");
const db_1 = require("@/lib/db");
const auth_1 = require("@/lib/auth");
const middleware_1 = require("@/lib/middleware");
Object.defineProperty(exports, "OPTIONS", { enumerable: true, get: function () { return middleware_1.handleOptions; } });
async function GET(request) {
    try {
        const headersList = await (0, headers_1.headers)();
        const authHeader = headersList.get('authorization');
        const user = await (0, auth_1.verifyAuth)(authHeader);
        if (!user) {
            return (0, middleware_1.json)({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get search query from URL
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query')?.toLowerCase();
        if (!query || query.length < 2) {
            return (0, middleware_1.json)({ users: [] });
        }
        // Search users by email, username, or fullName
        const usersSnapshot = await db_1.db
            .collection('users')
            .get();
        const users = usersSnapshot.docs
            .map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                email: data.email,
                username: data.username || '',
                displayName: data.displayName || data.email,
                fullName: data.fullName || data.displayName || data.email
            };
        })
            .filter(userData => {
            return (userData.email.toLowerCase().includes(query) ||
                (userData.username && userData.username.toLowerCase().includes(query)) ||
                (userData.fullName && userData.fullName.toLowerCase().includes(query)));
        })
            // Limit to first 10 matches
            .slice(0, 10);
        return (0, middleware_1.json)({ users });
    }
    catch (error) {
        console.error('API Error:', error);
        return (0, middleware_1.json)({ error: 'Internal server error' }, { status: 500 });
    }
}
