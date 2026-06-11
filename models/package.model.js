const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true    // e.g. "پکیج طلایی"
  },
  slug:        { type: String, unique: true },   // for URL
  description: { type: String },
  price:       { type: Number, required: true },
  currency:    { type: String, default: 'IRR' },
  duration:    { type: String },                 // e.g. "۱۴ روز کاری"
  features: [{ type: String }],                  // list of included features
  category: {
    type: String,
    enum: ['web', 'store', 'ui_ux', 'seo', 'maintenance', 'other'],
    default: 'web'
  },
  isActive:    { type: Boolean, default: true },
  isFeatured:  { type: Boolean, default: false },
  order:       { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Package', packageSchema);