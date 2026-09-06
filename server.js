import "dotenv/config";
import express from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const port = process.env.PORT || 3000;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static("public"));

app.post("/api/generate-ad", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY غير موجود في ملف .env" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "ارفع صورة المنتج أولاً." });
    }

    const mime = req.file.mimetype;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      return res.status(400).json({ error: "الصيغ المدعومة: JPG, PNG, WEBP." });
    }

    const dataUrl = `data:${mime};base64,${req.file.buffer.toString("base64")}`;

    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      instructions: `
أنت Ad Generator احترافي لصناعة إعلانات المنتجات.
حلل صورة المنتج بدقة، ولا تخترع شعاراً أو مواصفات غير ظاهرة.
أخرج النتيجة بالعربية مع إبقاء الـ prompts الإبداعية بالإنجليزية.
رتب الإجابة بهذه العناوين:
1) PRODUCT_ANALYSIS
2) AD_CONCEPT
3) HOOK
4) AD_COPY
5) CTA
6) VIDEO_PROMPT
7) SHOT_LIST

في VIDEO_PROMPT حافظ على شكل المنتج وألوانه وشعاره كما يظهر في الصورة.
اجعل الإعلان مناسباً لفيديو عمودي 9:16 ومدته 8 ثوانٍ.
`,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "أنشئ لي إعلاناً احترافياً لهذا المنتج. اجعل الفكرة جذابة وقابلة للتنفيذ في فيديو قصير."
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "high"
            }
          ]
        }
      ]
    });

    res.json({ result: response.output_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "حدث خطأ أثناء الاتصال بالـAPI."
    });
  }
});


app.post("/api/generate-image", upload.single("image"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY غير موجود في ملف .env" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "ارفع صورة المنتج أولاً." });
    }

    const mime = req.file.mimetype;
    if (!["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      return res.status(400).json({ error: "الصيغ المدعومة: JPG, PNG, WEBP." });
    }

    const adConcept = String(req.body?.adConcept || '').slice(0, 12000);
    const prompt = `
Create the final premium vertical 9:16 product advertisement using the uploaded product image as the exact visual reference.
Preserve the product's identity, cup/bottle shape, logo, colors, proportions and visible branding. Do not invent a different product.
Use the AI-generated advertising concept below as the creative direction. Turn it into a coherent commercial visual rather than merely placing text on the image.

AI-GENERATED AD CONCEPT:
${adConcept || 'Create a premium, cinematic product advertisement that makes the product the hero.'}

Create cinematic lighting, realistic reflections, condensation where appropriate, natural shadows, premium composition, and strong visual hierarchy. Keep the product sharp and highly photorealistic.
If the concept calls for a beach/coastal or golden-hour setting, execute it naturally and elegantly. If it calls for another setting, follow the generated concept instead.
Leave clean negative space only where it improves the composition. Do not add fake logos, fake packaging, invented claims, prices, or unreadable promotional copy.
High-end commercial photography, photorealistic, premium advertising, vertical 9:16 composition.
`;

    const imageFile = await toFile(req.file.buffer, "product.png", { type: mime });
    const result = await client.images.edit({
      model: "gpt-image-2",
      image: imageFile,
      prompt,
      size: "1024x1536"
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("لم تُرجع خدمة الصور ملف الصورة الناتجة.");
    }

    res.json({ image: `data:image/png;base64,${b64}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "حدث خطأ أثناء إنشاء التصميم الإعلاني."
    });
  }
});

app.listen(port, () => {
  console.log(`Ad Generator يعمل على http://localhost:${port}`);
});
