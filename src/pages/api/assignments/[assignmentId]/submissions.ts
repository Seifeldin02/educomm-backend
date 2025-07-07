import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  submittedAt: string;
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
  grade?: number;
  feedback?: string;
  gradedAt?: string;
  gradedBy?: string;
  isLate: boolean;
}

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
    const { assignmentId } = req.query;

    if (!assignmentId || typeof assignmentId !== "string") {
      return res.status(400).json({ error: "Invalid assignment ID" });
    }

    // Get assignment and verify access
    const assignmentDoc = await adminDB
      .collection("assignments")
      .doc(assignmentId)
      .get();
    if (!assignmentDoc.exists) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    const assignmentData = assignmentDoc.data();
    if (!assignmentData) {
      return res.status(404).json({ error: "Assignment data not found" });
    }

    // Get course and verify access
    const courseDoc = await adminDB
      .collection("courses")
      .doc(assignmentData.courseId)
      .get();
    if (!courseDoc.exists) {
      return res.status(404).json({ error: "Course not found" });
    }

    const courseData = courseDoc.data();
    if (!courseData) {
      return res.status(404).json({ error: "Course data not found" });
    }

    const isLecturer = courseData.createdBy === uid;
    const isEnrolledStudent = courseData.students?.includes(uid);

    if (!isLecturer && !isEnrolledStudent) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (req.method === "GET") {
      if (isLecturer) {
        // Lecturers can see all submissions for the assignment
        const submissionsSnapshot = await adminDB
          .collection("submissions")
          .where("assignmentId", "==", assignmentId)
          .orderBy("submittedAt", "desc")
          .get();

        const submissions: Submission[] = await Promise.all(
          submissionsSnapshot.docs.map(async (doc) => {
            const submissionData = doc.data();

            // Get student info
            let studentInfo = { name: "Unknown", email: "Unknown" };
            try {
              const studentUser = await adminAuth.getUser(
                submissionData.studentId
              );
              const studentDoc = await adminDB
                .collection("users")
                .doc(submissionData.studentId)
                .get();
              const studentUserData = studentDoc.data();

              studentInfo = {
                name:
                  studentUserData?.fullName ||
                  studentUser.displayName ||
                  "Unknown",
                email: studentUser.email || "Unknown",
              };
            } catch (error) {
              console.error("Error getting student info:", error);
            }

            const isLate =
              new Date(submissionData.submittedAt) >
              new Date(assignmentData.dueDate);

            return {
              id: doc.id,
              ...submissionData,
              studentName: studentInfo.name,
              studentEmail: studentInfo.email,
              isLate,
            } as Submission;
          })
        );

        return res.status(200).json({
          success: true,
          submissions,
        });
      } else {
        // Students can only see their own submission
        const submissionSnapshot = await adminDB
          .collection("submissions")
          .where("assignmentId", "==", assignmentId)
          .where("studentId", "==", uid)
          .limit(1)
          .get();

        let submission = null;
        if (!submissionSnapshot.empty) {
          const submissionData = submissionSnapshot.docs[0].data();
          const isLate =
            new Date(submissionData.submittedAt) >
            new Date(assignmentData.dueDate);

          submission = {
            id: submissionSnapshot.docs[0].id,
            ...submissionData,
            isLate,
          };
        }

        return res.status(200).json({
          success: true,
          submission,
          canSubmit:
            new Date() <= new Date(assignmentData.dueDate) ||
            assignmentData.allowLateSubmission,
        });
      }
    } else if (req.method === "POST") {
      // Only students can submit assignments
      if (!isEnrolledStudent) {
        return res
          .status(403)
          .json({ error: "Only enrolled students can submit assignments" });
      }

      // Check if deadline has passed
      const now = new Date();
      const dueDate = new Date(assignmentData.dueDate);

      if (now > dueDate && !assignmentData.allowLateSubmission) {
        return res
          .status(400)
          .json({
            error:
              "Assignment deadline has passed and late submissions are not allowed",
          });
      }

      const { fileAttachment } = req.body;

      if (!fileAttachment) {
        return res
          .status(400)
          .json({ error: "File attachment is required for submission" });
      }

      // Check if student already has a submission
      const existingSubmission = await adminDB
        .collection("submissions")
        .where("assignmentId", "==", assignmentId)
        .where("studentId", "==", uid)
        .limit(1)
        .get();

      if (!existingSubmission.empty) {
        return res
          .status(409)
          .json({
            error:
              "You have already submitted this assignment. Use PUT to update your submission.",
          });
      }

      const submissionData = {
        assignmentId,
        studentId: uid,
        submittedAt: new Date().toISOString(),
        fileAttachment,
      };

      const submissionRef = await adminDB
        .collection("submissions")
        .add(submissionData);

      return res.status(201).json({
        success: true,
        submission: {
          id: submissionRef.id,
          ...submissionData,
        },
      });
    } else if (req.method === "PUT") {
      const { submissionId, fileAttachment, grade, feedback } = req.body;

      if (!submissionId) {
        return res.status(400).json({ error: "Submission ID is required" });
      }

      // Get submission
      const submissionDoc = await adminDB
        .collection("submissions")
        .doc(submissionId)
        .get();
      if (!submissionDoc.exists) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const submissionData = submissionDoc.data();
      if (!submissionData || submissionData.assignmentId !== assignmentId) {
        return res
          .status(403)
          .json({ error: "Submission does not belong to this assignment" });
      }

      if (isLecturer) {
        // Lecturers can grade submissions
        const updateData: any = {};

        if (grade !== undefined) updateData.grade = grade;
        if (feedback !== undefined) updateData.feedback = feedback;

        if (grade !== undefined || feedback !== undefined) {
          updateData.gradedAt = new Date().toISOString();
          updateData.gradedBy = uid;
        }

        await adminDB
          .collection("submissions")
          .doc(submissionId)
          .update(updateData);

        return res.status(200).json({
          success: true,
          message: "Submission graded successfully",
        });
      } else if (submissionData.studentId === uid) {
        // Students can update their own submissions before deadline
        const now = new Date();
        const dueDate = new Date(assignmentData.dueDate);

        if (now > dueDate && !assignmentData.allowLateSubmission) {
          return res
            .status(400)
            .json({ error: "Cannot update submission after deadline" });
        }

        if (!fileAttachment) {
          return res
            .status(400)
            .json({
              error: "File attachment is required for submission update",
            });
        }

        const updateData = {
          fileAttachment,
          submittedAt: new Date().toISOString(), // Update submission time
        };

        await adminDB
          .collection("submissions")
          .doc(submissionId)
          .update(updateData);

        return res.status(200).json({
          success: true,
          message: "Submission updated successfully",
        });
      } else {
        return res.status(403).json({ error: "Access denied" });
      }
    } else if (req.method === "DELETE") {
      const { submissionId } = req.body;

      if (!submissionId) {
        return res.status(400).json({ error: "Submission ID is required" });
      }

      // Get submission
      const submissionDoc = await adminDB
        .collection("submissions")
        .doc(submissionId)
        .get();
      if (!submissionDoc.exists) {
        return res.status(404).json({ error: "Submission not found" });
      }

      const submissionData = submissionDoc.data();
      if (!submissionData || submissionData.assignmentId !== assignmentId) {
        return res
          .status(403)
          .json({ error: "Submission does not belong to this assignment" });
      }

      // Only students can delete their own submissions before deadline
      if (submissionData.studentId !== uid) {
        return res
          .status(403)
          .json({ error: "You can only delete your own submission" });
      }

      const now = new Date();
      const dueDate = new Date(assignmentData.dueDate);

      if (now > dueDate) {
        return res
          .status(400)
          .json({ error: "Cannot delete submission after deadline" });
      }

      await adminDB.collection("submissions").doc(submissionId).delete();

      return res.status(200).json({
        success: true,
        message: "Submission deleted successfully",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Assignment submissions API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
