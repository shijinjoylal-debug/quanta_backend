import mongoose from 'mongoose';

const ChatHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: ['user', 'model'],
        required: true
    },
    parts: [{
        text: {
            type: String,
            required: true
        },
        _id: false
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Ensure we get the latest history quickly
ChatHistorySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('ChatHistory', ChatHistorySchema);
