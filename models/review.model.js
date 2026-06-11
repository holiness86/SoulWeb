const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  text: {
    type: String,
    required: true,
    maxlength: 1000
  },
  authorName:   { type: String },   // override if client wants different display name
  authorRole:   { type: String },   // e.g. "مدیرعامل شرکت پارسیان"
  avatarUrl:    { type: String },
  isApproved:   { type: Boolean, default: false },
  isPublished:  { type: Boolean, default: false },
  isFeatured:   { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);