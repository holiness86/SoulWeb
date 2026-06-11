const mongoose = require('mongoose');

// Singleton pattern — only one document exists in this collection
const settingSchema = new mongoose.Schema({
  siteName:    { type: String, default: 'سُل وب' },
  siteUrl:     { type: String },
  logo:        { type: String },
  favicon:     { type: String },
  email:       { type: String },
  phone:       { type: String },
  address:     { type: String },
  socialLinks: {
    instagram: { type: String },
    telegram:  { type: String },
    linkedin:  { type: String },
    github:    { type: String }
  },
  seo: {
    metaTitle:       { type: String },
    metaDescription: { type: String },
    keywords:        [{ type: String }]
  },
  smtp: {
    host:     { type: String },
    port:     { type: Number },
    user:     { type: String },
    pass:     { type: String, select: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);