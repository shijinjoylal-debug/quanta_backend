import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import ChatHistory from '../models/ChatHistory.js';

dotenv.config();

const router = express.Router();

// Validate API Key presence
if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ GEMINI_API_KEY is missing from environment variables');
}

// Instantiate genAI outside the route to avoid repeat initialization
// But handle the case where the key might be missing
let genAI;
try {
    if (process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
} catch (err) {
    console.error('❌ Failed to initialize GoogleGenerativeAI:', err.message);
}

// POST /api/gemini/chat
router.post('/chat', async (req, res) => {
    try {
        const { prompt: userPrompt } = req.body;
        console.log('Received Gemini prompt:', userPrompt);

        if (!userPrompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ 
                error: 'Gemini API Key is not configured on the server.',
                details: 'The GEMINI_API_KEY environment variable is missing.'
            });
        }

        if (!genAI) {
            return res.status(500).json({ 
                error: 'Gemini AI failed to initialize.',
                details: 'Check if the API key is valid and the server has network access.'
            });
        }

        const userId = req.session.user?.id;
        let history = [];

        // If user is logged in, fetch last 10 interactions (up to 20 messages)
        if (userId) {
            try {
                const dbHistory = await ChatHistory.find({ user: userId })
                    .sort({ createdAt: -1 })
                    .limit(20); // 10 pairs of user/model messages
                
                // Reverse to get chronological order for Gemini, and SANITIZE parts
                history = dbHistory.reverse().map(item => ({
                    role: item.role,
                    parts: item.parts.map(p => ({ text: p.text }))
                }));

                // Gemini requires the first message to be from the 'user' role
                if (history.length > 0 && history[0].role === 'model') {
                    history.shift();
                }
                console.log(`Loaded ${history.length} messages from history for user ${userId}`);
            } catch (historyError) {
                console.error('Error fetching history from MongoDB:', historyError);
                // Continue without history if database fails
            }
        }

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

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
        console.error('Gemini API Error details:', error);
        res.status(500).json({ 
            error: 'Failed to fetch data from Gemini', 
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

export default router;
