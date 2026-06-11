const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity:    { type: Number, required: true, default: 1 },
  unitPrice:   { type: Number, required: true },
  total:       { type: Number }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true    // e.g. "INV-1048"
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  },
  items: [invoiceItemSchema],
  subtotal:  { type: Number, default: 0 },
  tax:       { type: Number, default: 0 },   // percentage
  discount:  { type: Number, default: 0 },   // amount
  total:     { type: Number, default: 0 },
  currency:  { type: String, default: 'IRR' },
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  dueDate:  { type: Date },
  paidAt:   { type: Date },
  notes:    { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto-calculate total before save
invoiceSchema.pre('save', function(next) {
  const itemsTotal = this.items.reduce((sum, i) => {
    i.total = i.quantity * i.unitPrice;
    return sum + i.total;
  }, 0);
  this.subtotal = itemsTotal;
  this.total = itemsTotal + (itemsTotal * this.tax / 100) - this.discount;
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);