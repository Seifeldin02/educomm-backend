"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const websocket_js_1 = require("../../../lib/websocket.js");
async function GET(req) {
    console.log('WebSocket API route called');
    console.log('Request method:', req.method);
    console.log('Request headers:', Object.fromEntries(req.headers));
    const response = new server_1.NextResponse();
    const socket = response.socket;
    if (!socket) {
        console.error('No socket available in response');
        return new server_1.NextResponse('No socket available', { status: 500 });
    }
    console.log('Socket available:', {
        socketRemoteAddress: socket.remoteAddress,
        socketRemotePort: socket.remotePort
    });
    if (!socket.server) {
        console.error('No server object on socket');
        return new server_1.NextResponse('No server object', { status: 500 });
    }
    console.log('Server object available:', {
        serverAddress: socket.server.address(),
        serverConnections: socket.server.connections
    });
    if (!socket.server.wss) {
        console.log('Setting up WebSocket server');
        try {
            socket.server.wss = (0, websocket_js_1.setupWebSocketServer)(socket.server);
            console.log('WebSocket server setup complete');
        }
        catch (error) {
            console.error('Error setting up WebSocket server:', error);
            return new server_1.NextResponse('WebSocket setup failed', { status: 500 });
        }
    }
    else {
        console.log('WebSocket server already exists');
    }
    return new server_1.NextResponse();
}
