import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import KnowledgeChunk from '../models/KnowledgeChunk.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
// backend/services -> backend/
const __dirname = path.dirname(path.dirname(__filename));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

// Cosine Similarity Function
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
}

// Function to chunk text
function splitTextIntoChunks(text, chunkSize = 1000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
}

export const ingestProjectData = async () => {
    try {
        console.log('Starting ingestion...');

        // Define directories to scan
        const projectRoot = path.join(__dirname, '..'); // unrealmind folder
        const directoriesToScan = [
            path.join(projectRoot, 'pages'),
            path.join(projectRoot, 'frontend'),
            path.join(projectRoot) // Scan root for index.html
        ];

        // Clear existing PROJECT data to avoid duplicates (Full re-learning for project)
        await KnowledgeChunk.deleteMany({ category: 'project' });
        console.log('Cleared existing project knowledge base.');

        let processedFiles = 0;

        for (const dir of directoriesToScan) {
            if (!fs.existsSync(dir)) continue;

            // If it is the root dir, only look for index.html to avoid node_modules etc
            if (dir === projectRoot) {
                const rootFile = path.join(dir, 'index.html');
                if (fs.existsSync(rootFile)) {
                    await processFile(rootFile);
                    processedFiles++;
                }
                continue;
            }

            const files = fs.readdirSync(dir);
            for (const file of files) {
                if (file.endsWith('.html')) {
                    await processFile(path.join(dir, file));
                    processedFiles++;
                }
            }
        }

        console.log(`Ingestion complete. Processed ${processedFiles} project files.`);
        return { success: true, processedFiles };

    } catch (error) {
        console.error('Ingestion failed:', error);
        throw error;
    }
};

async function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content);

    // Remove scripts and styles
    $('script').remove();
    $('style').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const title = $('title').text() || path.basename(filePath);

    if (!text) return;

    const chunks = splitTextIntoChunks(text);

    for (const chunk of chunks) {
        // Generate Embedding
        const result = await model.embedContent(chunk);
        const embedding = result.embedding.values;

        // Save to DB
        await KnowledgeChunk.create({
            content: chunk,
            source: path.relative(path.join(__dirname, '..'), filePath),
            title: title,
            embedding: embedding,
            category: 'project'
        });
    }
    console.log(`Processed: ${path.basename(filePath)}`);
}

export const ingestExternalUrl = async (url) => {
    try {
        console.log(`Ingesting external URL: ${url}`);
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        // Clean up
        $('script').remove();
        $('style').remove();
        $('nav').remove();
        $('footer').remove();
        $('header').remove();

        const title = $('title').text() || url;
        const text = $('body').text().replace(/\s+/g, ' ').trim();

        if (!text) throw new Error('No text content found');

        const chunks = splitTextIntoChunks(text);
        let count = 0;

        for (const chunk of chunks) {
            const result = await model.embedContent(chunk);
            const embedding = result.embedding.values;

            await KnowledgeChunk.create({
                content: chunk,
                source: url,
                title: title,
                embedding: embedding,
                category: 'quantum' // Specialized category
            });
            count++;
        }

        console.log(`Ingested ${count} chunks from ${url}`);
        return { success: true, chunks: count, title };

    } catch (error) {
        console.error('External ingestion failed:', error);
        throw error;
    }
};

export const searchContext = async (query, category = null) => {
    try {
        const result = await model.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // Fetch chunks based on category filter
        const filter = category ? { category } : {};
        const allChunks = await KnowledgeChunk.find(filter);

        const scoredChunks = allChunks.map(chunk => ({
            ...chunk.toObject(),
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sort by score
        scoredChunks.sort((a, b) => b.score - a.score);

        // Return top 5
        return scoredChunks.slice(0, 5);

    } catch (error) {
        console.error('Search failed:', error);
        throw error;
    }
};

export const generateAnswer = async (query, contextChunks) => {
    try {
        const contextText = contextChunks.map(chunk => chunk.content).join('\n\n');

        const prompt = `
        You are an intelligent assistant for the "Unrealmind" project.
        Use the following context from the project files to answer the user's question.
        If the answer is not in the context, say you don't know based on the project files.
        
        Context:
        ${contextText}
        
        Question: ${query}
        
        Answer:`;

        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Generation failed:', error);
        return `Error generating answer: ${error.message} (Status: ${error.status || 'Unknown'})`;
    }
};
