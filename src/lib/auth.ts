import { auth } from './firebase-admin';
import { NextRequest } from 'next/server';
import { DecodedIdToken } from 'firebase-admin/auth';

export async function getAuthenticatedUser(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      throw new Error('No token provided');
    }

    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    throw new Error('Authentication failed');
  }
}

export async function validateUser(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      throw new Error('User not authenticated');
    }
    return user;
  } catch (error) {
    throw new Error('User validation failed');
  }
}

export async function verifyAuth(authHeader: string | null): Promise<DecodedIdToken | null> {
  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return null;
    }

    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return null;
  }
}

export async function verifyToken(token: string) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Invalid token');
  }
} 