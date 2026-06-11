const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: { type: String },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  type: {
    type: String,
    enum: ['web', 'store', 'ui_ux', 'webapp', 'app', 'other'],
    default: 'web'
  },
  techStack: [{ type: String }],   // e.g. ['Laravel', 'Vue', 'MySQL']
  status: {
    type: String,
    enum: ['active', 'review', 'done', 'hold', 'cancelled'],
    default: 'active'
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  deadline: { type: Date },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  price: { type: Number, default: 0 },
  isPaid: { type: Boolean, default: false },
  tags: [{ type: String }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);