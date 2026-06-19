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
  issueDate: { type: Date, default: Date.now },
  dueDate:  { type: Date },
  paidAt:   { type: Date },
  notes:    { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto-calculate total before save
// Auto-calculate total before save
invoiceSchema.pre('save', function () {
  const itemsTotal = this.items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0
    const unitPrice = Number(item.unitPrice) || 0

    item.total = quantity * unitPrice

    return sum + item.total
  }, 0)

  const tax = Number(this.tax) || 0
  const discount = Number(this.discount) || 0

  this.subtotal = itemsTotal
  this.total = Math.max(
    itemsTotal + (itemsTotal * tax / 100) - discount,
    0
  )
})


module.exports = mongoose.model('Invoice', invoiceSchema);