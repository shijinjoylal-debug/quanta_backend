import express from 'express';
import { ingestProjectData, ingestExternalUrl, searchContext, generateAnswer } from '../services/learningService.js';

const router = express.Router();

router.post('/ingest', async (req, res) => {
    try {
        const { category } = req.body;
        const result = await ingestProjectData(category || 'project');
        res.json({ message: 'Ingestion successful', data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Ingest generic URL
router.post('/ingest-url', async (req, res) => {
    try {
        const { url, category } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const result = await ingestExternalUrl(url, category || 'quantum');
        res.json({ message: 'External ingestion successful', data: result });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/ask', async (req, res) => {
    try {
        const { query, category } = req.body; // category can be 'project', 'quantum', or null (all)
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const contextChunks = await searchContext(query, category);
        const answer = await generateAnswer(query, contextChunks);

        res.json({
            answer,
            context: contextChunks
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
