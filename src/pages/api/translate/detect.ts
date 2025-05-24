import { NextApiRequest, NextApiResponse } from "next";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

// Simple language detection based on character sets
function detectLanguage(text: string): string {
  // Arabic characters
  if (/[\u0600-\u06FF]/.test(text)) {
    return 'ar';
  }
  // Chinese characters
  if (/[\u4E00-\u9FFF]/.test(text)) {
    return 'zh';
  }
  // Malay/Indonesian typically uses Latin script, so we'll need to make an educated guess
  // This is a very simple check for common Malay words
  const malayWords = ['saya', 'anda', 'dia', 'mereka', 'ini', 'itu', 'dan', 'atau', 'tetapi'];
  const words = text.toLowerCase().split(/\s+/);
  if (words.some(word => malayWords.includes(word))) {
    return 'ms';
  }
  // Default to English for Latin script
  return 'en';
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Detect API called with method:', req.method);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log('Request body:', req.body);
    const { q } = req.body;

    if (!q) {
      console.error('No text provided in request');
      return res.status(400).json({ error: "No text provided" });
    }

    const detectedLang = detectLanguage(q);
    console.log('Detected language:', detectedLang);

    return res.status(200).json([{ 
      language: detectedLang,
      confidence: 1
    }]);
  } catch (error) {
    console.error('Error in language detection:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to detect language',
      details: error
    });
  }
} 