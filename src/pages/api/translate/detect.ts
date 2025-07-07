import { NextApiRequest, NextApiResponse } from "next";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://educomm-84fd5.web.app",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};

// Temporarily disable LibreTranslate for production
const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || null;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { q } = req.body;

    if (!q) {
      return res.status(400).json({ error: "No text provided" });
    }

    // Check if LibreTranslate is available
    if (!LIBRETRANSLATE_URL) {
      return res.status(503).json({
        error: "Translation service not available in production",
      });
    }

    // Call LibreTranslate detect endpoint
    const detectResponse = await fetch(`${LIBRETRANSLATE_URL}/detect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q }),
    });

    if (!detectResponse.ok) {
      const error = await detectResponse.text();
      throw new Error(`LibreTranslate detection failed: ${error}`);
    }

    const detectionResult = await detectResponse.json();
    return res.status(200).json(detectionResult);
  } catch (error) {
    console.error("Error in language detection:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to detect language",
      details: error,
    });
  }
}
