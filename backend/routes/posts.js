import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Post from '../models/Post.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// GET: Fetch all posts
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Create a new post
router.post('/', upload.array('images', 4), async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized. Please log in.' });
        }

        const { text } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const images = req.files.map(file => `/uploads/${file.filename}`);

        const newPost = new Post({
            text,
            images,
            author: req.session.user.id,
            authorName: req.session.user.username
        });

        const savedPost = await newPost.save();
        res.status(201).json(savedPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE: Remove a post
router.delete('/:id', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'Unauthorized.' });
        }

        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post not found' });

        if (post.author.toString() !== req.session.user.id) {
            return res.status(403).json({ error: 'Forbidden. You can only delete your own posts.' });
        }

        // Delete associated images
        post.images.forEach(imagePath => {
            // Ensure path is relative before joining to avoid returning absolute path on Linux
            const relativePath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
            const fullPath = path.join(__dirname, '..', relativePath);
            if (fs.existsSync(fullPath)) {
                fs.unlinkSync(fullPath);
            }
        });

        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: 'Post deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
