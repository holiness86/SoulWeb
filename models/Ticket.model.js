const mongoose = require('mongoose');

// ─────────────────────────────────────────
//  Sub-schema: هر پیام داخل تردِ تیکت
// ─────────────────────────────────────────
const ticketMessageSchema = new mongoose.Schema({
  sender: {
    type: String,
    enum: ['client', 'admin'],
    required: true
  },
  // اگر پاسخ از طرف ادمین باشد، کاربر ادمین ثبت‌کننده مشخص می‌شود
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  body: { type: String, required: true, trim: true },
  attachments: [{
    fileName: { type: String, required: true },
    fileUrl:  { type: String, required: true },
    fileSize: { type: Number }, // بر حسب بایت
    mimeType: { type: String }
  }]
}, { timestamps: true });

// ─────────────────────────────────────────
//  Schema اصلی: تیکت پشتیبانی
// ─────────────────────────────────────────
const ticketSchema = new mongoose.Schema({
  // شناسه نمایشی و یکتای تیکت — مثال: TCK-1024
  ticketNo: {
    type: String,
    unique: true,
    index: true
  },

  // ── اطلاعات درخواست‌کننده ──
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'   // nullable — ممکن است تماس‌گیرنده جدید باشد
  },
  requesterName:  { type: String, required: true, trim: true },
  requesterEmail: { type: String, required: true, lowercase: true, trim: true },
  requesterPhone: { type: String, trim: true },

  // ── محتوای تیکت ──
  subject: { type: String, required: true, trim: true },

  department: {
    type: String,
    enum: ['technical', 'financial', 'sales', 'general'],
    default: 'general'
  },

  priority: {
    type: String,
    enum: ['urgent', 'medium', 'low'],
    default: 'medium'
  },

  status: {
    type: String,
    enum: ['open', 'pending', 'closed'],
    default: 'open'
  },

  // ── ترد پیام‌ها (گفتگوی بین کاربر و پشتیبانی) ──
  messages: [ticketMessageSchema],

  // ── مسئول رسیدگی به تیکت ──
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  source: {
    type: String,
    enum: ['contact_form', 'email', 'phone', 'direct', 'admin_created'],
    default: 'contact_form'
  },

  isStarred: { type: Boolean, default: false },
  closedAt:  { type: Date }

}, { timestamps: true });

// ─────────────────────────────────────────
//  تولید خودکار شماره تیکت قبل از ذخیره
// ─────────────────────────────────────────
ticketSchema.pre('save', async function (next) {
  if (!this.isNew || this.ticketNo) return next();

  try {
    const Ticket = mongoose.model('Ticket');
    const lastTicket = await Ticket.findOne({}).sort({ createdAt: -1 }).select('ticketNo').lean();

    let nextNumber = 1000;
    if (lastTicket && lastTicket.ticketNo) {
      const lastNumber = parseInt(lastTicket.ticketNo.replace('TCK-', ''), 10);
      if (!isNaN(lastNumber)) nextNumber = lastNumber + 1;
    }

    this.ticketNo = `TCK-${nextNumber}`;
    next();
  } catch (err) {
    next(err);
  }
});

// وقتی وضعیت به closed تغییر می‌کند، تاریخ بسته‌شدن ثبت شود
ticketSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    } else if (this.status !== 'closed') {
      this.closedAt = undefined;
    }
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);