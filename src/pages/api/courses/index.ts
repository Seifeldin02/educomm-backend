import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

interface Course {
  id: string;
  name: string;
  description: string;
  courseCode?: string | null;
  createdBy: string;
  createdAt: string;
  students: string[];
  isActive: boolean;
  lecturerName?: string;
  lecturerEmail?: string;
  studentCount: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
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

    // Get user info to check role
    const userDoc = await adminDB.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const userData = userDoc.data();
    const userRole = userData?.role;

    if (req.method === 'GET') {
      let courses: Course[] = [];

      if (userRole === 'Lecturer') {
        // Lecturers see courses they created
        const coursesSnapshot = await adminDB
          .collection('courses')
          .where('createdBy', '==', uid)
          .get();

        courses = coursesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            studentCount: Array.isArray(data.students) ? data.students.length : 0
          } as Course;
        });
      } else if (userRole === 'Student') {
        // Students see courses they're enrolled in
        const coursesSnapshot = await adminDB
          .collection('courses')
          .where('students', 'array-contains', uid)
          .get();

        courses = coursesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            studentCount: Array.isArray(data.students) ? data.students.length : 0
          } as Course;
        });
      }

      // Sort courses by createdAt in memory
      courses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Get lecturer info for courses
      for (let course of courses) {
        try {
          const lecturerUser = await adminAuth.getUser(course.createdBy);
          const lecturerDoc = await adminDB.collection('users').doc(course.createdBy).get();
          const lecturerData = lecturerDoc.data();
          
          course.lecturerName = lecturerData?.fullName || lecturerUser.displayName || lecturerUser.email?.split('@')[0] || 'Unknown';
          course.lecturerEmail = lecturerUser.email;
        } catch (error) {
          course.lecturerName = 'Unknown';
        }
      }

      return res.status(200).json({
        success: true,
        courses
      });

    } else if (req.method === 'POST') {
      // Only lecturers can create courses
      if (userRole !== 'Lecturer') {
        return res.status(403).json({ error: 'Only lecturers can create courses' });
      }

      const { name, description, courseCode } = req.body;

      if (!name || !description) {
        return res.status(400).json({ error: 'Name and description are required' });
      }

      // Check if course code already exists
      if (courseCode) {
        const existingCourse = await adminDB
          .collection('courses')
          .where('courseCode', '==', courseCode)
          .limit(1)
          .get();

        if (!existingCourse.empty) {
          return res.status(409).json({ error: 'Course code already exists' });
        }
      }

      const courseData = {
        name,
        description,
        courseCode: courseCode || null,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        students: [],
        isActive: true
      };

      const courseRef = await adminDB.collection('courses').add(courseData);

      return res.status(201).json({
        success: true,
        course: {
          id: courseRef.id,
          ...courseData
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Courses API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 