import { NextRequest, NextResponse } from 'next/server';
import { setupWebSocketServer } from '../../../lib/websocket.js';
import { Server as HTTPServer } from 'http';
import { Socket } from 'net';

interface SocketWithServer extends Socket {
  server: HTTPServer & {
    wss?: any;
  };
}

export async function GET(req: NextRequest) {
  console.log('WebSocket API route called');
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers));

  const response = new NextResponse();
  const socket = (response as any).socket as SocketWithServer;

  if (!socket) {
    console.error('No socket available in response');
    return new NextResponse('No socket available', { status: 500 });
  }

  console.log('Socket available:', {
    socketRemoteAddress: socket.remoteAddress,
    socketRemotePort: socket.remotePort
  });

  if (!socket.server) {
    console.error('No server object on socket');
    return new NextResponse('No server object', { status: 500 });
  }

  console.log('Server object available:', {
    serverAddress: socket.server.address(),
    serverConnections: socket.server.connections
  });

  if (!socket.server.wss) {
    console.log('Setting up WebSocket server');
    try {
      socket.server.wss = setupWebSocketServer(socket.server);
      console.log('WebSocket server setup complete');
    } catch (error) {
      console.error('Error setting up WebSocket server:', error);
      return new NextResponse('WebSocket setup failed', { status: 500 });
    }
  } else {
    console.log('WebSocket server already exists');
  }

  return new NextResponse();
} 