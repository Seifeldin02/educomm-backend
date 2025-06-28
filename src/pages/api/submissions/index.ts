import type { NextApiRequest, NextApiResponse } from "next";
import { adminDB as db, adminAuth } from "../../../lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Enable CORS
  Object.keys(corsHeaders).forEach((key) => {
    res.setHeader(key, corsHeaders[key as keyof typeof corsHeaders]);
  });

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (req.method === "GET") {
      try {
        // Get all submissions from the submissions collection
        const submissionsRef = db.collection("submissions");
        const submissionsSnapshot = await submissionsRef.get();

        const submissions: any[] = [];
        submissionsSnapshot.forEach((doc) => {
          submissions.push({
            id: doc.id,
            ...doc.data(),
          });
        });

        // Filter submissions based on user role
        let filteredSubmissions = submissions;

        // If user is a student, only return their submissions
        if (decodedToken.role === "student") {
          filteredSubmissions = submissions.filter(
            (submission) => submission.studentId === decodedToken.uid
          );
        }
        // If user is a lecturer, return submissions for their assignments
        else if (decodedToken.role === "lecturer") {
          // Get lecturer's assignments first
          const assignmentsRef = db.collection("assignments");
          const assignmentsSnapshot = await assignmentsRef
            .where("createdBy", "==", decodedToken.uid)
            .get();

          const lecturerAssignmentIds = new Set();
          assignmentsSnapshot.forEach((doc) => {
            lecturerAssignmentIds.add(doc.id);
          });

          filteredSubmissions = submissions.filter((submission) =>
            lecturerAssignmentIds.has(submission.assignmentId)
          );
        }

        res.status(200).json({ submissions: filteredSubmissions });
      } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).json({ error: "Failed to fetch submissions" });
      }
    } else if (req.method === "POST") {
      try {
        const { assignmentId, fileAttachment, submissionText } = req.body;

        if (!assignmentId) {
          return res.status(400).json({ error: "Assignment ID is required" });
        }

        // Check if assignment exists
        const assignmentDoc = await db
          .collection("assignments")
          .doc(assignmentId)
          .get();
        if (!assignmentDoc.exists) {
          return res.status(404).json({ error: "Assignment not found" });
        }

        // Check if student already submitted
        const existingSubmissionSnapshot = await db
          .collection("submissions")
          .where("assignmentId", "==", assignmentId)
          .where("studentId", "==", decodedToken.uid)
          .get();

        if (!existingSubmissionSnapshot.empty) {
          return res
            .status(400)
            .json({ error: "Submission already exists for this assignment" });
        }

        // Create new submission
        const submissionData = {
          assignmentId,
          studentId: decodedToken.uid,
          submittedAt: new Date().toISOString(),
          fileAttachment: fileAttachment || null,
          submissionText: submissionText || "",
          grade: null,
          feedback: "",
          gradedAt: null,
          gradedBy: null,
        };

        const submissionRef = await db
          .collection("submissions")
          .add(submissionData);

        res.status(201).json({
          id: submissionRef.id,
          ...submissionData,
        });
      } catch (error) {
        console.error("Error creating submission:", error);
        res.status(500).json({ error: "Failed to create submission" });
      }
    } else {
      res.setHeader("Allow", ["GET", "POST"]);
      res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in submissions API:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
