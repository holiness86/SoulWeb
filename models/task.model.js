const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: { type: String },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  isDone:  { type: Boolean, default: false },
  doneAt:  { type: Date },
  dueDate: { type: Date },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'    // optional — task can be global or linked to a project
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto-set doneAt when task is marked done
taskSchema.pre('save', function(next) {
  if (this.isModified('isDone') && this.isDone && !this.doneAt) {
    this.doneAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);