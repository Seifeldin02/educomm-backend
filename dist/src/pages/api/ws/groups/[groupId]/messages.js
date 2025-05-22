"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const ws_1 = require("ws");
const firebaseAdmin_1 = require("@/lib/firebaseAdmin");
// Store active WebSocket connections
const connections = new Map();
function handler(req, res) {
    if (!res.socket?.server?.wss) {
        const wss = new ws_1.WebSocketServer({ noServer: true });
        res.socket.server.wss = wss;
        res.socket.server.on('upgrade', async (request, socket, head) => {
            try {
                const url = new URL(request.url, `http://${request.headers.host}`);
                const groupId = url.pathname.split('/')[3]; // /ws/groups/{groupId}/messages
                const token = url.searchParams.get('token');
                if (!token) {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                    return;
                }
                try {
                    const decodedToken = await firebaseAdmin_1.adminAuth.verifyIdToken(token);
                    const uid = decodedToken.uid;
                    // Verify group membership
                    const groupDoc = await firebaseAdmin_1.adminDB.collection('groups').doc(groupId).get();
                    if (!groupDoc.exists) {
                        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                        socket.destroy();
                        return;
                    }
                    const groupData = groupDoc.data();
                    const isMember = groupData?.members.some((member) => member.uid === uid);
                    if (!isMember) {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                        socket.destroy();
                        return;
                    }
                    wss.handleUpgrade(request, socket, head, (ws) => {
                        wss.emit('connection', ws, request);
                    });
                }
                catch (error) {
                    console.error('WebSocket authentication error:', error);
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                }
            }
            catch (error) {
                console.error('WebSocket upgrade error:', error);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
            }
        });
        wss.on('connection', (ws, req) => {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const groupId = url.pathname.split('/')[3];
            const token = url.searchParams.get('token');
            if (!token) {
                ws.close();
                return;
            }
            // Store the connection
            const connectionId = `${groupId}-${Date.now()}`;
            connections.set(connectionId, ws);
            // Handle messages
            ws.addEventListener('message', async (event) => {
                try {
                    const data = JSON.parse(event.data.toString());
                    if (data.type === 'new_message') {
                        // Save message to database
                        const messageRef = firebaseAdmin_1.adminDB.collection('groups').doc(groupId).collection('messages').doc();
                        await messageRef.set({
                            ...data.message,
                            createdAt: new Date().toISOString()
                        });
                        // Broadcast to all connections in the same group
                        connections.forEach((connection, id) => {
                            if (id.startsWith(groupId) && connection !== ws) {
                                connection.send(JSON.stringify({
                                    type: 'new_message',
                                    message: data.message
                                }));
                            }
                        });
                    }
                }
                catch (error) {
                    console.error('Error handling WebSocket message:', error);
                }
            });
            // Handle disconnection
            ws.addEventListener('close', () => {
                connections.delete(connectionId);
            });
        });
    }
    res.end();
}
