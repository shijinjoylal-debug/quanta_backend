import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log("Starting test...");
try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    console.log("Model instantiated:", !!model);

    const result = await model.generateContent("hello");
    console.log("Generated:", result.response.text());
} catch (e) {
    console.error("Caught expected error:", e);
}
