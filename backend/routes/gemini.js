import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import ChatHistory from '../models/ChatHistory.js';

dotenv.config();

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/gemini/chat
router.post('/chat', async (req, res) => {
    try {
        const { prompt: userPrompt } = req.body;
        console.log('Received Gemini prompt:', userPrompt);

        if (!userPrompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const userId = req.session.user?.id;
        let history = [];

        // If user is logged in, fetch last 10 interactions (up to 20 messages)
        if (userId) {
            try {
                const dbHistory = await ChatHistory.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(20); // 10 pairs of user/model messages
                
                // Reverse to get chronological order for Gemini
                history = dbHistory.reverse().map(item => ({
                    role: item.role,
                    parts: item.parts
                }));
                console.log(`Loaded ${history.length} messages from history for user ${userId}`);
            } catch (historyError) {
                console.error('Error fetching history from MongoDB:', historyError);
                // Continue without history if database fails
            }
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const chat = model.startChat({
            history: history,
            generationConfig: {
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(userPrompt);
        const responseText = result.response.text();

        // If user is logged in, save the new interaction to MongoDB
        if (userId) {
            try {
                await ChatHistory.insertMany([
                    { user: userId, role: 'user', parts: [{ text: userPrompt }] },
                    { user: userId, role: 'model', parts: [{ text: responseText }] }
                ]);
            } catch (saveError) {
                console.error('Error saving history to MongoDB:', saveError);
            }
        }

        res.json({ text: responseText, generated_text: responseText });
    } catch (error) {
        console.error('Gemini API Error:', error);
        res.status(500).json({ error: 'Failed to fetch data from Gemini', details: error.message });
    }
});

export default router;
