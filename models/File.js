const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  originalname: String,
  filename: String,
  mimetype: String,
  size: Number,
  s3Url: String,
  textContent: String,
  summary: String,
  chatHistory: [{ role: String, content: String }],
});

module.exports = mongoose.model('File', FileSchema);
