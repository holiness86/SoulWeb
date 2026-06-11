const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderName:  { type: String, required: true, trim: true },
  senderEmail: { type: String, required: true, lowercase: true },
  senderPhone: { type: String },
  subject:     { type: String, trim: true },
  body:        { type: String, required: true },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'     // nullable — might be a new contact
  },
  isRead:   { type: Boolean, default: false },
  isStarred:{ type: Boolean, default: false },
  repliedAt:{ type: Date },
  source: {
    type: String,
    enum: ['contact_form', 'email', 'phone', 'direct'],
    default: 'contact_form'
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);