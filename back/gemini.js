require("dotenv").config();
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function analyzeImage(imageSource, mimeType = "image/jpeg", maxRetries = 3) {
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            let imageBuffer;
            if (typeof imageSource === "string") {
                const fullPath = path.resolve(imageSource);
                imageBuffer = fs.readFileSync(fullPath);
                const ext = path.extname(fullPath).toLowerCase();
                if (ext === ".png") mimeType = "image/png";
                else if (ext === ".webp") mimeType = "image/webp";
                else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
                else if (ext === ".gif") mimeType = "image/gif";
            } else {
                imageBuffer = imageSource;
            }

            const response = await groq.chat.completions.create({
                model: "meta-llama/llama-4-scout-17b-16e-instruct",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `You are an environmental inspection AI.

Determine whether this image shows a real environmental issue.

Examples:
- Garbage
- Plastic waste
- Illegal dumping
- Water pollution
- Air pollution
- Sewage
- Construction waste

Reply ONLY with valid JSON.

{
  "valid": true,
  "confidence": 95,
  "reason": "Short explanation"
}`,
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBuffer.toString("base64")}`,
                                },
                            },
                        ],
                    },
                ],
            });

            const text = response.choices[0].message.content.trim();
            
            // تنظيف النص في حال أرجع النموذج علامات الـ markdown الخاصة بالكود
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(cleanText);

        } catch (err) {
            attempt++;
            
            // Handle 429 quota errors with retry
            if (err.status === 429 && attempt < maxRetries) {
                const retryDelay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
                console.log(`Quota exceeded, retrying in ${Math.round(retryDelay / 1000)}s (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
            }
            
            console.error("Gemini Error:", err);
            return {
                valid: false,
                confidence: 0,
                reason: err.message,
            };
        }
    }
    
    return {
        valid: false,
        confidence: 0,
        reason: "Max retries exceeded due to quota limits",
    };
}


module.exports = analyzeImage;
