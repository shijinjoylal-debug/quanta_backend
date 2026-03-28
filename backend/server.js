import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import session from 'express-session';
import MongoStore from 'connect-mongo';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // or frontend URL, localhost ports, and 127.0.0.1
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://quanta-nine-gold.vercel.app', // Explicit production URL
            'http://localhost:3000',
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:5500',
            'http://127.0.0.1:5500',
        ];

        // Be permissive for local development / file:// protocols where origin is "null"
        if (!origin || allowedOrigins.includes(origin) || origin === 'null' || (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:'))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'unrealmind_secret_key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 31, // 31 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true if in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// Static Uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Basic Route
app.get('/', (req, res) => {
    res.send('Unrealmind API is running');
});

// Import Routes
import postRoutes from './routes/posts.js';
import authRoutes from './routes/auth.js';
import learningRoutes from './routes/learning.js';
import geminiRoutes from './routes/gemini.js';

app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/gemini', geminiRoutes);
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;
