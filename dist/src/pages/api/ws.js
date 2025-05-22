"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const websocket_1 = require("../../lib/websocket");
function handler(req, res) {
    console.log('WebSocket API route called');
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);
    if (!res.socket) {
        console.error('No socket available in response');
        res.status(500).end();
        return;
    }
    const socket = res.socket;
    console.log('Socket available:', {
        socketId: socket.id,
        socketRemoteAddress: socket.remoteAddress,
        socketRemotePort: socket.remotePort
    });
    if (!socket.server) {
        console.error('No server object on socket');
        res.status(500).end();
        return;
    }
    console.log('Server object available:', {
        serverAddress: socket.server.address(),
        serverConnections: socket.server.connections
    });
    if (!socket.server.wss) {
        console.log('Setting up WebSocket server');
        try {
            socket.server.wss = (0, websocket_1.setupWebSocketServer)(socket.server);
            console.log('WebSocket server setup complete');
        }
        catch (error) {
            console.error('Error setting up WebSocket server:', error);
            res.status(500).end();
            return;
        }
    }
    else {
        console.log('WebSocket server already exists');
    }
    res.end();
}
