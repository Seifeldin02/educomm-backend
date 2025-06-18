import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

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
    const { courseId } = req.query;

    if (!courseId || typeof courseId !== 'string') {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // Get course document
    const courseDoc = await adminDB.collection('courses').doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = courseDoc.data();
    if (!courseData) {
      return res.status(404).json({ error: 'Course data not found' });
    }

    // Only course creator can manage enrollment
    if (courseData.createdBy !== uid) {
      return res.status(403).json({ error: 'Only course creator can manage enrollment' });
    }

    if (req.method === 'POST') {
      const { studentEmails } = req.body;

      if (!Array.isArray(studentEmails) || studentEmails.length === 0) {
        return res.status(400).json({ error: 'Student emails array is required' });
      }

      const currentStudents = courseData.students || [];
      const addedStudents = [];
      const errors = [];

      for (const email of studentEmails) {
        try {
          // Get user by email
          const userRecord = await adminAuth.getUserByEmail(email);
          
          // Check if user is a student
          const userDoc = await adminDB.collection('users').doc(userRecord.uid).get();
          const userData = userDoc.data();

          if (!userData) {
            errors.push(`User profile not found for: ${email}`);
            continue;
          }

          if (userData.role !== 'Student') {
            errors.push(`${email} is not a student`);
            continue;
          }

          // Check if already enrolled
          if (currentStudents.includes(userRecord.uid)) {
            errors.push(`${email} is already enrolled in this course`);
            continue;
          }

          addedStudents.push({
            uid: userRecord.uid,
            email: userRecord.email,
            name: userData.fullName || userRecord.displayName || email.split('@')[0]
          });

          // Add to course
          currentStudents.push(userRecord.uid);

        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            errors.push(`User not found: ${email}`);
          } else {
            errors.push(`Error processing ${email}: ${error.message}`);
          }
        }
      }

      // Update course with new students
      if (addedStudents.length > 0) {
        await adminDB.collection('courses').doc(courseId).update({
          students: currentStudents
        });
      }

      return res.status(200).json({
        success: true,
        addedStudents,
        errors: errors.length > 0 ? errors : undefined,
        message: `Added ${addedStudents.length} student(s) to the course`
      });

    } else if (req.method === 'DELETE') {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({ error: 'Student ID is required' });
      }

      const currentStudents = courseData.students || [];
      const studentIndex = currentStudents.indexOf(studentId);

      if (studentIndex === -1) {
        return res.status(404).json({ error: 'Student not found in course' });
      }

      // Remove student from course
      currentStudents.splice(studentIndex, 1);

      await adminDB.collection('courses').doc(courseId).update({
        students: currentStudents
      });

      return res.status(200).json({
        success: true,
        message: 'Student removed from course successfully'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Course enrollment API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 