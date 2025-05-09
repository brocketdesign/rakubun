const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;

const trendModelSettingsSchema = new mongoose.Schema({
    language: { type: String, default: 'japanese' },
    tone: { type: String, default: 'Informative' },
    template: { type: String, default: '' },
    model: { type: String, default: 'gpt-4o' } // As per previous settings
}, { _id: false });

const blogInfoSchema = new mongoose.Schema({
    userId: {
        type: ObjectId,
        ref: 'User', // Assuming you have a User model
        required: true
    },
    blogName: {
        type: String,
        required: [true, 'ブログ名は必須です。'], // Blog name is required
        trim: true
    },
    blogUrl: {
        type: String,
        required: [true, 'ブログURLは必須です。'], // Blog URL is required
        trim: true
    },
    favicon: {
        type: String,
        trim: true
    },
    siteType: { // e.g., 'wordpress', 'blogger', 'custom'
        type: String,
        required: true
    },
    apiKey: { // For posting to the blog, should be encrypted if sensitive
        type: String,
        trim: true
    },
    username: { // For posting to the blog
        type: String,
        trim: true
    },
    // Trend Auto Blog specific settings
    trendKeywords: {
        type: [String],
        default: []
    },
    trendModelSettings: {
        type: trendModelSettingsSchema,
        default: () => ({}) // Default to an empty object, which will then get sub-defaults
    },
    // Autoblog bot settings (can be expanded)
    isActive: { // For the general autoblog bot associated with this blog
        type: Boolean,
        default: false
    },
    postFrequency: { // Cron schedule string for the bot
        type: String 
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { collection: 'blogInfos' }); // Specify the correct collection name here

// Middleware to update `updatedAt` field before saving
blogInfoSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

blogInfoSchema.pre('updateOne', function(next) {
    this.set({ updatedAt: new Date() });
    next();
});
blogInfoSchema.pre('findOneAndUpdate', function(next) {
    this.set({ updatedAt: new Date() });
    next();
});


const BlogInfo = mongoose.model('BlogInfo', blogInfoSchema);

module.exports = BlogInfo;