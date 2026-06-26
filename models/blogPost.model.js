const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, unique: true, required: true },
  excerpt:     { type: String, maxlength: 300 },
  body:        { type: String, required: true },  // HTML or Markdown
  coverImage:  { type: String },
  // author: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User',
  //   required: true
  // },
  author: { type: String, required: true },
  tags:        [{ type: String }],
  category:    { type: String },
  readingTime: { type: Number },                  // minutes — can be auto-calculated
  views:       { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: { type: Date }
}, { timestamps: true });

// Auto-set publishedAt when status changes to published
blogPostSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('BlogPost', blogPostSchema);