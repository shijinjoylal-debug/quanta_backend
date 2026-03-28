import mongoose from 'mongoose';

const PostSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
    },
    images: [{
        type: String
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    authorName: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model('Post', PostSchema);
