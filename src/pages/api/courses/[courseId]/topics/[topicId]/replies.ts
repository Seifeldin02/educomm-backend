import { NextApiRequest, NextApiResponse } from 'next';
import { adminDB, adminAuth } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const { courseId, topicId } = req.query;
    if (!courseId || typeof courseId !== 'string' || !topicId || typeof topicId !== 'string') {
      return res.status(400).json({ error: 'Invalid course or topic ID' });
    }

    // Get course and verify access
    const courseDoc = await adminDB.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const courseData = courseDoc.data();
    if (!courseData) {
      return res.status(404).json({ error: 'Course data not found' });
    }
    const isLecturer = courseData.createdBy === uid;
    const isEnrolledStudent = courseData.students?.includes(uid);
    if (!isLecturer && !isEnrolledStudent) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get topic
    const topicDoc = await adminDB.collection('courseTopics').doc(topicId).get();
    if (!topicDoc.exists) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    const topicData = topicDoc.data();
    if (!topicData || topicData.courseId !== courseId) {
      return res.status(404).json({ error: 'Topic does not belong to this course' });
    }

    if (req.method === 'POST') {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      const userDoc = await adminDB.collection('users').doc(uid).get();
      const userData = userDoc.data();
      const replyData = {
        topicId,
        content,
        createdBy: uid,
        createdByName: userData?.fullName || decodedToken.name || decodedToken.email || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const replyRef = await adminDB.collection('courseTopics').doc(topicId).collection('replies').add(replyData);
      return res.status(201).json({ success: true, reply: { id: replyRef.id, ...replyData } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Topic replies API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 