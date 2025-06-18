import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

interface Assignment {
  id: string;
  courseId: string;
  courseName?: string;
  title: string;
  description: string;
  instructions: string;
  dueDate: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  maxPoints: number;
  allowLateSubmission: boolean;
  fileAttachment?: {
    id: string;
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
    isImage: boolean;
    url: string;
    uploadedBy: string;
    uploadedAt: string;
  };
  submissionCount?: number;
  userSubmission?: {
    id: string;
    submittedAt: string;
    fileAttachment?: any;
    status: 'submitted' | 'late' | 'graded';
    grade?: number;
    feedback?: string;
  };
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
      let assignments: Assignment[] = [];

      if (userRole === 'Student') {
        // Students see assignments from all their enrolled courses
        const coursesSnapshot = await adminDB
          .collection('courses')
          .where('students', 'array-contains', uid)
          .get();

        const courseIds = coursesSnapshot.docs.map(doc => doc.id);
        const courseNames = new Map();
        coursesSnapshot.docs.forEach(doc => {
          courseNames.set(doc.id, doc.data().name);
        });

        if (courseIds.length > 0) {
          // Get all assignments for enrolled courses
          const assignmentsSnapshot = await adminDB
            .collection('assignments')
            .where('courseId', 'in', courseIds)
            .get();

          assignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
            const assignmentData = doc.data();
            
            // Get user's submission if exists
            const submissionSnapshot = await adminDB
              .collection('submissions')
              .where('assignmentId', '==', doc.id)
              .where('studentId', '==', uid)
              .limit(1)
              .get();

            let userSubmission = null;
            if (!submissionSnapshot.empty) {
              const submissionData = submissionSnapshot.docs[0].data();
              const isLate = new Date(submissionData.submittedAt) > new Date(assignmentData.dueDate);
              
              userSubmission = {
                id: submissionSnapshot.docs[0].id,
                submittedAt: submissionData.submittedAt,
                fileAttachment: submissionData.fileAttachment,
                status: submissionData.grade !== undefined ? 'graded' : (isLate ? 'late' : 'submitted'),
                grade: submissionData.grade,
                feedback: submissionData.feedback
              };
            }

            return {
              id: doc.id,
              ...assignmentData,
              courseName: courseNames.get(assignmentData.courseId),
              userSubmission
            } as Assignment;
          }));

          // Sort assignments by due date in memory
          assignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }

      } else if (userRole === 'Lecturer') {
        // Lecturers see assignments from their courses
        const coursesSnapshot = await adminDB
          .collection('courses')
          .where('createdBy', '==', uid)
          .get();

        const courseIds = coursesSnapshot.docs.map(doc => doc.id);
        const courseNames = new Map();
        coursesSnapshot.docs.forEach(doc => {
          courseNames.set(doc.id, doc.data().name);
        });

        if (courseIds.length > 0) {
          const assignmentsSnapshot = await adminDB
            .collection('assignments')
            .where('courseId', 'in', courseIds)
            .get();

          assignments = await Promise.all(assignmentsSnapshot.docs.map(async (doc) => {
            const assignmentData = doc.data();
            
            // Get submission count
            const submissionsSnapshot = await adminDB
              .collection('submissions')
              .where('assignmentId', '==', doc.id)
              .get();

            return {
              id: doc.id,
              ...assignmentData,
              courseName: courseNames.get(assignmentData.courseId),
              submissionCount: submissionsSnapshot.size
            } as Assignment;
          }));

          // Sort assignments by due date in memory
          assignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        }
      }

      return res.status(200).json({
        success: true,
        assignments
      });

    } else if (req.method === 'POST') {
      // Only lecturers can create assignments
      if (userRole !== 'Lecturer') {
        return res.status(403).json({ error: 'Only lecturers can create assignments' });
      }

      const { courseId, title, description, instructions, dueDate, maxPoints, allowLateSubmission, fileAttachment } = req.body;

      if (!courseId || !title || !description || !instructions || !dueDate) {
        return res.status(400).json({ error: 'Course ID, title, description, instructions, and due date are required' });
      }

      // Verify course ownership
      const courseDoc = await adminDB.collection('courses').doc(courseId).get();
      if (!courseDoc.exists) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const courseData = courseDoc.data();
      if (courseData?.createdBy !== uid) {
        return res.status(403).json({ error: 'You can only create assignments for your own courses' });
      }

      const assignmentData = {
        courseId,
        title,
        description,
        instructions,
        dueDate,
        maxPoints: maxPoints || 100,
        allowLateSubmission: allowLateSubmission || false,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileAttachment: fileAttachment || null
      };

      const assignmentRef = await adminDB.collection('assignments').add(assignmentData);

      // Notify all students in the course
      const students = courseData.students || [];
      for (const studentId of students) {
        const notification = {
          type: 'new_assignment',
          courseId,
          courseName: courseData.name,
          assignmentId: assignmentRef.id,
          assignmentTitle: title,
          timestamp: Date.now(),
          read: false,
        };
        await adminDB.collection('notifications').doc(studentId).collection('items').add(notification);
      }

      return res.status(201).json({
        success: true,
        assignment: {
          id: assignmentRef.id,
          ...assignmentData
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Assignments API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 