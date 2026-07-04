const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'عنوان دسته‌بندی الزامی است'],
    trim: true,
    maxlength: [15, 'عنوان نمی‌تواند بیشتر از 15 کاراکتر باشد']
  },

  slug: {
    type: String,
    required: [false, 'اسلاگ الزامی است'],
    lowercase: true,
    trim: true
  },

  type: {
    type: String,
    required: true,
    enum: [
      'service',
      // 'service',
      // 'project',
      // 'blog',
      // 'request'
    ]
  },

  // description: {
  //   type: String,
  //   default: '',
  //   trim: true,
  //   maxlength: [300, 'توضیحات نمی‌تواند بیشتر از ۳۰۰ کاراکتر باشد']
  // },

  icon: {
    type: String,
    default: 'bi-folder'
  },

  color: {
    type: String,
    default: '#6447f4'
  },

  gradient: {
    type: String,
    default: 'linear-gradient(135deg,#6447f4,#0090e8)'
  },

  // order: {
  //   type: Number,
  //   default: 0
  // },

  // isActive: {
  //   type: Boolean,
  //   default: true
  // }
}, {
  timestamps: true
})

categorySchema.index({ type: 1, slug: 1 }, { unique: true })
// categorySchema.index({ type: 1, order: 1 })

module.exports = mongoose.model('Category', categorySchema)
