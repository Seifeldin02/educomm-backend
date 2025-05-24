import { NextApiRequest, NextApiResponse } from "next";

const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:5173',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

type TranslationMap = {
  [key: string]: {
    [key: string]: {
      [key: string]: string;
    };
  };
};

// Simple mock translations for demo purposes
const mockTranslations: TranslationMap = {
  en: {
    ms: {
      // Common words
      'hello': 'helo',
      'hi': 'hai',
      'world': 'dunia',
      'the': '',  // Articles often omitted in Malay
      'a': '',
      'an': '',
      'is': 'adalah',
      'are': 'adalah',
      'i': 'saya',
      'you': 'anda',
      'he': 'dia',
      'she': 'dia',
      'it': 'ia',
      'we': 'kami',
      'they': 'mereka',
      'this': 'ini',
      'that': 'itu',
      'here': 'di sini',
      'there': 'di sana',
      'today': 'hari ini',
      'now': 'sekarang',
      'good': 'baik',
      'bad': 'buruk',
      'yes': 'ya',
      'no': 'tidak',
      'name': 'nama',
      'my': 'saya',
      
      // Common phrases
      'how are you': 'apa khabar',
      'good morning': 'selamat pagi',
      'good afternoon': 'selamat tengah hari',
      'good evening': 'selamat petang',
      'good night': 'selamat malam',
      'thank you': 'terima kasih',
      'you are welcome': 'sama-sama',
      'goodbye': 'selamat tinggal',
      'see you later': 'jumpa lagi',
      'my name is': 'nama saya',
      'what is your name': 'siapa nama anda',
      'nice to meet you': 'senang berjumpa dengan anda',
    },
    zh: {
      // Body parts
      'neck': '脖子',
      'head': '头',
      'arm': '手臂',
      'leg': '腿',
      'back': '背',
      'shoulder': '肩膀',
      'hand': '手',
      'foot': '脚',
      
      // Common verbs
      'have': '有',
      'feel': '感觉',
      'am': '是',
      'is': '是',
      'are': '是',
      'go': '去',
      'come': '来',
      'want': '想要',
      'need': '需要',
      'like': '喜欢',
      'love': '爱',
      'hate': '讨厌',
      
      // Time-related
      'today': '今天',
      'tomorrow': '明天',
      'yesterday': '昨天',
      'now': '现在',
      'later': '稍后',
      'soon': '很快',
      'morning': '早上',
      'afternoon': '下午',
      'evening': '晚上',
      'night': '晚上',
      
      // Common nouns
      'class': '课',
      'school': '学校',
      'book': '书',
      'food': '食物',
      'water': '水',
      'time': '时间',
      'place': '地方',
      'home': '家',
      'work': '工作',
      
      // Feelings and conditions
      'pain': '疼痛',
      'tired': '累',
      'happy': '开心',
      'sad': '伤心',
      'sick': '生病',
      'hungry': '饿',
      'thirsty': '渴',
      
      // Common phrases
      'how are you': '你好吗',
      'i feel': '我感觉',
      'i have': '我有',
      'in my': '在我的',
      'i am': '我是',
      'see you': '再见',
      'thank you': '谢谢',
      'you are welcome': '不客气',
      'good morning': '早上好',
      'good afternoon': '下午好',
      'good evening': '晚上好',
      'good night': '晚安',
    },
    ar: {
      // Common words
      'hello': 'مرحبا',
      'hi': 'اهلا',
      'world': 'عالم',
      'the': 'ال',
      'a': '',
      'an': '',
      'is': 'هو',
      'are': 'هم',
      'i': 'انا',
      'you': 'انت',
      'he': 'هو',
      'she': 'هي',
      'it': 'هو',
      'we': 'نحن',
      'they': 'هم',
      'this': 'هذا',
      'that': 'ذلك',
      'here': 'هنا',
      'there': 'هناك',
      'today': 'اليوم',
      'now': 'الآن',
      'good': 'جيد',
      'bad': 'سيء',
      'yes': 'نعم',
      'no': 'لا',
      'name': 'اسم',
      'my': 'ي',

      // Common phrases
      'how are you': 'كيف حالك',
      'good morning': 'صباح الخير',
      'good afternoon': 'مساء الخير',
      'good evening': 'مساء الخير',
      'good night': 'تصبح على خير',
      'thank you': 'شكرا',
      'you are welcome': 'عفوا',
      'goodbye': 'مع السلامة',
      'see you later': 'الى اللقاء',
      'my name is': 'اسمي',
      'what is your name': 'ما اسمك',
      'nice to meet you': 'تشرفت بمعرفتك',
    }
  }
};

function mockTranslate(text: string, source: string, target: string): string {
  // If source and target are the same, or target is none, return original text
  if (source === target || target === 'none') {
    return text;
  }

  // Convert text to lowercase for matching
  const lowerText = text.toLowerCase();
  
  const sourceTranslations = mockTranslations[source];
  if (!sourceTranslations?.[target]) {
    return text; // Return original text instead of error message
  }

  // First try to translate the entire text as one phrase
  if (sourceTranslations[target][lowerText]) {
    return sourceTranslations[target][lowerText];
  }

  // Split the text into sentences and translate each sentence
  const sentences = text.split(/([.!?。]+)/);
  const translatedSentences = sentences.map(sentence => {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) return sentence;

    // Try to find the longest matching phrase in the sentence
    const phrases = Object.keys(sourceTranslations[target])
      .filter(phrase => phrase.includes(' '))
      .sort((a, b) => b.length - a.length);

    let translatedSentence = trimmedSentence.toLowerCase();
    for (const phrase of phrases) {
      if (translatedSentence.includes(phrase)) {
        translatedSentence = translatedSentence.replace(
          new RegExp(phrase, 'gi'),
          sourceTranslations[target][phrase]
        );
      }
    }

    // Translate remaining individual words
    const words = translatedSentence.split(' ');
    const translatedWords = words.map(word => {
      const lowerWord = word.toLowerCase();
      return sourceTranslations[target][lowerWord] || word;
    });

    return translatedWords.join(' ');
  });

  return translatedSentences.join('');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Translate API called with method:', req.method);
  
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
    const { q, source, target, format } = req.body;

    if (!q || !target) {
      console.error('Missing required parameters');
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const translatedText = mockTranslate(q, source || 'en', target);
    console.log('Translated text:', translatedText);

    return res.status(200).json({
      translatedText,
      from: source || 'en',
      to: target
    });
  } catch (error) {
    console.error('Error in translation:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to translate text',
      details: error
    });
  }
} 