import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    const { courseId, topicId, replyId } = req.query;
    if (
      !courseId ||
      typeof courseId !== "string" ||
      !topicId ||
      typeof topicId !== "string" ||
      !replyId ||
      typeof replyId !== "string"
    ) {
      return res
        .status(400)
        .json({ error: "Invalid course, topic, or reply ID" });
    }

    // Get course and verify access
    const courseDoc = await adminDB.collection("courses").doc(courseId).get();
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

    // Get topic
    const topicDoc = await adminDB
      .collection("courseTopics")
      .doc(topicId)
      .get();
    if (!topicDoc.exists) {
      return res.status(404).json({ error: "Topic not found" });
    }
    const topicData = topicDoc.data();
    if (!topicData || topicData.courseId !== courseId) {
      return res
        .status(404)
        .json({ error: "Topic does not belong to this course" });
    }

    // Get reply
    const replyDoc = await adminDB
      .collection("courseTopics")
      .doc(topicId)
      .collection("replies")
      .doc(replyId)
      .get();
    if (!replyDoc.exists) {
      return res.status(404).json({ error: "Reply not found" });
    }
    const replyData = replyDoc.data();
    if (!replyData) {
      return res.status(404).json({ error: "Reply data not found" });
    }

    if (req.method === "PUT") {
      // Only reply creator can edit
      if (replyData.createdBy !== uid) {
        return res.status(403).json({ error: "Only reply creator can edit" });
      }
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Content is required" });
      }
      await adminDB
        .collection("courseTopics")
        .doc(topicId)
        .collection("replies")
        .doc(replyId)
        .update({
          content,
          updatedAt: new Date().toISOString(),
        });
      return res.status(200).json({ success: true, message: "Reply updated" });
    }

    if (req.method === "DELETE") {
      // Only reply creator or lecturer can delete
      if (replyData.createdBy !== uid && !isLecturer) {
        return res
          .status(403)
          .json({ error: "Only reply creator or lecturer can delete" });
      }
      await adminDB
        .collection("courseTopics")
        .doc(topicId)
        .collection("replies")
        .doc(replyId)
        .delete();
      return res.status(200).json({ success: true, message: "Reply deleted" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Topic reply API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
