const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  filename: { type: String, required: true },
  originalName: { type: String, default: '' },
  mimeType: { type: String, required: true },
  size: { type: Number, default: 0 },
  alt: { type: String, trim: true, maxlength: 200, default: '' },
  description: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Media', mediaSchema);
