import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

console.log("Starting model check...");
const modelsToTest = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-flash-latest"];

for (const modelName of modelsToTest) {
    try {
        console.log(`\nTesting model: ${modelName}`);
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("hi");
        console.log(`✅ ${modelName} works: ${result.response.text().substring(0, 20)}...`);
    } catch (e) {
        console.error(`❌ ${modelName} failed: ${e.message}`);
    }
}
