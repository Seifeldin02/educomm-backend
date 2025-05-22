import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { verifyAuth } from '@/lib/auth';
import { json, handleOptions } from '@/lib/middleware';

export { handleOptions as OPTIONS };

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    const user = await verifyAuth(authHeader);

    if (!user) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get search query from URL
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.toLowerCase();

    if (!query || query.length < 2) {
      return json({ users: [] });
    }

    // Search users by email, username, or fullName
    const usersSnapshot = await db
      .collection('users')
      .get();

    const users = usersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          uid: doc.id,
          email: data.email,
          username: data.username || '',
          displayName: data.displayName || data.email,
          fullName: data.fullName || data.displayName || data.email
        };
      })
      .filter(userData => {
        return (
          userData.email.toLowerCase().includes(query) ||
          (userData.username && userData.username.toLowerCase().includes(query)) ||
          (userData.fullName && userData.fullName.toLowerCase().includes(query))
        );
      })
      // Limit to first 10 matches
      .slice(0, 10);

    return json({ users });
  } catch (error) {
    console.error('API Error:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
} 