import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

    // Get user info to check role
    const userDoc = await adminDB.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    const userData = userDoc.data();
    if (userData?.role !== "Lecturer") {
      return res
        .status(403)
        .json({ error: "Only lecturers can access dashboard" });
    }

    // 1. Total Groups (created by lecturer)
    const groupsSnapshot = await adminDB
      .collection("groups")
      .where("createdBy", "==", uid)
      .get();
    const totalGroups = groupsSnapshot.size;

    // 2. Total Students (unique students in lecturer's courses)
    const coursesSnapshot = await adminDB
      .collection("courses")
      .where("createdBy", "==", uid)
      .get();
    let studentSet = new Set<string>();
    coursesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      (data.students || []).forEach((sid: string) => studentSet.add(sid));
    });
    const totalStudents = studentSet.size;

    // 3. Active Discussions (topics in lecturer's courses)
    const courseIds = coursesSnapshot.docs.map((doc) => doc.id);
    let activeDiscussions = 0;
    if (courseIds.length > 0) {
      const topicsSnapshot = await adminDB
        .collection("courseTopics")
        .where("courseId", "in", courseIds.slice(0, 10))
        .get();
      // Firestore 'in' supports max 10 elements, so slice(0,10) for now
      activeDiscussions = topicsSnapshot.size;
    }

    // 4. Upcoming Events (assignments in lecturer's courses with dueDate in the future)
    let upcomingEvents = 0;
    if (courseIds.length > 0) {
      const assignmentsSnapshot = await adminDB
        .collection("assignments")
        .where("courseId", "in", courseIds.slice(0, 10))
        .get();
      const now = new Date();
      assignmentsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.dueDate && new Date(data.dueDate) > now) {
          upcomingEvents++;
        }
      });
    }

    // 5. Recent Activity (last 5: group, topic, assignment, student join)
    let recentActivity: any[] = [];
    // Groups
    groupsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      recentActivity.push({
        id: doc.id,
        type: "group",
        description: `Created group "${data.name}"`,
        timestamp: data.createdAt || data.created_at || null,
      });
    });
    // Topics
    if (courseIds.length > 0) {
      const topicsSnapshot = await adminDB
        .collection("courseTopics")
        .where("courseId", "in", courseIds.slice(0, 10))
        .get();
      topicsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        recentActivity.push({
          id: doc.id,
          type: "discussion",
          description: `New topic: "${data.title}"`,
          timestamp: data.createdAt || null,
        });
      });
    }
    // Assignments
    if (courseIds.length > 0) {
      const assignmentsSnapshot = await adminDB
        .collection("assignments")
        .where("courseId", "in", courseIds.slice(0, 10))
        .get();
      assignmentsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        recentActivity.push({
          id: doc.id,
          type: "event",
          description: `New assignment: "${data.title}"`,
          timestamp: data.createdAt || null,
        });
      });
    }
    // Students joined
    coursesSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      (data.students || []).forEach((sid: string) => {
        recentActivity.push({
          id: sid,
          type: "join",
          description: `Student joined course "${data.name}"`,
          timestamp: data.createdAt || null,
        });
      });
    });
    // Sort by timestamp desc, take last 5
    recentActivity = recentActivity
      .filter((a) => a.timestamp)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 5);

    return res.status(200).json({
      stats: {
        totalGroups,
        totalStudents,
        activeDiscussions,
        upcomingEvents,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Lecturer dashboard API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
