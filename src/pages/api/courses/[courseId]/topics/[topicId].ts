import { NextApiRequest, NextApiResponse } from 'next';
import { adminDB, adminAuth } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
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

    if (req.method === 'GET') {
      // Get all replies for this topic
      const repliesSnapshot = await adminDB
        .collection('courseTopics')
        .doc(topicId)
        .collection('replies')
        .orderBy('createdAt', 'asc')
        .get();
      const replies = repliesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json({ success: true, topic: { id: topicDoc.id, ...topicData }, replies });
    }

    if (req.method === 'PUT') {
      // Only topic creator can edit
      if (topicData.createdBy !== uid) {
        return res.status(403).json({ error: 'Only topic creator can edit' });
      }
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }
      await adminDB.collection('courseTopics').doc(topicId).update({
        title,
        content,
        updatedAt: new Date().toISOString(),
      });
      return res.status(200).json({ success: true, message: 'Topic updated' });
    }

    if (req.method === 'DELETE') {
      // Only topic creator or lecturer can delete
      if (topicData.createdBy !== uid && !isLecturer) {
        return res.status(403).json({ error: 'Only topic creator or lecturer can delete' });
      }
      // Delete all replies
      const repliesSnapshot = await adminDB
        .collection('courseTopics')
        .doc(topicId)
        .collection('replies')
        .get();
      const batch = adminDB.batch();
      repliesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      batch.delete(topicDoc.ref);
      await batch.commit();
      return res.status(200).json({ success: true, message: 'Topic and replies deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Course topic API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 