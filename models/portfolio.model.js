const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String },
  coverImage:  { type: String, required: true },  // URL
  coverImageAlt: { type: String, trim: true, maxlength: 200 },
  images:      [{ type: String }],                // additional gallery URLs
  category: {
    type: String,
    required: true
  },
  techStack: [{ type: String }],
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  liveUrl:   { type: String },
  isPublished: { type: Boolean, default: false },
  isFeatured:  { type: Boolean, default: false },
  order:       { type: Number, default: 0 }        // display sort order
}, { timestamps: true });

module.exports = mongoose.model('Portfolio', portfolioSchema);
