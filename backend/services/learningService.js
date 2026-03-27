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
const model = genAI.getGenerativeModel({ model: "embedding-001" });

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

// Recursive function to get all HTML files
function getAllHtmlFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        // Skip hidden folders and node_modules
        if (file.startsWith('.') || file === 'node_modules') {
            return;
        }
        
        if (stat.isDirectory()) {
            getAllHtmlFiles(filePath, fileList);
        } else if (file.endsWith('.html')) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

export const ingestProjectData = async () => {
    try {
        console.log('Starting ingestion...');

        // Define project root - allow override via env
        let projectRoot = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..', 'quanta');
        
        // Check if directory exists, if not fallback to server root
        if (!fs.existsSync(projectRoot)) {
            console.warn(`PROJECT_ROOT ${projectRoot} does not exist. Falling back to backend root.`);
            projectRoot = path.join(__dirname, '..');
        }
        
        console.log(`Scanning project root: ${projectRoot}`);

        // Find all HTML files recursively
        const htmlFiles = getAllHtmlFiles(projectRoot);
        
        if (htmlFiles.length === 0) {
            console.warn('No HTML files found in project root. Check PROJECT_ROOT in .env.');
        }

        // Clear existing PROJECT data to avoid duplicates (Full re-learning for project)
        await KnowledgeChunk.deleteMany({ category: 'project' });
        console.log('Cleared existing project knowledge base.');

        let processedFiles = 0;

        // Process files in parallel
        await Promise.all(htmlFiles.map(async (filePath) => {
            await processFile(filePath, projectRoot);
            processedFiles++;
        }));

        console.log(`Ingestion complete. Processed ${processedFiles} project files.`);
        return { success: true, processedFiles };

    } catch (error) {
        console.error('Ingestion failed:', error);
        throw error;
    }
};

async function processFile(filePath, projectRoot) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(content);

    // Remove scripts and styles
    $('script').remove();
    $('style').remove();

    const text = $('body').text().replace(/\s+/g, ' ').trim();
    const title = $('title').text() || path.basename(filePath);

    if (!text) return;

    const chunks = splitTextIntoChunks(text);

    // Process chunks in parallel
    await Promise.all(chunks.map(async (chunk) => {
        // Generate Embedding
        const result = await model.embedContent(chunk);
        const embedding = result.embedding.values;

        // Save to DB
        await KnowledgeChunk.create({
            content: chunk,
            source: path.relative(projectRoot, filePath),
            title: title,
            embedding: embedding,
            category: 'project'
        });
    }));
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

        await Promise.all(chunks.map(async (chunk) => {
            const result = await model.embedContent(chunk);
            const embedding = result.embedding.values;

            await KnowledgeChunk.create({
                content: chunk,
                source: url,
                title: title,
                embedding: embedding,
                category: 'quantum' // Specialized category
            });
        }));

        console.log(`Ingested ${chunks.length} chunks from ${url}`);
        return { success: true, chunks: chunks.length, title };

    } catch (error) {
        console.error('External ingestion failed:', error);
        throw error;
    }
};

export const searchContext = async (query, category = null) => {
    try {
        const result = await model.embedContent(query);
        const queryEmbedding = result.embedding.values;

        // Fetch chunks based on category filter - Optimize by selecting necessary fields and using lean
        const filter = category ? { category } : {};
        const allChunks = await KnowledgeChunk.find(filter)
            .select('embedding content source title category')
            .lean();

        const scoredChunks = allChunks.map(chunk => ({
            ...chunk,
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
