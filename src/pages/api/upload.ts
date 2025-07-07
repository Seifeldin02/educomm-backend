import { NextApiRequest, NextApiResponse } from "next";
import { adminAuth } from "@/lib/firebaseAdmin";
import formidable from "formidable";
import { v4 as uuidv4 } from "uuid";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse the form data
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);

    // Extract authorization token from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get the uploaded file
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.mimetype || "")) {
      return res.status(400).json({ error: "File type not allowed" });
    }

    // Generate unique filename
    const fileExtension = file.originalFilename?.split('.').pop() || '';
    const uniqueId = uuidv4();
    const filename = `${Date.now()}_${uniqueId}.${fileExtension}`;
    const filePath = `uploads/${userId}/${filename}`;

    // Get Firebase Storage bucket
    const storage = getStorage();
    const bucket = storage.bucket();
    const fileRef = bucket.file(filePath);

    // Upload file to Firebase Storage
    const fileBuffer = fs.readFileSync(file.filepath);
    await fileRef.save(fileBuffer, {
      metadata: {
        contentType: file.mimetype || 'application/octet-stream',
        metadata: {
          originalName: file.originalFilename || '',
          uploadedBy: userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    // Make the file publicly accessible
    await fileRef.makePublic();

    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

    // Determine if it's an image
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.mimetype || "");

    const fileInfo = {
      id: uniqueId,
      filename,
      originalName: file.originalFilename,
      mimetype: file.mimetype,
      size: file.size,
      isImage,
      url: publicUrl,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    };

    return res.status(200).json({
      success: true,
      file: fileInfo,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return res.status(500).json({ error: "Failed to upload file" });
  }
}
