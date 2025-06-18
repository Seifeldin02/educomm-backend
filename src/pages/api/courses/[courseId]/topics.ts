import { NextApiRequest, NextApiResponse } from 'next';
import { adminDB, adminAuth } from '@/lib/firebaseAdmin';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const { courseId } = req.query;
    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ error: 'Invalid course ID' });
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

    if (req.method === 'GET') {
      // List all topics for this course
      const topicsSnapshot = await adminDB
        .collection('courseTopics')
        .where('courseId', '==', courseId)
        .orderBy('createdAt', 'desc')
        .get();
      const topics = topicsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json({ success: true, topics });
    }

    if (req.method === 'POST') {
      // Only lecturers can create topics
      if (!isLecturer) {
        return res.status(403).json({ error: 'Only lecturers can create topics' });
      }
      const { title, content } = req.body;
      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
      }
      const userDoc = await adminDB.collection('users').doc(uid).get();
      const userData = userDoc.data();
      const topicData = {
        courseId,
        title,
        content,
        createdBy: uid,
        createdByName: userData?.fullName || decodedToken.name || decodedToken.email || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const topicRef = await adminDB.collection('courseTopics').add(topicData);

      // Notify all students in the course (not the lecturer)
      const students = courseData.students || [];
      for (const studentId of students) {
        if (studentId !== uid) { // skip lecturer
          const notification = {
            type: 'new_topic',
            courseId,
            courseName: courseData.name,
            topicId: topicRef.id,
            topicTitle: title,
            timestamp: Date.now(),
            read: false,
          };
          await adminDB.collection('notifications').doc(studentId).collection('items').add(notification);
        }
      }

      return res.status(201).json({ success: true, topic: { id: topicRef.id, ...topicData } });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Course topics API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 