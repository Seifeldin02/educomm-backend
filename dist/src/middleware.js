"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
function middleware(request) {
    // Get the pathname of the request (e.g. /api/endpoint)
    const pathname = request.nextUrl.pathname;
    // Only run this middleware for API routes
    if (pathname.startsWith('/api')) {
        // Handle OPTIONS request for preflight
        if (request.method === 'OPTIONS') {
            return new server_1.NextResponse(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': 'http://localhost:5173',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Allow-Credentials': 'true',
                },
            });
        }
        // Clone the request headers
        const requestHeaders = new Headers(request.headers);
        // Create a response object
        const response = server_1.NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
        // Add the CORS headers for all other requests
        response.headers.set('Access-Control-Allow-Origin', 'http://localhost:5173');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        // Return the response with CORS headers
        return response;
    }
}
// Specify which paths this middleware applies to
exports.config = {
    matcher: [
        '/api/:path*',
        '/app/api/:path*',
    ],
};
