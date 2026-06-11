const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String },
  coverImage:  { type: String, required: true },  // URL
  images:      [{ type: String }],                // additional gallery URLs
  category: {
    type: String,
    enum: ['web', 'store', 'ui_ux', 'webapp', 'branding', 'other'],
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