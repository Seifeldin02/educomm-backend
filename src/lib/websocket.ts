import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from './auth.js';
import { db } from './firebase.js';
import { AuthenticatedWebSocket, WebSocketMessage, WebSocketRequest } from '../types/websocket.js';
import { Server as HTTPServer } from 'http';

export function setupWebSocketServer(server: HTTPServer) {
  console.log('Setting up WebSocket server with HTTP server:', {
    serverAddress: server.address(),
    serverConnections: server.connections
  });

  const wss = new WebSocketServer({ server });
  console.log('WebSocket server created');

  wss.on('connection', (ws: WebSocket, req: WebSocketRequest) => {
    console.log('New WebSocket connection:', {
      remoteAddress: req.socket.remoteAddress,
      remotePort: req.socket.remotePort,
      url: req.url
    });

    const authWs = ws as unknown as AuthenticatedWebSocket;
    authWs.isAuthenticated = false;

    authWs.on('message', async (message: string) => {
      console.log('Received WebSocket message:', message);
      try {
        const data: WebSocketMessage = JSON.parse(message);
        console.log('Parsed message data:', data);

        if (data.type === 'auth') {
          console.log('Processing auth message');
          if (!data.token) {
            console.log('No token provided in auth message');
            authWs.send(JSON.stringify({ type: 'error', message: 'No token provided' }));
            return;
          }

          try {
            console.log('Verifying token');
            const decodedToken = await verifyToken(data.token);
            authWs.isAuthenticated = true;
            authWs.userId = decodedToken.uid;
            console.log('Token verified successfully for user:', decodedToken.uid);
            authWs.send(JSON.stringify({ type: 'auth_success' }));
          } catch (error) {
            console.error('Token verification failed:', error);
            authWs.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            authWs.close();
          }
          return;
        }

        if (!authWs.isAuthenticated) {
          console.log('Unauthenticated message received');
          authWs.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
          return;
        }

        // Handle other message types here
        if (data.type === 'new_message') {
          console.log('Processing new message:', data.data);
          // Broadcast the message to all authenticated clients in the same group
          wss.clients.forEach((client) => {
            const authClient = client as unknown as AuthenticatedWebSocket;
            if (authClient.isAuthenticated && authClient !== authWs) {
              console.log('Broadcasting message to client');
              authClient.send(JSON.stringify({
                type: 'new_message',
                data: data.data
              }));
            }
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        authWs.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
      }
    });

    authWs.on('close', () => {
      console.log('WebSocket connection closed');
    });

    authWs.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  });

  console.log('WebSocket server setup complete');
  return wss;
} 