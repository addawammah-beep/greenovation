require("dotenv").config({ path: require("path").join(__dirname, "db.env") });

const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

async function analyzeImage(imageSource, mimeType = "image/jpeg", maxRetries = 3) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured.");
    }

    let imageBuffer;
    if (typeof imageSource === "string") {
        const fullPath = path.resolve(imageSource);
        imageBuffer = fs.readFileSync(fullPath);
        const ext = path.extname(fullPath).toLowerCase();
        if (ext === ".png") mimeType = "image/png";
        else if (ext === ".webp") mimeType = "image/webp";
        else if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    } else if (Buffer.isBuffer(imageSource)) {
        imageBuffer = imageSource;
    } else {
        throw new TypeError("Image source must be a file path or a Buffer.");
    }

    if (mimeType === "image/jpg") mimeType = "image/jpeg";

    const ai = new GoogleGenAI({ apiKey });
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: MODEL,
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: `Check whether this photo visibly contains discarded trash.

Set contains_trash to true only when discarded waste is visibly present, such as litter, scattered garbage, plastic waste, or an illegal dump. Do not count clean scenery, ordinary objects that are being used, properly sorted recyclables, or trash fully contained in a normal bin. Judge only what is visible in the photo; do not infer trash from the user's description or location.

If the image is unclear, set contains_trash to false and explain that it is unclear. Give a short explanation in Arabic.`,
                            },
                            {
                                inlineData: {
                                    mimeType,
                                    data: imageBuffer.toString("base64"),
                                },
                            },
                        ],
                    },
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            contains_trash: { type: "BOOLEAN" },
                            confidence: { type: "NUMBER" },
                            reason: { type: "STRING" },
                        },
                        required: ["contains_trash", "confidence", "reason"],
                    },
                },
            });

            const text = response.text;
            if (typeof text !== "string" || !text.trim()) {
                throw new Error("Gemini returned an empty image-analysis response.");
            }

            const result = JSON.parse(text);
            if (
                typeof result.contains_trash !== "boolean" ||
                typeof result.confidence !== "number" ||
                !Number.isFinite(result.confidence) ||
                typeof result.reason !== "string"
            ) {
                throw new Error("Gemini returned an invalid image-analysis response.");
            }

            result.confidence = Math.max(0, Math.min(100, Math.round(result.confidence)));
            result.valid = result.contains_trash;
            return result;
        } catch (err) {
            attempt++;
            const status = err.status || err.statusCode;
            if ((status === 429 || status >= 500) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Gemini request failed with status ${status}; retrying in ${delay}ms (attempt ${attempt}/${maxRetries}).`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            console.error("Gemini image analysis failed:", {
                message: err.message,
                status,
                model: MODEL,
                code: err.code,
                name: err.name
            });
            throw err;
        }
    }

    throw new Error("Gemini image analysis failed after retries.");
}

module.exports = analyzeImage;
