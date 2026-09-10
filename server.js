import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const port = process.env.PORT || 3000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.static("public"));

function validateImage(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    res.status(500).json({ error: "GEMINI_API_KEY غير موجود في إعدادات الخادم." });
    return false;
  }
  if (!req.file) {
    res.status(400).json({ error: "ارفع صورة المنتج أولاً." });
    return false;
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(req.file.mimetype)) {
    res.status(400).json({ error: "الصيغ المدعومة: JPG, PNG, WEBP." });
    return false;
  }
  return true;
}

const commonPrompt = `أنت خبير صناعة إعلانات للمنتجات. حلل الصورة بدقة ولا تخترع مواصفات أو شعارات غير ظاهرة. أخرج النتيجة بالعربية، واجعل VIDEO_PROMPT بالإنجليزية. استخدم العناوين التالية فقط:
1) PRODUCT_ANALYSIS
2) AD_CONCEPT
3) HOOK
4) AD_COPY
5) CTA
6) VIDEO_PROMPT
7) SHOT_LIST
اجعل الفيديو 9:16 ومدته 8 ثوانٍ، وحافظ على هوية المنتج وألوانه وشعاره كما يظهر في الصورة.`;

app.post("/api/generate-ad", upload.single("image"), async (req, res) => {
  try {
    if (!validateImage(req, res)) return;
    const prompt = `${commonPrompt}\n\nأنشئ إعلاناً احترافياً وجذاباً لهذا المنتج، مناسباً للسوشيال ميديا.`;
    const imagePart = {
      inlineData: {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64")
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, imagePart] }]
    });

    res.json({ result: response.text || "لم يتم إنشاء نتيجة." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "حدث خطأ أثناء الاتصال بـGemini." });
  }
});

app.post("/api/generate-image-prompt", upload.single("image"), async (req, res) => {
  try {
    if (!validateImage(req, res)) return;
    const adConcept = String(req.body?.adConcept || "").slice(0, 12000);
    const prompt = `حوّل فكرة الإعلان التالية إلى prompt إنجليزي احترافي جاهز لتوليد صورة إعلانية عمودية 9:16. حافظ على هوية المنتج وشكله وألوانه وشعاره كما يظهر في الصورة. لا تضف ادعاءات أو شعارات وهمية. اجعل المنتج هو البطل، بإضاءة سينمائية وتكوين فاخر.

${adConcept}`;
    const imagePart = {
      inlineData: {
        mimeType: req.file.mimetype,
        data: req.file.buffer.toString("base64")
      }
    };
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: prompt }, imagePart] }]
    });
    res.json({ prompt: response.text || "" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || "حدث خطأ أثناء تجهيز Prompt الصورة." });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Ad Generator يعمل على المنفذ ${port}`);
});
