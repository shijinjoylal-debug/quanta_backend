import mongoose from 'mongoose';

const KnowledgeChunkSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    source: {
        type: String, // Path or URL to original file
        required: true
    },
    title: {
        type: String
    },
    embedding: {
        type: [Number], // Vector representation
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    category: {
        type: String,
        default: 'project', // 'project' or 'quantum'
        index: true
    }
});

// Create a compound index if we were using Atlas Search, 
// for now standard indexing on source might be useful.
KnowledgeChunkSchema.index({ source: 1 });

export default mongoose.model('KnowledgeChunk', KnowledgeChunkSchema);
