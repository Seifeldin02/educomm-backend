"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsHeaders = void 0;
exports.corsResponse = corsResponse;
exports.handleCorsError = handleCorsError;
exports.handleOptions = handleOptions;
const server_1 = require("next/server");
exports.corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};
function corsResponse(data, status = 200) {
    // Always return with CORS headers, even for error responses
    const response = server_1.NextResponse.json(data, { status });
    // Explicitly set all CORS headers
    Object.entries(exports.corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}
function handleCorsError(error) {
    console.error('API Error:', error);
    return corsResponse({ error: 'Internal server error' }, 500);
}
async function handleOptions(request) {
    if (request.method === 'OPTIONS') {
        const response = new server_1.NextResponse(null, { status: 200 });
        // Explicitly set all CORS headers for OPTIONS
        Object.entries(exports.corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });
        return response;
    }
    return new server_1.NextResponse(null, { status: 405 });
}
