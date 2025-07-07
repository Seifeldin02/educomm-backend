import { NextApiRequest, NextApiResponse } from "next";
import { adminDB, adminAuth } from "@/lib/firebaseAdmin";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

interface CourseMaterial {
  id: string;
  courseId: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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
  isVisible: boolean;
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
    const { courseId } = req.query;

    if (!courseId || typeof courseId !== "string") {
      return res.status(400).json({ error: "Invalid course ID" });
    }

    // Get course document and verify access
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

    if (req.method === "GET") {
      // Get all materials for the course
      const materialsSnapshot = await adminDB
        .collection("courseMaterials")
        .where("courseId", "==", courseId)
        .get();

      let materials: CourseMaterial[] = materialsSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as CourseMaterial)
      );

      // Sort by createdAt in memory (desc)
      materials.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Filter visible materials for students
      const filteredMaterials = isLecturer
        ? materials
        : materials.filter((material) => material.isVisible);

      return res.status(200).json({
        success: true,
        materials: filteredMaterials,
      });
    } else if (req.method === "POST") {
      // Only lecturers can create materials
      if (!isLecturer) {
        return res
          .status(403)
          .json({ error: "Only lecturers can create course materials" });
      }

      const { title, description, fileAttachment, isVisible = true } = req.body;

      if (!title || !description) {
        return res
          .status(400)
          .json({ error: "Title and description are required" });
      }

      const materialData = {
        courseId,
        title,
        description,
        createdBy: uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileAttachment: fileAttachment || null,
        isVisible,
      };

      const materialRef = await adminDB
        .collection("courseMaterials")
        .add(materialData);

      return res.status(201).json({
        success: true,
        material: {
          id: materialRef.id,
          ...materialData,
        },
      });
    } else if (req.method === "PUT") {
      // Only lecturers can update materials
      if (!isLecturer) {
        return res
          .status(403)
          .json({ error: "Only lecturers can update course materials" });
      }

      const { materialId, title, description, fileAttachment, isVisible } =
        req.body;

      if (!materialId) {
        return res.status(400).json({ error: "Material ID is required" });
      }

      // Check if material exists and belongs to this course
      const materialDoc = await adminDB
        .collection("courseMaterials")
        .doc(materialId)
        .get();
      if (!materialDoc.exists) {
        return res.status(404).json({ error: "Material not found" });
      }

      const materialData = materialDoc.data();
      if (materialData?.courseId !== courseId) {
        return res
          .status(403)
          .json({ error: "Material does not belong to this course" });
      }

      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (fileAttachment !== undefined)
        updateData.fileAttachment = fileAttachment;
      if (isVisible !== undefined) updateData.isVisible = isVisible;

      await adminDB
        .collection("courseMaterials")
        .doc(materialId)
        .update(updateData);

      return res.status(200).json({
        success: true,
        message: "Material updated successfully",
      });
    } else if (req.method === "DELETE") {
      // Only lecturers can delete materials
      if (!isLecturer) {
        return res
          .status(403)
          .json({ error: "Only lecturers can delete course materials" });
      }

      const { materialId } = req.body;

      if (!materialId) {
        return res.status(400).json({ error: "Material ID is required" });
      }

      // Check if material exists and belongs to this course
      const materialDoc = await adminDB
        .collection("courseMaterials")
        .doc(materialId)
        .get();
      if (!materialDoc.exists) {
        return res.status(404).json({ error: "Material not found" });
      }

      const materialData = materialDoc.data();
      if (materialData?.courseId !== courseId) {
        return res
          .status(403)
          .json({ error: "Material does not belong to this course" });
      }

      await adminDB.collection("courseMaterials").doc(materialId).delete();

      return res.status(200).json({
        success: true,
        message: "Material deleted successfully",
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Course materials API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
