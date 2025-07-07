import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const token = req.headers.authorization?.split("Bearer ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const { courseId } = req.query;

    if (!courseId || typeof courseId !== "string") {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    // Get course document
    const courseDoc = await adminDB.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    const courseData = courseDoc.data();
    if (!courseData) {
      return res.status(404).json({ error: "Course data not found" });
    }

    // Get user role
    const userDoc = await adminDB.collection("users").doc(uid).get();
    const userData = userDoc.data();
    const userRole = userData?.role;

    if (req.method === "GET") {
      // Check access permissions
      const isLecturer = courseData.createdBy === uid;
      const isEnrolledStudent = courseData.students?.includes(uid);

      if (!isLecturer && !isEnrolledStudent) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get lecturer information
      let lecturerInfo = null;
      try {
        const lecturerUser = await adminAuth.getUser(courseData.createdBy);
        const lecturerDoc = await adminDB
          .collection("users")
          .doc(courseData.createdBy)
          .get();
        const lecturerData = lecturerDoc.data();

        lecturerInfo = {
          uid: courseData.createdBy,
          name: lecturerData?.fullName || lecturerUser.displayName || "Unknown",
          email: lecturerUser.email,
        };
      } catch (error) {
        lecturerInfo = {
          uid: courseData.createdBy,
          name: "Unknown",
          email: null,
        };
      }

      // Get student information if lecturer is viewing
      let studentsInfo = null;
      if (isLecturer && courseData.students?.length > 0) {
        studentsInfo = [];
        for (const studentId of courseData.students) {
          try {
            const studentUser = await adminAuth.getUser(studentId);
            const studentDoc = await adminDB
              .collection("users")
              .doc(studentId)
              .get();
            const studentData = studentDoc.data();

            studentsInfo.push({
              uid: studentId,
              name:
                studentData?.fullName || studentUser.displayName || "Unknown",
              email: studentUser.email,
            });
          } catch (error) {
            studentsInfo.push({ uid: studentId, name: "Unknown", email: null });
          }
        }
      }

      return res.status(200).json({
        success: true,
        course: {
          id: courseDoc.id,
          ...courseData,
          lecturer: lecturerInfo,
          studentsInfo,
          isLecturer,
          studentCount: courseData.students?.length || 0,
        },
      });
    } else if (req.method === "PUT") {
      // Only course creator can update course
      if (courseData.createdBy !== uid) {
        return res
          .status(403)
          .json({ error: "Only course creator can update course" });
      }

      const { name, description, courseCode, isActive } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (courseCode !== undefined) updateData.courseCode = courseCode;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Check if course code is unique (if being updated)
      if (courseCode && courseCode !== courseData.courseCode) {
        const existingCourse = await adminDB
          .collection("courses")
          .where("courseCode", "==", courseCode)
          .limit(1)
          .get();

        if (!existingCourse.empty && existingCourse.docs[0].id !== courseId) {
          return res.status(409).json({ error: "Course code already exists" });
        }
      }

      await adminDB.collection("courses").doc(courseId).update(updateData);

      return res.status(200).json({
        success: true,
        message: "Course updated successfully",
      });
    } else if (req.method === "DELETE") {
      // Only course creator can delete course
      if (courseData.createdBy !== uid) {
        return res
          .status(403)
          .json({ error: "Only course creator can delete course" });
      }

      // Delete related course materials and assignments
      const materialsSnapshot = await adminDB
        .collection("courseMaterials")
        .where("courseId", "==", courseId)
        .get();

      const assignmentsSnapshot = await adminDB
        .collection("assignments")
        .where("courseId", "==", courseId)
        .get();

      const batch = adminDB.batch();

      // Delete course materials
      materialsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete assignments
      assignmentsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete course
      batch.delete(courseDoc.ref);

      await batch.commit();

      return res.status(200).json({
        success: true,
        message: "Course and related content deleted successfully",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Course API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
