const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      'project_created', 'project_done', 'project_updated',
      'client_added',
      'invoice_paid', 'invoice_sent',
      'message_received',
      'review_added',
      'task_done'
    ],
    required: true
  },
  title:       { type: String, required: true },  // e.g. "پروژه آتین‌دیزاین تحویل داده شد"
  icon:        { type: String },                  // bootstrap-icons class name
  colorVariant:{ type: String, enum: ['main', 'accent', 'success', 'warning'], default: 'main' },
  relatedModel:{ type: String },                  // 'Project', 'Client', 'Invoice', etc.
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedModel'
  },
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);