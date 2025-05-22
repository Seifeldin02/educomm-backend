import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

export const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export function corsResponse(data: any, status = 200) {
  // Always return with CORS headers, even for error responses
  const response = NextResponse.json(data, { status });
  
  // Explicitly set all CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

export function handleCorsError(error: any) {
  console.error('API Error:', error);
  return corsResponse({ error: 'Internal server error' }, 500);
}

export async function handleOptions(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    // Explicitly set all CORS headers for OPTIONS
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }
  return new NextResponse(null, { status: 405 });
} 