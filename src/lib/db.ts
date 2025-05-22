import { db } from './firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Helper function to convert Firestore timestamp to ISO string
export const convertTimestampToString = (timestamp: any) => {
  if (!timestamp) return null;
  return timestamp.toDate().toISOString();
};

// Re-export db to maintain backward compatibility
export { db }; 