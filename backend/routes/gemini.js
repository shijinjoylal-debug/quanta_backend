import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/gemini/chat
router.post('/chat', async (req, res) => {
    try {
        const { prompt, history } = req.body;
        console.log('Received Gemini prompt:', prompt);

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        let result;
        if (history && Array.isArray(history)) {
            const chat = model.startChat({
                history: history,
            });
            result = await chat.sendMessage(prompt);
        } else {
            result = await model.generateContent(prompt);
        }

        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to fetch data from Gemini', details: error.message });
    }
});

export default router;
