"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCors = withCors;
exports.json = json;
exports.handleOptions = handleOptions;
const server_1 = require("next/server");
const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};
function withCors(response) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}
function json(data, init) {
    const response = server_1.NextResponse.json(data, init);
    return withCors(response);
}
function handleOptions() {
    return json(null, { status: 200 });
}
