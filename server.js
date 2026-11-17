const express    = require('express')
const mongoose   = require('mongoose')
const bcrypt     = require('bcryptjs')
const path       = require('path')
const fs         = require('fs')
const multer     = require('multer')
const ExcelJS    = require('exceljs')
const puppeteer  = require('puppeteer-core')
const ejs        = require('ejs')
const session    = require('express-session');
const moment     = require('jalali-moment');
const methodOverride = require('method-override');
// require('dotenv').config();

const app = express()

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  MIDDLEWARE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  })
}

app.use(session({
  secret: 'soulweb-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Ø§Ú¯Ø± https Ø¯Ø§Ø´ØªÛŒ true Ú©Ù†
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

function requireAdminAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/sw-admin/login');
  }
  next();
}




const toEnglishDigits = (str) => {
  if (!str) return str
  const persianDigits = 'Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹'
  const arabicDigits  = 'Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'
  return String(str)
    .replace(/[Û°-Û¹]/g, d => persianDigits.indexOf(d))
    .replace(/[Ù -Ù©]/g, d => arabicDigits.indexOf(d))
}

const normalizeDate = (value) => {
  if (!value) return null
  const cleaned = toEnglishDigits(value).trim()
  const parsed = moment(cleaned, 'jYYYY/jMM/jDD')
  if (!parsed.isValid()) return null
  return parsed.locale('en').toDate()
}

const normalizeTechStack = (value) => {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.map(item => String(item).trim()).filter(Boolean)
  }
  return String(value).split(/[,ØŒÂ·|]/).map(item => item.trim()).filter(Boolean)
}

const normalizeProgress = (value) => {
  const num = parseInt(toEnglishDigits(value), 10)
  if (Number.isNaN(num)) return 0
  return Math.max(0, Math.min(100, num))
}
// browser = await puppeteer.launch({
//   executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
//   headless: true
// })

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  MODELS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const User      = require('./models/user.model')
const Client    = require('./models/client.model')
const Project   = require('./models/project.model')
const Invoice   = require('./models/invoice.model')
const Ticket    = require('./models/Ticket.model')
const Task      = require('./models/task.model')
const Activity  = require('./models/activity.model')
const Portfolio = require('./models/portfolio.model')
const Review    = require('./models/review.model')
const Package   = require('./models/package.model')
const BlogPost  = require('./models/blogPost.model')
const Setting   = require('./models/setting.model')
const Category  = require('./models/category')
const Media     = require('./models/media.model')


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADMIN LOCALS â€” Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù…Ø´ØªØ±Ú© Ù‡Ø¯Ø± Ùˆ Ø³Ø§ÛŒØ¯Ø¨Ø§Ø±
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.use('/sw-admin', async (req, res, next) => {
    const admin = req.session?.user;

    if (!admin) return next();

    try {
        const name = String(admin.name || 'Ù…Ø¯ÛŒØ±').trim();
        const words = name.split(/\s+/).filter(Boolean);

        res.locals.adminUser = {
            name: name,
            role: admin.role || 'Ù…Ø¯ÛŒØ±',
            initials: words.slice(0, 2).map(w => w[0]).join('')
        };

        const openTickets = await Ticket.countDocuments({
            status: 'open'
        });

        res.locals.ticketBadge = openTickets;
        res.locals.notifCount = openTickets;

    } catch (err) {
        console.error('Admin locals error:', err);

        res.locals.ticketBadge = 0;
        res.locals.notifCount = 0;
    }

    next();
});


// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ADMIN â€” LIVE NOTIFICATIONS API
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/sw-admin/media', requireAdminAuth, async (req, res) => {
  try {
    const items = await Media.find().sort({ createdAt: -1 }).lean()
    res.render('admin/Media', { items })
  } catch (err) {
    console.error('Media page error:', err)
    res.status(500).send('خطا در بارگذاری کتابخانه رسانه')
  }
})

app.post('/sw-admin/api/media', requireAdminAuth, (req, res, next) => {
  mediaUpload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ message: err.message || 'فایل تصویر نامعتبر است' })
    next()
  })
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'فایل تصویر انتخاب نشده یا نوع فایل پشتیبانی نمی‌شود' })
    const item = await Media.create({
      url: `/uploads/media/${req.file.filename}`,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      alt: String(req.body.alt || '').trim(),
      description: String(req.body.description || '').trim()
    })
    res.status(201).json(item)
  } catch (err) {
    console.error('Media upload error:', err)
    res.status(500).json({ message: 'خطا در ذخیره تصویر' })
  }
})

app.patch('/sw-admin/api/media/:id', requireAdminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'شناسه نامعتبر است' })
    const item = await Media.findByIdAndUpdate(req.params.id, {
      alt: String(req.body.alt || '').trim(),
      description: String(req.body.description || '').trim()
    }, { new: true, runValidators: true })
    if (!item) return res.status(404).json({ message: 'رسانه پیدا نشد' })
    res.json(item)
  } catch (err) {
    console.error('Media update error:', err)
    res.status(500).json({ message: 'خطا در ذخیره توضیحات رسانه' })
  }
})

app.get('/sw-admin/api/notifications', requireAdminAuth, async (req, res) => {
    try {
        const [tickets, latest] = await Promise.all([
            Ticket.countDocuments({ status: 'open' }),

            Ticket.find({ status: 'open' })
                .sort({ createdAt: -1 })
                .limit(6)
                .lean()
        ]);

        res.json({
            tickets,
            items: latest.map(t => ({
                id: t._id,
                title: t.subject || 'ØªÛŒÚ©Øª Ø¬Ø¯ÛŒØ¯',
                body: t.requesterName
                    ? `Ø§Ø² Ø·Ø±Ù ${t.requesterName}`
                    : '',
                href: '/sw-admin/tickets',
                at: t.createdAt
            }))
        });

    } catch (err) {
        console.error('Notifications API error:', err);

        res.status(500).json({
            tickets: 0,
            items: []
        });
    }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  DB + SERVER START
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const DB_URL = 'mongodb://admin:pM8U6IsnbQBsnGspAg1f@soulwebdb-ttk-service:27017/admin'
// const DB_URL = 'mongodb://localhost:27017/SoulWeb'
const PORT   = 3000

mongoose.connect(DB_URL)
  .then(() => {
    console.log('DB is connected âœ…')
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} ðŸš€`)
    })
  })
  .catch(err => {
    console.error('DB connection failed âŒ', err.message)
    process.exit(1)
  })



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  MULTER CODE
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/portfolio')
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname)
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
})
const blogStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/uploads/blog')
    fs.mkdir(dir, { recursive: true }, err => cb(err, dir))
  },
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname).toLowerCase())
})
const blogUpload = multer({
  storage: blogStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
})
const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'public/uploads/media')
    fs.mkdir(dir, { recursive: true }, err => cb(err, dir))
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname).toLowerCase()}`)
})
const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'].includes(file.mimetype))
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PUBLIC ROUTES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/', async (req, res) => {
  try {
    const [portfolio, packages, siteSetting] = await Promise.all([
      Portfolio.find().sort({ order: 1 }),
      Package.find({ isActive: true }).sort({ order: 1, createdAt: -1 }),
      Setting.findOne().lean()
    ]);

    res.render('index', {
      portfolio,
      packages,
      siteSetting
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” DASHBOARD
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin', requireAdminAuth, async (req, res) => {
  try {
    const now = new Date();

    // Ø´Ø±ÙˆØ¹ Ù‡ÙØªÙ‡
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // Ø´Ø±ÙˆØ¹ Ø¨Ø§Ø²Ù‡ Û¶ Ù…Ø§Ù‡Ù‡ Ù†Ù…ÙˆØ¯Ø§Ø±
    const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      activeProjects,
      reviewProjects,
      totalClients,
      newClients,
      doneProjects,
      totalProjects,
      openTickets,
      lastTicket,
      recentActivitiesData,
      projectsData,
      ticketsData,
      todayTasksData,
      chartProjects,
      paidRevenueData,
      pendingInvoices,
      pendingRevenueData,
      reviewsForRating
    ] = await Promise.all([
      Project.countDocuments({ status: 'active' }),
      Project.countDocuments({ status: 'review' }),
      Client.countDocuments({ isActive: true }),
      Client.countDocuments({ createdAt: { $gte: weekStart } }),
      Project.countDocuments({ status: 'done' }),
      Project.countDocuments(),
      Ticket.countDocuments({ status: 'open' }),
      Ticket.findOne().sort({ createdAt: -1 }).select('createdAt').lean(),
      Activity.find().sort({ createdAt: -1 }).limit(7).lean(),
      Project.find()
        .populate('client', 'name company')
        .populate('category', 'title')
        .sort({ createdAt: -1 })
        .limit(7)
        .lean(),
      Ticket.find().sort({ createdAt: -1 }).limit(5).lean(),
      Task.find().sort({ createdAt: -1 }).limit(7).lean(),
      Project.find({ createdAt: { $gte: chartStart } })
        .select('createdAt')
        .lean(),
      Invoice.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Invoice.countDocuments({ status: { $in: ['draft', 'sent', 'overdue'] } }),
      Invoice.aggregate([{ $match: { status: { $in: ['draft', 'sent', 'overdue'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Review.aggregate([{ $match: { isApproved: true, rating: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }])
    ]);

    // Ø¢Ù…Ø§Ø± Ø§ØµÙ„ÛŒ Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯
    const stats = {
      activeProjects: activeProjects || 0,
      reviewProjects: reviewProjects || 0,
      newClients: newClients || 0,
      totalClients: totalClients || 0,
      doneProjects: doneProjects || 0,
      donePct: totalProjects
        ? Math.round((doneProjects / totalProjects) * 100)
        : 0,
      openTickets: openTickets || 0,
      lastTicketAt: lastTicket?.createdAt || null,
      deliveredProjects: doneProjects || 0
    };

    // Ú©Ø§Ø±Øª Ù‡Ø§ÛŒ Ú©ÙˆÚ†Ú©
    const minis = {
      paidAmount: paidRevenueData[0]?.total || 0,
      pendingCount: pendingInvoices || 0,
      pendingAmount: pendingRevenueData[0]?.total || 0,
      ratingAvg: Math.round((reviewsForRating[0]?.avg || 0) * 10) / 10,
      ratingCount: reviewsForRating[0]?.count || 0
    };

    // Ù†Ù…ÙˆØ¯Ø§Ø± Û¶ Ù…Ø§Ù‡ Ø§Ø®ÛŒØ±
    const chart = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth();

      const count = chartProjects.filter(project => {
        if (!project.createdAt) return false;

        const projectDate = new Date(project.createdAt);

        return (
          projectDate.getFullYear() === year &&
          projectDate.getMonth() === month
        );
      }).length;

      chart.push({
        label: new Intl.DateTimeFormat('fa-IR', {
          month: 'long'
        }).format(date),
        val: count,
        h: Math.max(5, count * 10),
        active: i === 0
      });
    }

    // ÙØ¹Ø§Ù„ÛŒØª Ù‡Ø§ÛŒ Ø§Ø®ÛŒØ±
    const recentActivities = (recentActivitiesData || []).map(activity => ({
      ...activity,
      title: activity.title || 'ÙØ¹Ø§Ù„ÛŒØª Ø¬Ø¯ÛŒØ¯',
      icon: activity.icon || 'bi-lightning-charge-fill',
      colorVariant: activity.colorVariant || 'accent',
      createdAt: activity.createdAt || now
    }));

    // Ù¾Ø±ÙˆÚ˜Ù‡ Ù‡Ø§ÛŒ Ø§Ø®ÛŒØ± Ø¨Ø§ Ø³Ø§Ø®ØªØ§Ø± Ù…ÙˆØ±Ø¯ Ù†ÛŒØ§Ø² EJS
    const statusLabels = {
      active: { label: 'Ø¯Ø± Ø­Ø§Ù„ Ø§Ù†Ø¬Ø§Ù…', cls: 'active' },
      review: { label: 'Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø±Ø±Ø³ÛŒ', cls: 'warning' },
      done: { label: 'ØªÚ©Ù…ÛŒÙ„ Ø´Ø¯Ù‡', cls: 'success' },
      pending: { label: 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±', cls: 'secondary' },
      cancelled: { label: 'Ù„ØºÙˆ Ø´Ø¯Ù‡', cls: 'danger' }
    };

    const projects = (projectsData || []).map(project => {
      const status = statusLabels[project.status] || {
        label: project.status || 'Ù†Ø§Ù…Ø´Ø®Øµ',
        cls: 'secondary'
      };

      const progress = Math.min(
        100,
        Math.max(0, Number(project.progress) || 0)
      );

      const deadline = project.deadline
        ? new Date(project.deadline).toLocaleDateString('fa-IR')
        : 'â€”';

      return {
        name: project.name || project.title || 'Ø¨Ø¯ÙˆÙ† Ø¹Ù†ÙˆØ§Ù†',
        type: project.type || '',
        client:
          project.client?.name ||
          project.client?.company ||
          'Ø¨Ø¯ÙˆÙ† Ù…Ø´ØªØ±ÛŒ',
        cat:
          project.category?.title ||
          project.category ||
          'â€”',
        cls: status.cls,
        label: status.label,
        prog: progress,
        urgent: project.deadline
          ? new Date(project.deadline) < now && project.status !== 'done'
          : false,
        deadline
      };
    });

    // ØªÛŒÚ©Øª Ù‡Ø§ÛŒ Ø§Ø®ÛŒØ± Ø¨Ø§ Ø³Ø§Ø®ØªØ§Ø± Ù…ÙˆØ±Ø¯ Ù†ÛŒØ§Ø² EJS
    const tickets = (ticketsData || []).map((ticket, index) => {
      const ticketName =
        ticket.name ||
        ticket.user?.name ||
        ticket.client?.name ||
        ticket.sender?.name ||
        'Ú©Ø§Ø±Ø¨Ø±';

      const initials = String(ticketName)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || '')
        .join('');

      return {
        name: ticketName,
        initials: initials || 'ØŸ',
        preview:
          ticket.subject ||
          ticket.title ||
          ticket.message ||
          ticket.description ||
          'ØªÛŒÚ©Øª Ø¬Ø¯ÛŒØ¯',
        time: ticket.createdAt || now,
        unread: ticket.isRead === false || ticket.unread === true,
        v: (index % 5) + 1
      };
    });

    // ÙˆØ¸Ø§ÛŒÙ
    const todayTasks = (todayTasksData || []).map(task => ({
      _id: task._id,
      title: task.title || 'Ø¨Ø¯ÙˆÙ† Ø¹Ù†ÙˆØ§Ù†',
      isDone: Boolean(task.isDone),
      priority: ['high', 'medium', 'low'].includes(task.priority)
        ? task.priority
        : 'medium'
    }));

    // ØªØ§Ø±ÛŒØ® Ø§Ù…Ø±ÙˆØ²
    const todayFa = new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(now);

    res.render('admin/Dashboard', {
      stats,
      minis,
      chart,
      recentActivities,
      projects,
      tickets,
      todayTasks,
      todayFa
    });

  } catch (err) {
    console.error('Dashboard Error:', err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ø¯Ø§Ø´Ø¨ÙˆØ±Ø¯');
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” PROJECTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/projects', requireAdminAuth, async (req, res) => {
  try {

    const { status, search } = req.query
    const filter = {}

    if (status) filter.status = status
    if (search) filter.title = { $regex: search, $options: 'i' }

    const projects = await Project.find(filter)
      .populate('client', 'name company')
      .populate('category', 'title slug')
      .sort({ createdAt: -1 })
      .lean()

    const clients = await Client.find({ isActive: true })
      .sort({ name: 1 })
      .lean()

    const serviceCategories = await Category.find({ type: 'service' }).lean()
const kanbanColumns = [
  { key: 'todo', title: 'Ø¯Ø± Ø§Ù†ØªØ¸Ø§Ø±' },
  { key: 'inprogress', title: 'Ø¯Ø± Ø­Ø§Ù„ Ø§Ù†Ø¬Ø§Ù…' },
  { key: 'review', title: 'Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø±Ø±Ø³ÛŒ' },
  { key: 'done', title: 'Ø§Ù†Ø¬Ø§Ù…â€ŒØ´Ø¯Ù‡' }
];

const defaultTechOptions = ['HTML', 'CSS', 'JavaScript', 'Node.js', 'React', 'MongoDB'];

res.render('admin/Projects', {
  projects,
  clients,
  serviceCategories,
  kanbanColumns,
  defaultTechOptions,
  query: req.query
});



  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù¾Ø±ÙˆÚ˜Ù‡â€ŒÙ‡Ø§')
  }
})



// app.post('/sw-admin/projects', async (req, res) => {
//   try {
//     const { title, description, client, type, techStack,
//             status, progress, deadline, price, tags } = req.body

//     // createdBy: Ø¯Ø± Ù¾Ø±ÙˆÚ˜Ù‡ ÙˆØ§Ù‚Ø¹ÛŒ Ø§Ø² session Ù…ÛŒØ§Ø¯ â€” ÙØ¹Ù„Ø§ placeholder
//     const ADMIN_PLACEHOLDER_ID = '000000000000000000000001'

//     await Project.create({
//       title, description, client, type,
//       techStack : techStack ? techStack.split(',').map(t => t.trim()) : [],
//       status    : status || 'active',
//       progress  : Number(progress) || 0,
//       deadline  : deadline || null,
//       price     : Number(price) || 0,
//       tags      : tags ? tags.split(',').map(t => t.trim()) : [],
//       createdBy : ADMIN_PLACEHOLDER_ID
//     })

//     // Ø«Ø¨Øª ÙØ¹Ø§Ù„ÛŒØª
//     await Activity.create({
//       type        : 'project_created',
//       title       : `Ù¾Ø±ÙˆÚ˜Ù‡ Ø¬Ø¯ÛŒØ¯ Â«${title}Â» Ø«Ø¨Øª Ø´Ø¯`,
//       icon        : 'bi-file-earmark-plus-fill',
//       colorVariant: 'main'
//     })

//     res.redirect('/sw-admin/projects')
//   } catch (err) {
//     console.error(err)
//     res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù¾Ø±ÙˆÚ˜Ù‡')
//   }
// })

app.post('/sw-admin/projects/:id/update', requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      client,
      category,
      status,
      progress,
      startDate,
      deadline,
      techStack,
      description
    } = req.body

    if (!title || !client || !category) {
      return res.status(400).send('Ù†Ø§Ù… Ù¾Ø±ÙˆÚ˜Ù‡ØŒ Ù…Ø´ØªØ±ÛŒ Ùˆ Ù†ÙˆØ¹ Ù¾Ø±ÙˆÚ˜Ù‡ Ø§Ù„Ø²Ø§Ù…ÛŒ Ù‡Ø³ØªÙ†Ø¯')
    }

    const parsedStartDate = normalizeDate(startDate)
    const parsedDeadline  = normalizeDate(deadline)

    if (startDate && !parsedStartDate) {
      return res.status(400).send('ØªØ§Ø±ÛŒØ® Ø´Ø±ÙˆØ¹ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }
    if (deadline && !parsedDeadline) {
      return res.status(400).send('ØªØ§Ø±ÛŒØ® Ø¯Ø¯Ù„Ø§ÛŒÙ† Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }

    await Project.findByIdAndUpdate(req.params.id, {
      title: title.trim(),
      client,
      category,
      status,
      progress: normalizeProgress(progress),
      startDate: parsedStartDate,
      deadline: parsedDeadline,
      techStack: normalizeTechStack(techStack),
      description: description ? description.trim() : ''
    })

    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error('Project update error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± ÙˆÛŒØ±Ø§ÛŒØ´ Ù¾Ø±ÙˆÚ˜Ù‡')
  }
})

app.post('/sw-admin/projects/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù Ù¾Ø±ÙˆÚ˜Ù‡')
  }
})

app.post('/sw-admin/projects/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'review', 'done', 'hold', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'ÙˆØ¶Ø¹ÛŒØª Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'Ù¾Ø±ÙˆÚ˜Ù‡ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯' });
    }

    res.json({ success: true, status: project.status });
  } catch (err) {
    console.error('Project status error:', err);
    res.status(500).json({ success: false, message: 'Ø®Ø·Ø§ Ø¯Ø± ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª Ù¾Ø±ÙˆÚ˜Ù‡' });
  }
});
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” CLIENTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

app.get('/sw-admin/clients', requireAdminAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = 6
    const skip = (page - 1) * limit

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = ['active', 'inactive'].includes(req.query.status) ? req.query.status : 'all'

    const filter = {}
    if (status === 'active') filter.isActive = true
    if (status === 'inactive') filter.isActive = false
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ name: rx }, { company: rx }, { email: rx }, { phone: rx }]
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      clientsCount, activeClientsCount, newClientsThisWeekCount,
      filteredCount, clients, categories
    ] = await Promise.all([
      Client.countDocuments(),
      Client.countDocuments({ isActive: true }),
      Client.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      Client.countDocuments(filter),
      Client.find(filter)
        .populate('category', 'title slug icon color gradient')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.find({ type: 'service', isActive: true }).sort({ order: 1 }).lean()
    ])

    const clientsWithProjects = await Promise.all(
      clients.map(async (client) => {
        const projectsCount = await Project.countDocuments({ client: client._id })
        const lastProject = await Project.findOne({ client: client._id })
          .sort({ createdAt: -1 })
          .select('title')
          .lean()

        return { ...client, projectsCount, projectTitle: lastProject ? lastProject.title : '---' }
      })
    )

    const totalPages = Math.ceil(filteredCount / limit)

    res.render('admin/Clients', {
      clients: clientsWithProjects,
      categories,
      clientsCount,
      activeClientsCount,
      newClientsThisWeekCount,
      filteredCount,
      filters: { q, status },
      currentPage: page,
      totalPages,
      limit,
      startItem: filteredCount === 0 ? 0 : skip + 1,
      endItem: Math.min(skip + limit, filteredCount)
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù…Ø´ØªØ±ÛŒØ§Ù†')
  }
})







app.post('/sw-admin/clients' , requireAdminAuth , async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, avatar, category } = req.body

    if (!String(name || '').trim()) return res.status(400).send('نام مشتری الزامی است')

    await Client.create({
      name: String(name).trim(),
      company: String(company || '').trim(),
      email: String(email || '').trim() ? String(email).trim().toLowerCase() : undefined,
      phone: String(phone || '').trim(),
      address: String(address || '').trim(),
      notes: String(notes || '').trim(),
      avatar: avatar || undefined,
      category: category || null
    })

    res.redirect('/sw-admin/clients')
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù…Ø´ØªØ±ÛŒ')
  }
})



app.post('/sw-admin/clients/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/clients')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù Ù…Ø´ØªØ±ÛŒ')
  }
})

app.get('/sw-admin/clients/export' , requireAdminAuth , async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 })

    let csv = 'Ù†Ø§Ù…,Ø´Ø±Ú©Øª,Ø§ÛŒÙ…ÛŒÙ„,ØªÙ„ÙÙ†,Ø¢Ø¯Ø±Ø³,ÙˆØ¶Ø¹ÛŒØª\n'

    clients.forEach(client => {
      csv += `"${client.name || ''}","${client.company || ''}","${client.email || ''}","${client.phone || ''}","${client.address || ''}","${client.isActive ? 'ÙØ¹Ø§Ù„' : 'ØºÛŒØ±ÙØ¹Ø§Ù„'}"\n`
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv')

    res.send('\uFEFF' + csv) // Ø¨Ø±Ø§ÛŒ Ø¯Ø±Ø³Øª Ù†Ù…Ø§ÛŒØ´ ÙØ§Ø±Ø³ÛŒ Ø¯Ø± Excel
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø®Ø±ÙˆØ¬ÛŒ CSV')
  }
})

app.post('/sw-admin/clients/:id/update', requireAdminAuth, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, category, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.redirect('/sw-admin/clients?error=Ù†Ø§Ù… Ù…Ø´ØªØ±ÛŒ Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª');
    }

    const updateData = {
      name: name.trim(),
      company: company ? company.trim() : '',
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : '',
      category: category || null,
      isActive: isActive === 'on'
    };

    // Ø§ÛŒÙ…ÛŒÙ„ Ø®Ø§Ù„ÛŒ Ø±Ø§ Ø­Ø°Ù Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… ØªØ§ unique index Ø®Ø±Ø§Ø¨ Ù†Ø´ÙˆØ¯
    const mail = email ? email.trim().toLowerCase() : '';
    if (mail) updateData.email = mail;
    else updateData.$unset = { email: 1 };

    const client = await Client.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!client) {
      return res.redirect('/sw-admin/clients?error=Ù…Ø´ØªØ±ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯');
    }

    res.redirect('/sw-admin/clients?success=Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù…Ø´ØªØ±ÛŒ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯');
  } catch (err) {
    console.error('Edit client error:', err);

    if (err.code === 11000) {
      return res.redirect('/sw-admin/clients?error=Ø§ÛŒÙ† Ø§ÛŒÙ…ÛŒÙ„ Ù‚Ø¨Ù„Ø§Ù‹ Ø¨Ø±Ø§ÛŒ Ù…Ø´ØªØ±ÛŒ Ø¯ÛŒÚ¯Ø±ÛŒ Ø«Ø¨Øª Ø´Ø¯Ù‡');
    }

    res.redirect('/sw-admin/clients?error=Ø®Ø·Ø§ Ø¯Ø± Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù…Ø´ØªØ±ÛŒ');
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” TICKETS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/tickets', requireAdminAuth, async (req, res) => {
  try {
    const [tickets, clients] = await Promise.all([
      Ticket.find().populate('client', 'name').sort({ createdAt: -1 }),
      Client.find({ isActive: true }).select('name company').sort({ name: 1 }).lean()
    ])
    res.render('admin/Tickets', { tickets, clients })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ØªÛŒÚ©Øªâ€ŒÙ‡Ø§')
  }
})

const patchTicket = (field, allowed, errMsg) => async (req, res) => {
  const wantsJson = (req.get('Accept') || '').includes('application/json')
  try {
    const value = req.body[field]
    if (!allowed.includes(value)) {
      return wantsJson
        ? res.status(400).json({ success: false, message: 'Ù…Ù‚Ø¯Ø§Ø± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª' })
        : res.status(400).send('Ù…Ù‚Ø¯Ø§Ø± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { [field]: value }, { new: true })
    if (!ticket) {
      return wantsJson
        ? res.status(404).json({ success: false, message: 'ØªÛŒÚ©Øª Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯' })
        : res.status(404).send('ØªÛŒÚ©Øª Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯')
    }
    if (wantsJson) return res.json({ success: true, [field]: value })
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    console.error(err)
    wantsJson ? res.status(500).json({ success: false, message: errMsg }) : res.status(500).send(errMsg)
  }
}

app.post('/sw-admin/tickets/:id/status', requireAdminAuth, patchTicket('status', ['open', 'pending', 'closed'], 'Ø®Ø·Ø§ Ø¯Ø± ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª ØªÛŒÚ©Øª'))
app.post('/sw-admin/tickets/:id/priority', requireAdminAuth, patchTicket('priority', ['urgent', 'medium', 'low'], 'Ø®Ø·Ø§ Ø¯Ø± ØªØºÛŒÛŒØ± Ø§ÙˆÙ„ÙˆÛŒØª ØªÛŒÚ©Øª'))


app.post('/sw-admin/tickets/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''
    if (!body) return res.status(400).json({ success: false, message: 'Ù…ØªÙ† Ù¾Ø§Ø³Ø® Ù†Ù…ÛŒâ€ŒØªÙˆØ§Ù†Ø¯ Ø®Ø§Ù„ÛŒ Ø¨Ø§Ø´Ø¯' })

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ success: false, message: 'ØªÛŒÚ©Øª Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯' })

    ticket.messages.push({ sender: 'admin', body })
    if (ticket.status === 'open') ticket.status = 'pending'   // Ù¾Ø§Ø³Ø® Ø¯Ø§Ø¯Ù‡ Ø´Ø¯ = Ø¯Ø± Ø­Ø§Ù„ Ø¨Ø±Ø±Ø³ÛŒ
    await ticket.save()

    const msg = ticket.messages[ticket.messages.length - 1]
    res.json({
      success: true,
      status: ticket.status,
      message: { sender: msg.sender, body: msg.body, createdAt: msg.createdAt || new Date() }
    })
  } catch (err) {
    console.error('Ticket reply error:', err)
    res.status(500).json({ success: false, message: 'Ø®Ø·Ø§ Ø¯Ø± Ø§Ø±Ø³Ø§Ù„ Ù¾Ø§Ø³Ø®' })
  }
})
app.post('/sw-admin/tickets', requireAdminAuth, async (req, res) => {
  try {
    const { client, name, email, subject, body, department, priority } = req.body

    if (!subject || !subject.trim() || !body || !body.trim()) {
      return res.redirect('/sw-admin/tickets?error=Ù…ÙˆØ¶ÙˆØ¹ Ùˆ Ù…ØªÙ† ØªÛŒÚ©Øª Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª')
    }

    let requester = { requesterName: name, requesterEmail: email, requesterPhone: '' }
    let clientId = null

    if (client) {
      const c = await Client.findById(client).lean()
      if (c) {
        clientId = c._id
        requester = { requesterName: c.name, requesterEmail: c.email || '', requesterPhone: c.phone || '' }
      }
    }

    if (!requester.requesterName) {
      return res.redirect('/sw-admin/tickets?error=Ù…Ø´ØªØ±ÛŒ ÛŒØ§ Ù†Ø§Ù… Ø¯Ø±Ø®ÙˆØ§Ø³Øªâ€ŒØ¯Ù‡Ù†Ø¯Ù‡ Ø±Ø§ Ù…Ø´Ø®Øµ Ú©Ù†ÛŒØ¯')
    }

    const ticket = await Ticket.create({
      ...requester,
      client: clientId,
      subject: subject.trim(),
      department: department || 'general',
      priority: ['urgent', 'medium', 'low'].includes(priority) ? priority : 'medium',
      status: 'open',
      source: 'admin',
      messages: [{ sender: 'admin', body: body.trim() }]
    })

    await Activity.create({
      type: 'ticket_created',
      title: `ØªÛŒÚ©Øª Ø¬Ø¯ÛŒØ¯ Ø¨Ø±Ø§ÛŒ ${requester.requesterName}`,
      icon: 'bi-ticket-detailed-fill',
      colorVariant: 'warning'
    })

    res.redirect('/sw-admin/tickets?success=ØªÛŒÚ©Øª Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø§ÛŒØ¬Ø§Ø¯ Ø´Ø¯#' + ticket._id)
  } catch (err) {
    console.error('Ticket create error:', err)
    res.redirect('/sw-admin/tickets?error=Ø®Ø·Ø§ Ø¯Ø± Ø§ÛŒØ¬Ø§Ø¯ ØªÛŒÚ©Øª')
  }
})
app.post('/sw-admin/tickets/:id/delete', requireAdminAuth, async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù ØªÛŒÚ©Øª')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” INVOICES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/sw-admin/invoices/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const allowedStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'ÙˆØ¶Ø¹ÛŒØª ÙØ§Ú©ØªÙˆØ± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª' })
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Ø´Ù†Ø§Ø³Ù‡ ÙØ§Ú©ØªÙˆØ± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª' })
    }

    // Ø§Ù†ØªÙ‚Ø§Ù„â€ŒÙ‡Ø§ÛŒ Ù…Ø¬Ø§Ø² (Ø³Ù…Øª Ú†Ù¾ = ÙˆØ¶Ø¹ÛŒØª ÙØ¹Ù„ÛŒ)
    const flow = {
      draft: ['sent', 'cancelled'],
      sent: ['draft', 'paid', 'cancelled'],
      overdue: ['sent', 'paid', 'cancelled'],
      paid: ['sent'],
      cancelled: ['draft', 'sent']
    }

    const invoice = await Invoice.findById(id)
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'ÙØ§Ú©ØªÙˆØ± Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯' })
    }

    if (!(flow[invoice.status] || []).includes(status)) {
      return res.status(400).json({ success: false, message: 'Ø§ÛŒÙ† ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª Ù…Ø¬Ø§Ø² Ù†ÛŒØ³Øª' })
    }

    invoice.status = status
    if (status === 'paid') invoice.paidAt = new Date()
    await invoice.save()

    res.json({ success: true, status: invoice.status })
  } catch (err) {
    console.error('Invoice status error:', err)
    res.status(500).json({ success: false, message: 'Ø®Ø·Ø§ Ø¯Ø± ØªØºÛŒÛŒØ± ÙˆØ¶Ø¹ÛŒØª ÙØ§Ú©ØªÙˆØ±' })
  }
})

app.post('/sw-admin/invoices/:id/delete', requireAdminAuth, async (req, res) => {
  try {
    const invoice = await Invoice.findByIdAndDelete(req.params.id)
    if (!invoice) return res.status(404).send('Invoice not found')
    res.redirect('/sw-admin/invoices')
  } catch (err) {
    console.error('Invoice delete error:', err)
    res.status(500).send('خطا در حذف فاکتور')
  }
})

app.get('/sw-admin/invoices/export/pdf', requireAdminAuth, async (req, res) => {
  let browser

  try {
    const invoices = await Invoice.find()
      .populate('client', 'name company email phone')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .lean()

    const invoiceStats = {
      total: invoices.length,
      draft: invoices.filter(inv => inv.status === 'draft').length,
      sent: invoices.filter(inv => inv.status === 'sent').length,
      paid: invoices.filter(inv => inv.status === 'paid').length,
      overdue: invoices.filter(inv => inv.status === 'overdue').length,
      cancelled: invoices.filter(inv => inv.status === 'cancelled').length
    }

    const html = await ejs.renderFile(
      path.join(__dirname, 'views', 'admin', 'invoices-pdf.ejs'),
      {
        title: 'Ú¯Ø²Ø§Ø±Ø´ ÙØ§Ú©ØªÙˆØ±Ù‡Ø§',
        invoices,
        invoiceStats
      }
    )

    browser = await launchBrowser()

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '10mm',
        bottom: '14mm',
        left: '10mm'
      }
    })

    await browser.close()
    browser = null

    const fileName = `invoices-${Date.now()}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`)
    res.send(pdfBuffer)

  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {})
    }

    console.error('Invoices PDF export error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± ØªÙˆÙ„ÛŒØ¯ Ø®Ø±ÙˆØ¬ÛŒ PDF ÙØ§Ú©ØªÙˆØ±Ù‡Ø§')
  }
})

app.get('/sw-admin/invoices/:id/pdf', requireAdminAuth, async (req, res) => {
  let browser

  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('Ø´Ù†Ø§Ø³Ù‡ ÙØ§Ú©ØªÙˆØ± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }

    const invoice = await Invoice.findById(id)
      .populate('client')
      .populate('project')
      .lean()

    if (!invoice) {
      return res.status(404).send('ÙØ§Ú©ØªÙˆØ± Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯')
    }

    const escapeHtml = (value) => {
      return String(value ?? 'â€”')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
    }

    const formatMoney = (value) => {
      const num = Number(value) || 0
      return num.toLocaleString('fa-IR')
    }

    const formatDate = (date) => {
      if (!date) return 'â€”'

      const parsedDate = new Date(date)
      if (Number.isNaN(parsedDate.getTime())) return 'â€”'

      return parsedDate.toLocaleDateString('fa-IR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }

    const getClientName = (client) => {
      if (!client) return 'Ø¨Ø¯ÙˆÙ† Ù…Ø´ØªØ±ÛŒ'
      return escapeHtml(client.company || client.name || 'Ø¨Ø¯ÙˆÙ† Ù†Ø§Ù…')
    }

    const getProjectTitle = (project) => {
      if (!project) return 'Ø¨Ø¯ÙˆÙ† Ù¾Ø±ÙˆÚ˜Ù‡'
      return escapeHtml(project.title || 'Ø¨Ø¯ÙˆÙ† Ø¹Ù†ÙˆØ§Ù†')
    }

    const getStatusLabel = (status) => {
      const map = {
        draft: 'Ù¾ÛŒØ´â€ŒÙ†ÙˆÛŒØ³',
        sent: 'Ø§Ø±Ø³Ø§Ù„â€ŒØ´Ø¯Ù‡',
        paid: 'Ù¾Ø±Ø¯Ø§Ø®Øªâ€ŒØ´Ø¯Ù‡',
        overdue: 'Ù…Ø¹ÙˆÙ‚',
        cancelled: 'Ù„ØºÙˆØ´Ø¯Ù‡'
      }

      return map[status] || 'Ù†Ø§Ù…Ø´Ø®Øµ'
    }

    const buildItemsRows = (items) => {
      if (!Array.isArray(items) || !items.length) {
        return `
          <tr>
            <td>Ø®Ø¯Ù…Ø§Øª Ø§Ù†Ø¬Ø§Ù…â€ŒØ´Ø¯Ù‡</td>
            <td>Û±</td>
            <td>${formatMoney(invoice.total)} ØªÙˆÙ…Ø§Ù†</td>
          </tr>
        `
      }

      return items.map(item => {
        const qty = Number(item.quantity) || 1
        const lineTotal = Number(item.total) || (qty * (Number(item.unitPrice) || 0))

        return `
          <tr>
            <td>${escapeHtml(item.description || 'â€”')}</td>
            <td>${qty.toLocaleString('fa-IR')}</td>
            <td>${formatMoney(lineTotal)} ØªÙˆÙ…Ø§Ù†</td>
          </tr>
        `
      }).join('')
    }

    const html = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 32px;
            direction: rtl;
            font-family: Tahoma, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
          }

          .invoice-box {
            width: 100%;
            border: 1px solid #e2e8f0;
            border-radius: 18px;
            padding: 28px;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 20px;
            margin-bottom: 24px;
          }

          .brand h1 {
            margin: 0 0 8px;
            font-size: 26px;
            color: #2563eb;
          }

          .brand p {
            margin: 0;
            color: #64748b;
            font-size: 13px;
          }

          .invoice-meta {
            text-align: left;
            direction: rtl;
            font-size: 13px;
            line-height: 1.9;
          }

          .section {
            margin-bottom: 22px;
          }

          .section-title {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 10px;
            color: #334155;
          }

          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }

          .card {
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            padding: 14px;
            background: #f8fafc;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 8px 0;
            border-bottom: 1px dashed #cbd5e1;
            font-size: 13px;
          }

          .row:last-child {
            border-bottom: 0;
          }

          .label {
            color: #64748b;
          }

          .value {
            font-weight: 700;
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }

          th {
            background: #eff6ff;
            color: #1d4ed8;
            padding: 12px;
            font-size: 13px;
            text-align: right;
            border: 1px solid #dbeafe;
          }

          td {
            padding: 12px;
            font-size: 13px;
            border: 1px solid #e2e8f0;
          }

          .total-box {
            margin-top: 24px;
            margin-right: auto;
            width: 320px;
            border: 1px solid #dbeafe;
            border-radius: 14px;
            overflow: hidden;
          }

          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 14px 16px;
            background: #eff6ff;
            font-size: 15px;
            font-weight: 800;
            color: #1d4ed8;
          }

          .footer {
            margin-top: 36px;
            padding-top: 18px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 12px;
            text-align: center;
          }
        </style>
      </head>

      <body>
        <div class="invoice-box">
          <div class="header">
            <div class="brand">
              <h1>ÙØ§Ú©ØªÙˆØ±</h1>
              <p>Ø³ÛŒØ³ØªÙ… Ù…Ø¯ÛŒØ±ÛŒØª SoulWeb</p>
            </div>

            <div class="invoice-meta">
              <div><strong>Ø´Ù…Ø§Ø±Ù‡ ÙØ§Ú©ØªÙˆØ±:</strong> ${escapeHtml(invoice.invoiceNumber || 'â€”')}</div>
              <div><strong>ØªØ§Ø±ÛŒØ® ØµØ¯ÙˆØ±:</strong> ${formatDate(invoice.issueDate || invoice.createdAt)}</div>
              <div><strong>Ø³Ø±Ø±Ø³ÛŒØ¯:</strong> ${formatDate(invoice.dueDate)}</div>
              <div><strong>ÙˆØ¶Ø¹ÛŒØª:</strong> ${getStatusLabel(invoice.status)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Ø§Ø·Ù„Ø§Ø¹Ø§Øª ÙØ§Ú©ØªÙˆØ±</div>

            <div class="grid">
              <div class="card">
                <div class="row">
                  <span class="label">Ù…Ø´ØªØ±ÛŒ</span>
                  <span class="value">${getClientName(invoice.client)}</span>
                </div>

                <div class="row">
                  <span class="label">Ù¾Ø±ÙˆÚ˜Ù‡</span>
                  <span class="value">${getProjectTitle(invoice.project)}</span>
                </div>
              </div>

              <div class="card">
                <div class="row">
                  <span class="label">Ø´Ù…Ø§Ø±Ù‡</span>
                  <span class="value">${escapeHtml(invoice.invoiceNumber || 'â€”')}</span>
                </div>

                <div class="row">
                  <span class="label">Ù…Ø¨Ù„Øº Ú©Ù„</span>
                  <span class="value">${formatMoney(invoice.total)} ØªÙˆÙ…Ø§Ù†</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Ø¬Ø²Ø¦ÛŒØ§Øª</div>

            <table>
              <thead>
                <tr>
                  <th>Ø´Ø±Ø­</th>
                  <th>ØªØ¹Ø¯Ø§Ø¯</th>
                  <th>Ù…Ø¨Ù„Øº</th>
                </tr>
              </thead>

              <tbody>
                ${buildItemsRows(invoice.items)}
              </tbody>
            </table>
          </div>

          <div class="total-box">
            <div class="total-row">
              <span>Ø¬Ù…Ø¹ Ú©Ù„</span>
              <span>${formatMoney(invoice.total)} ØªÙˆÙ…Ø§Ù†</span>
            </div>
          </div>

          <div class="footer">
            Ø§ÛŒÙ† ÙØ§Ú©ØªÙˆØ± Ø¨Ù‡â€ŒØµÙˆØ±Øª Ø³ÛŒØ³ØªÙ…ÛŒ ØªÙˆÙ„ÛŒØ¯ Ø´Ø¯Ù‡ Ø§Ø³Øª.
          </div>
        </div>
      </body>
      </html>
    `

    browser = await launchBrowser()

    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle0'
    })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '14mm',
        right: '14mm',
        bottom: '14mm',
        left: '14mm'
      }
    })

    await browser.close()
    browser = null

    const fileName = `invoice-${invoice.invoiceNumber || invoice._id}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    return res.send(pdfBuffer)
  } catch (err) {
    if (browser) {
      await browser.close().catch(() => {})
    }

    console.error('Invoice PDF Error:', err)
    return res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø³Ø§Ø®Øª PDF ÙØ§Ú©ØªÙˆØ±')
  }
})

app.get('/sw-admin/invoices', requireAdminAuth, async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('client', 'name company email phone')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .lean()

    const clients = await Client.find({ isActive: true })
      .select('name company email')
      .sort({ createdAt: -1 })
      .lean()

    const sumInvoicesByStatus = (status) => {
      return invoices
        .filter(inv => inv.status === status)
        .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)
    }

    const invoiceStats = {
      total: invoices.length,

      draft: invoices.filter(inv => inv.status === 'draft').length,
      sent: invoices.filter(inv => inv.status === 'sent').length,
      paid: invoices.filter(inv => inv.status === 'paid').length,
      overdue: invoices.filter(inv => inv.status === 'overdue').length,
      cancelled: invoices.filter(inv => inv.status === 'cancelled').length,

      paidAmount: sumInvoicesByStatus('paid'),
      sentAmount: sumInvoicesByStatus('sent'),
      overdueAmount: sumInvoicesByStatus('overdue')
    }

    res.render('admin/Invoices', {
      layout: 'layouts/sw-admin',
      title: 'Ù…Ø¯ÛŒØ±ÛŒØª ÙØ§Ú©ØªÙˆØ±Ù‡Ø§',
      invoices,
      clients,
      invoiceStats
    })
  } catch (err) {
    console.error('Invoices page error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª ÙØ§Ú©ØªÙˆØ±Ù‡Ø§')
  }
})




app.get('/sw-admin/clients/:clientId/projects' , requireAdminAuth , async (req, res) => {
  try {
    const { clientId } = req.params

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        message: 'Ø´Ù†Ø§Ø³Ù‡ Ù…Ø´ØªØ±ÛŒ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª'
      })
    }

    const projects = await Project.find({ client: clientId })
      .select('title status progress deadline')
      .sort({ createdAt: -1 })
      .lean()

    res.json(projects)

  } catch (err) {
    console.error('Client projects fetch error:', err)
    res.status(500).json({
      message: 'Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª Ù¾Ø±ÙˆÚ˜Ù‡â€ŒÙ‡Ø§ÛŒ Ù…Ø´ØªØ±ÛŒ'
    })
  }
})


app.post('/sw-admin/invoices/add' , requireAdminAuth , async (req, res) => {
  try {
    const {
      client,
      project,
      item_desc,
      item_qty,
      item_price,
      issue_date,
      due_date,
      note,
      status
    } = req.body

    if (!client) {
      return res.status(400).send('Ø§Ù†ØªØ®Ø§Ø¨ Ù…Ø´ØªØ±ÛŒ Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª')
    }

    if (!mongoose.Types.ObjectId.isValid(client)) {
      return res.status(400).send('Ø´Ù†Ø§Ø³Ù‡ Ù…Ø´ØªØ±ÛŒ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª')
    }

    if (project && !mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).send('Ø´Ù†Ø§Ø³Ù‡ Ù¾Ø±ÙˆÚ˜Ù‡ Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª')
    }

    const foundClient = await Client.findById(client).lean()

    if (!foundClient) {
      return res.status(404).send('Ù…Ø´ØªØ±ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯')
    }

    let foundProject = null

    if (project) {
      foundProject = await Project.findOne({
        _id: project,
        client
      }).lean()

      if (!foundProject) {
        return res.status(400).send('Ù¾Ø±ÙˆÚ˜Ù‡ Ø§Ù†ØªØ®Ø§Ø¨â€ŒØ´Ø¯Ù‡ Ù…ØªØ¹Ù„Ù‚ Ø¨Ù‡ Ø§ÛŒÙ† Ù…Ø´ØªØ±ÛŒ Ù†ÛŒØ³Øª')
      }
    }

    const normalizeArray = (value) => {
      if (Array.isArray(value)) return value
      if (value === undefined || value === null) return []
      return [value]
    }

    const descriptions = normalizeArray(item_desc)
    const quantities = normalizeArray(item_qty)
    const prices = normalizeArray(item_price)

    const parseMoney = (value) => {
      if (value === undefined || value === null) return 0

      const normalized = String(value)
        .replace(/[Û°-Û¹]/g, d => 'Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹'.indexOf(d))
        .replace(/[Ù -Ù©]/g, d => 'Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'.indexOf(d))
        .replace(/,/g, '')
        .replace(/ØŒ/g, '')
        .trim()

      const num = Number(normalized)

      return Number.isFinite(num) ? num : 0
    }

    const parseQuantity = (value) => {
      const num = parseMoney(value)
      return num > 0 ? num : 1
    }

    const items = descriptions
      .map((desc, index) => {
        const description = String(desc || '').trim()
        const quantity = parseQuantity(quantities[index])
        const unitPrice = parseMoney(prices[index])

        return {
          description,
          quantity,
          unitPrice
        }
      })
      .filter(item => item.description && item.unitPrice > 0)

    if (!items.length) {
      return res.status(400).send('Ø­Ø¯Ø§Ù‚Ù„ ÛŒÚ© Ø¢ÛŒØªÙ… Ù…Ø¹ØªØ¨Ø± Ø¨Ø±Ø§ÛŒ ÙØ§Ú©ØªÙˆØ± Ù„Ø§Ø²Ù… Ø§Ø³Øª')
    }

const moment = require('jalali-moment')

const toEnglishDigits = (str) => {
  if (!str) return str
  const persianDigits = 'Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹'
  const arabicDigits  = 'Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'
  return String(str)
    .replace(/[Û°-Û¹]/g, d => persianDigits.indexOf(d))
    .replace(/[Ù -Ù©]/g, d => arabicDigits.indexOf(d))
}

const normalizeDate = (value) => {
  if (!value) return null

  const cleaned = toEnglishDigits(value).trim()
  const parsed = moment(cleaned, 'jYYYY/jMM/jDD')

  if (!parsed.isValid()) return null

  return parsed.locale('en').toDate()
}

    const generateInvoiceNumber = async () => {
      const count = await Invoice.countDocuments()
      const nextNumber = count + 1001
      return `INV-${nextNumber}`
    }

    let invoiceNumber = await generateInvoiceNumber()

    let exists = await Invoice.exists({ invoiceNumber })

    while (exists) {
      invoiceNumber = `INV-${Date.now()}`
      exists = await Invoice.exists({ invoiceNumber })
    }

const parsedIssueDate = normalizeDate(issue_date)
const parsedDueDate   = normalizeDate(due_date)

if (issue_date && !parsedIssueDate) {
  return res.status(400).send('ØªØ§Ø±ÛŒØ® ØµØ¯ÙˆØ± Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
}
if (due_date && !parsedDueDate) {
  return res.status(400).send('ØªØ§Ø±ÛŒØ® Ø³Ø±Ø±Ø³ÛŒØ¯ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
}

await Invoice.create({
  invoiceNumber,
  client,
  project: project || null,
  items,
  issueDate: parsedIssueDate || new Date(),
  dueDate: parsedDueDate,
  notes: note ? String(note).trim() : '',
  status: ['draft', 'sent'].includes(status) ? status : 'sent',
  currency: 'IRR',
  createdBy: req.user?._id || undefined
})

    res.redirect('/sw-admin/invoices')

  } catch (err) {
    console.error('Invoice create error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª ÙØ§Ú©ØªÙˆØ±')
  }
})


// app.post('/sw-admin/invoices' , requireAdminAuth , async (req, res) => {
//   try {
//     // items Ø§Ø² ÙØ±Ù… Ø¨Ù‡ ØµÙˆØ±Øª JSON string Ù…ÛŒØ§Ø¯
//     const items = JSON.parse(req.body.items || '[]')
//     const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 })
//     const lastNum = lastInvoice
//       ? parseInt(lastInvoice.invoiceNumber.replace('INV-', '')) + 1
//       : 1001

//     await Invoice.create({
//       invoiceNumber: `INV-${lastNum}`,
//       client : req.body.client,
//       project: req.body.project || null,
//       items,
//       tax      : Number(req.body.tax)      || 0,
//       discount : Number(req.body.discount) || 0,
//       dueDate  : req.body.dueDate  || null,
//       notes    : req.body.notes    || '',
//       currency : req.body.currency || 'IRR',
//       createdBy: '000000000000000000000001'
//     })

//     res.redirect('/sw-admin/invoices')
//   } catch (err) {
//     console.error(err)
//     res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª ÙØ§Ú©ØªÙˆØ±')
//   }
// })

// app.post('/sw-admin/invoices/:id/paid' , requireAdminAuth , async (req, res) => {
//   try {
//     await Invoice.findByIdAndUpdate(req.params.id, {
//       status: 'paid',
//       paidAt: new Date()
//     })

//     const inv = await Invoice.findById(req.params.id)
//     await Activity.create({
//       type        : 'invoice_paid',
//       title       : `ÙØ§Ú©ØªÙˆØ± #${inv.invoiceNumber} Ù¾Ø±Ø¯Ø§Ø®Øª Ø´Ø¯`,
//       icon        : 'bi-receipt-cutoff',
//       colorVariant: 'success',
//       relatedModel: 'Invoice',
//       relatedId   : inv._id
//     })

//     res.redirect('/sw-admin/invoices')
//   } catch (err) {
//     res.status(500).send('Ø®Ø·Ø§')
//   }
// })

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PORTFOLIO ROUTES
//  Ø¯Ø± server.js Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ† Ø¨Ù„ÙˆÚ© Ù‚Ø¨Ù„ÛŒ portfolio Ø¨Ú©Ù†
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// GET â€” list
app.get('/sw-admin/portfolio' , requireAdminAuth , async (req, res) => {
  try {

    const [items, clients, categories, mediaItems] = await Promise.all([

      // Ù¾ÙˆØ±ØªÙÙˆÙ„ÛŒÙˆÙ‡Ø§
      Portfolio.find()
        .populate('client', 'name company')
        .populate('project', 'title')
        .sort({ order: 1, createdAt: -1 })
        .lean(),

      // Ù„ÛŒØ³Øª Ù…Ø´ØªØ±ÛŒâ€ŒÙ‡Ø§ Ø¨Ø±Ø§ÛŒ select
      Client.find({ isActive: true })
        .sort({ name: 1 })
        .lean(),

      // Ø¯Ø³ØªÙ‡â€ŒÙ‡Ø§ÛŒ Ù…Ø®ØµÙˆØµ Ù¾ÙˆØ±ØªÙÙˆÙ„ÛŒÙˆ
      Category.find({
        type: 'portfolio',
        isActive: true
      })
        .sort({ order: 1 })
        .lean(),
      Media.find().sort({ createdAt: -1 }).lean()
    ])

    res.render('admin/Portfolio', {
      items,
      clients,
      categories,
      mediaItems,
      flash: req.flash ? req.flash() : {}
    })

  } catch (err) {
    console.error('Portfolio Load Error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù¾ÙˆØ±ØªÙÙˆÙ„ÛŒÙˆ')
  }
})


// GET â€” ÙØ±Ù… ÙˆØ§Ø­Ø¯ Ø§ÙØ²ÙˆØ¯Ù†/ÙˆÛŒØ±Ø§ÛŒØ´ Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø±
// Ø§Ú¯Ø± ?id=... Ø§Ø±Ø³Ø§Ù„ Ø´ÙˆØ¯ ÛŒØ¹Ù†ÛŒ Ø­Ø§Ù„Øª ÙˆÛŒØ±Ø§ÛŒØ´ØŒ Ø¯Ø± ØºÛŒØ± Ø§ÛŒÙ†â€ŒØµÙˆØ±Øª Ø­Ø§Ù„Øª Ø§ÙØ²ÙˆØ¯Ù† Ø¬Ø¯ÛŒØ¯
app.get('/sw-admin/portfolio/form' , requireAdminAuth , async (req, res) => {
  try {

    const { id } = req.query

    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('Ø´Ù†Ø§Ø³Ù‡ Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø± Ù…Ø¹ØªØ¨Ø± Ù†ÛŒØ³Øª')
    }

    const [clients, categories, foundItem, mediaItems] = await Promise.all([

      // Ù„ÛŒØ³Øª Ù…Ø´ØªØ±ÛŒâ€ŒÙ‡Ø§ Ø¨Ø±Ø§ÛŒ select
      Client.find({ isActive: true })
        .sort({ name: 1 })
        .lean(),

      // Ø¯Ø³ØªÙ‡â€ŒÙ‡Ø§ÛŒ Ù…Ø®ØµÙˆØµ Ù¾ÙˆØ±ØªÙÙˆÙ„ÛŒÙˆ
      Category.find({
        type: 'portfolio',
        isActive: true
      })
        .sort({ order: 1 })
        .lean(),

      // Ø§Ú¯Ø± id Ø§Ø±Ø³Ø§Ù„ Ø´Ø¯Ù‡ Ø¨ÙˆØ¯ØŒ Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø± Ù…Ø±Ø¨ÙˆØ·Ù‡ Ø±Ø§ Ø¨Ø®ÙˆØ§Ù†Ø› ÙˆÚ¯Ø±Ù†Ù‡ null
      id
        ? Portfolio.findById(id)
            .populate('client', 'name company')
            .populate('project', 'title')
            .lean()
        : Promise.resolve(null),
      Media.find().sort({ createdAt: -1 }).lean()
    ])

    // Ø§Ú¯Ø± id Ø§Ø±Ø³Ø§Ù„ Ø´Ø¯Ù‡ Ø¨ÙˆØ¯ ÙˆÙ„ÛŒ Ø¢ÛŒØªÙ…ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯ â†’ Ø®Ø·Ø§ÛŒ Û´Û°Û´
    if (id && !foundItem) {
      return res.status(404).send('Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø± Ù…ÙˆØ±Ø¯ Ù†Ø¸Ø± Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯')
    }

    // Ø´ÛŒØ¡ Ù¾ÛŒØ´â€ŒÙØ±Ø¶/Ø®Ø§Ù„ÛŒ Ø¨Ø±Ø§ÛŒ Ø­Ø§Ù„Øª Â«Ø§ÙØ²ÙˆØ¯Ù† Ø¬Ø¯ÛŒØ¯Â» ØªØ§ EJS Ø¨Ø§ Ù…Ù‚Ø¯Ø§Ø± undefined Ø®Ø·Ø§ Ù†Ø¯Ù‡Ø¯
    const emptyItem = {
      _id            : null,
      title          : '',
      description    : '',
      coverImage     : '',
      category       : '',
      techStack      : [],
      liveUrl        : '',
      client         : null,
      isFeatured     : false,
      isPublished    : false,
      views          : 0,
      seoKeywords    : '',
      metaDescription: ''
    }

    res.render('admin/portfolio-form', {
      item     : foundItem || emptyItem,
      isEdit   : !!foundItem,
      clients,
      categories,
      mediaItems,
      flash    : req.flash ? req.flash() : {}
    })

  } catch (err) {
    console.error('Portfolio Form Page Error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙØ±Ù… Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø±')
  }
})


// POST â€” create new
app.post('/sw-admin/portfolio' , requireAdminAuth , upload.single('coverImage'), async (req, res) => {
  try {
    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish,
      seoKeywords, metaDescription
    } = req.body

    const coverImage = req.file ? `/uploads/portfolio/${req.file.filename}` : (req.body.coverImage || '')

    // techStack Ø§Ø² Ú†Ú©â€ŒØ¨Ø§Ú©Ø³â€ŒÙ‡Ø§ÛŒ name="techStack[]" Ø¨Ù‡ ØµÙˆØ±Øª Ø¢Ø±Ø§ÛŒÙ‡ Ø§Ø±Ø³Ø§Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯
    // Ø¨Ø±Ø§ÛŒ Ø³Ø§Ø²Ú¯Ø§Ø±ÛŒØŒ Ø­Ø§Ù„Øª Ø±Ø´ØªÙ‡ Ø¬Ø¯Ø§â€ŒØ´Ø¯Ù‡ Ø¨Ø§ Ú©Ø§Ù…Ø§ Ù†ÛŒØ² Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù…ÛŒâ€ŒØ´ÙˆØ¯
    const techStackArr = Array.isArray(techStack)
      ? techStack.map(t => t.trim()).filter(Boolean)
      : (techStack ? techStack.split(',').map(t => t.trim()).filter(Boolean) : [])

    await Portfolio.create({
      title          : (title || '').trim(),
      description    : description || '',
      coverImage     : coverImage,
      coverImageAlt  : req.body.coverImageAlt || '',
      category       : category || 'web',
      techStack      : techStackArr,
      liveUrl        : liveUrl || '',
      client         : client || null,
      isFeatured     : isFeatured === 'on',
      isPublished    : publish === '1',
      seoKeywords    : (seoKeywords || '').trim(),
      metaDescription: (metaDescription || '').trim(),
      order          : await Portfolio.countDocuments()
    })

    await Activity.create({
      type        : 'project_created',
      title       : `Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø± Â«${(title || '').trim()}Â» Ø¨Ù‡ Ù¾ÙˆØ±ØªÙÙˆÙ„ÛŒÙˆ Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯`,
      icon        : 'bi-collection-fill',
      colorVariant: 'accent'
    })

    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø±')
  }
})

app.post('/sw-admin/portfolio/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { isPublished } = req.body

    if (typeof isPublished !== 'boolean') {
      return res.status(400).json({ success: false, message: 'مقدار نامعتبر است' })
    }

    const item = await Portfolio.findByIdAndUpdate(req.params.id, { isPublished }, { new: true })

    if (!item) {
      return res.status(404).json({ success: false, message: 'نمونه کار پیدا نشد' })
    }

    res.json({ success: true, isPublished: item.isPublished })
  } catch (err) {
    console.error('Portfolio status error:', err)
    res.status(500).json({ success: false, message: 'خطا در تغییر وضعیت نمونه کار' })
  }
})

// POST â€” update existing
app.post('/sw-admin/portfolio/:id/update' , requireAdminAuth , upload.single('coverImage'), async (req, res) => {

  try {

    const portfolio = await Portfolio.findById(req.params.id)

    if(!portfolio){
      return res.status(404).send('Ù¾Ø±ÙˆÚ˜Ù‡ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯')
    }

    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish,
      seoKeywords, metaDescription
    } = req.body

    const coverImage = req.file
      ? '/uploads/portfolio/' + req.file.filename
      : portfolio.coverImage   // Ø§Ú¯Ø± Ø¹Ú©Ø³ Ø¬Ø¯ÛŒØ¯ Ù†Ø¨ÙˆØ¯ Ù‚Ø¨Ù„ÛŒ Ø¨Ù…Ø§Ù†Ø¯

    // techStack Ø§Ø² Ú†Ú©â€ŒØ¨Ø§Ú©Ø³â€ŒÙ‡Ø§ÛŒ name="techStack[]" Ø¨Ù‡ ØµÙˆØ±Øª Ø¢Ø±Ø§ÛŒÙ‡ Ø§Ø±Ø³Ø§Ù„ Ù…ÛŒâ€ŒØ´ÙˆØ¯
    // Ø¨Ø±Ø§ÛŒ Ø³Ø§Ø²Ú¯Ø§Ø±ÛŒØŒ Ø­Ø§Ù„Øª Ø±Ø´ØªÙ‡ Ø¬Ø¯Ø§â€ŒØ´Ø¯Ù‡ Ø¨Ø§ Ú©Ø§Ù…Ø§ Ù†ÛŒØ² Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù…ÛŒâ€ŒØ´ÙˆØ¯
    const techStackArr = Array.isArray(techStack)
      ? techStack.map(t => t.trim()).filter(Boolean)
      : (techStack ? techStack.split(',').map(t=>t.trim()).filter(Boolean) : [])

    portfolio.title = (title || '').trim()
    portfolio.description = description || ''
    portfolio.coverImage = coverImage
    portfolio.coverImageAlt = req.body.coverImageAlt || ''
    portfolio.category = category || 'web'
    portfolio.techStack = techStackArr
    portfolio.liveUrl = liveUrl || ''
    portfolio.client = client || null
    portfolio.isFeatured = isFeatured === 'on'
    portfolio.isPublished = publish === '1'
    portfolio.seoKeywords = (seoKeywords || '').trim()
    portfolio.metaDescription = (metaDescription || '').trim()

    await portfolio.save()

    res.redirect('/sw-admin/portfolio')

  } catch(err){
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± ÙˆÛŒØ±Ø§ÛŒØ´')
  }

})


// POST â€” publish (toggle draft â†’ published)
app.post('/sw-admin/portfolio/:id/publish' , requireAdminAuth ,  async (req, res) => {
  try {
    await Portfolio.findByIdAndUpdate(req.params.id, { isPublished: true })
    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø§Ù†ØªØ´Ø§Ø±')
  }
})

// POST â€” delete
app.post('/sw-admin/portfolio/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Portfolio.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø­Ø°Ù Ù†Ù…ÙˆÙ†Ù‡ Ú©Ø§Ø±')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” PACKAGES
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/packages' , requireAdminAuth , async (req, res) => {
  try {
    // Ù‡Ù…Ù‡ Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§ Ø±Ø§ Ø¨Ø± Ø§Ø³Ø§Ø³ ÙÛŒÙ„Ø¯ order Ù…Ø±ØªØ¨ Ù…ÛŒâ€ŒÚ©Ù†ÛŒÙ… (Ù…Ø«Ù„ ØªØ±ØªÛŒØ¨ Ù¾Ø§ÛŒÙ‡/Ø§Ù‚ØªØµØ§Ø¯ÛŒ/Ø­Ø±ÙÙ‡â€ŒØ§ÛŒ/Ø³Ø§Ø²Ù…Ø§Ù†ÛŒ)
    const packages = await Package.find().sort({ order: 1, createdAt: 1 });
 
    // ØªØ¹Ø¯Ø§Ø¯ Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§ÛŒ ÙØ¹Ø§Ù„
    const activeCount = packages.filter(p => p.isActive).length;
 
    // Ù¾Ø±ÙØ±ÙˆØ´â€ŒØªØ±ÛŒÙ† Ù¾Ú©ÛŒØ¬ (Ø¨Ø± Ø§Ø³Ø§Ø³ ÙÛŒÙ„Ø¯ sales)
    let bestSeller = null;
    if (packages.length > 0) {
      bestSeller = packages.reduce((max, p) => (p.sales > (max ? max.sales : -1) ? p : max), null);
    }
 
    // Ù…Ø¬Ù…ÙˆØ¹ Ø®Ø±ÛŒØ¯ Ø§ÛŒÙ† Ù…Ø§Ù‡ Ùˆ Ø¯Ø±Ø¢Ù…Ø¯ Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§ ÙØ¹Ù„Ø§Ù‹ Ú†ÙˆÙ† Ù…Ø¯Ù„ Ø³ÙØ§Ø±Ø´/Ø®Ø±ÛŒØ¯ Ø¬Ø¯Ø§Ú¯Ø§Ù†Ù‡â€ŒØ§ÛŒ Ù†Ø¯Ø§Ø±ÛŒÙ… ØµÙØ± Ø§Ø³Øª
    const monthlyPurchases = 0;
    const totalRevenue = 0;
 
    res.render('admin/Packages', {
      packages,
      stats: {
        activeCount,
        monthlyPurchases,
        bestSellerName: bestSeller ? bestSeller.name : 'â€”',
        totalRevenue
      }
    });
  } catch (err) {
    console.error('Ø®Ø·Ø§ Ø¯Ø± Ø¯Ø±ÛŒØ§ÙØª Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§:', err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ØµÙØ­Ù‡ Ù¾Ú©ÛŒØ¬â€ŒÙ‡Ø§');
  }
});

app.post('/sw-admin/packages' , requireAdminAuth , async (req, res) => {
  try {
    const { name, description, price, currency,
            duration, features, category, isFeatured } = req.body
    const slug = name
      .replace(/\s+/g, '-')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '')
      + '-' + Date.now()

    await Package.create({
      name, description, price: Number(price), currency, duration, slug,
      features   : features ? features.split('\n').map(f => f.trim()).filter(Boolean) : [],
      category   : category   || 'web',
      isFeatured : isFeatured === 'on'
    })
    res.redirect('/sw-admin/packages')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù¾Ú©ÛŒØ¬')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” REVIEWS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/reviews' , requireAdminAuth , async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('client',  'name')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
    res.render('admin/Reviews', { reviews })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ù†Ø¸Ø±Ø§Øª')
  }
})

app.post('/sw-admin/reviews/save', requireAdminAuth, async (req, res) => {
  try {
    const { id, name, company, text } = req.body
    const rating = Number(req.body.rating)
    if (!String(name || '').trim() || !String(text || '').trim() || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).send('نام، متن نظر و امتیاز معتبر لازم است')
    }
    let client = await Client.findOne({ name: String(name).trim(), company: String(company || '').trim() })
    if (!client) client = await Client.create({ name: String(name).trim(), company: String(company || '').trim() })
    const isPublished = req.body.isPublished === 'on'
    const values = { client: client._id, authorName: client.name, authorRole: String(company || '').trim(), text: String(text).trim(), rating, isApproved: isPublished, isPublished }
    if (id) {
      const review = await Review.findByIdAndUpdate(id, values, { new: true, runValidators: true })
      if (!review) return res.status(404).send('نظر پیدا نشد')
    } else {
      await Review.create(values)
    }
    res.redirect('/sw-admin/reviews')
  } catch (err) {
    console.error('Review save error:', err)
    res.status(500).send('خطا در ذخیره نظر')
  }
})
app.post('/sw-admin/reviews/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const update = {}
    if (typeof req.body.isApproved === 'boolean') update.isApproved = req.body.isApproved
    if (typeof req.body.isPublished === 'boolean') update.isPublished = req.body.isPublished

    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'مقدار نامعتبر است' })
    }

    // نظر تأییدنشده در سایت نمایش داده نمی‌شود
    if (update.isApproved === false) update.isPublished = false
    if (update.isPublished === true) update.isApproved = true

    const review = await Review.findByIdAndUpdate(req.params.id, update, { new: true })

    if (!review) {
      return res.status(404).json({ success: false, message: 'نظر پیدا نشد' })
    }

    res.json({ success: true, isApproved: review.isApproved, isPublished: review.isPublished })
  } catch (err) {
    console.error('Review status error:', err)
    res.status(500).json({ success: false, message: 'خطا در تغییر وضعیت نظر' })
  }
})


app.post('/sw-admin/reviews/:id/delete', requireAdminAuth, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/reviews')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” BLOG
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/blog' , requireAdminAuth , async (req, res) => {
  try {
    const posts = await BlogPost.find()
      .sort({ createdAt: -1 })
    res.render('admin/Blog', { posts })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙˆØ¨Ù„Ø§Ú¯')
  }
})

app.post('/sw-admin/blog/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body

    if (!['published', 'draft'].includes(status)) {
      return res.status(400).json({ success: false, message: 'وضعیت نامعتبر است' })
    }

    const post = await BlogPost.findById(req.params.id)
    if (!post) {
      return res.status(404).json({ success: false, message: 'مقاله پیدا نشد' })
    }

    post.status = status
    await post.save()

    res.json({ success: true, status: post.status })
  } catch (err) {
    console.error('Blog status error:', err)
    res.status(500).json({ success: false, message: 'خطا در تغییر وضعیت مقاله' })
  }
})

app.post('/sw-admin/blog/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/blog')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” TASKS (AJAX-friendly)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/tasks' , requireAdminAuth , async (req, res) => {
  try {
    const [tasks, projects] = await Promise.all([
      Task.find().populate('project', 'title').sort({ createdAt: -1 }),
      Project.find({ status: { $ne: 'cancelled' } }).select('title').sort({ createdAt: -1 }).lean()
    ])
    res.render('admin/Tasks', { tasks, projects })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§')
  }
})

app.post('/sw-admin/tasks', requireAdminAuth, async (req, res) => {
  const wantsJson = (req.get('Accept') || '').includes('application/json')

  try {
    const { title, priority, dueDate, project } = req.body

    if (!title || !title.trim()) {
      return wantsJson
        ? res.status(400).json({ success: false, message: 'عنوان وظیفه الزامی است' })
        : res.status(400).send('عنوان وظیفه الزامی است')
    }

    const task = await Task.create({
      title: title.trim(),
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      dueDate: dueDate || null,
      project: project || null,
      assignedTo: req.session.user.id,
      createdBy: req.session.user.id
    })

    if (wantsJson) {
      return res.json({
        success: true,
        task: {
          _id: task._id,
          title: task.title,
          priority: task.priority,
          dueDate: task.dueDate,
          isDone: false
        }
      })
    }

    res.redirect(req.get('Referer') || '/sw-admin/tasks')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª ÙˆØ¸ÛŒÙÙ‡')
  }
})

// toggle done â€” returns JSON for fetch calls from dashboard
app.post('/sw-admin/tasks/:id/toggle' , requireAdminAuth , async (req, res) => {
  try {
    const task   = await Task.findById(req.params.id)
    task.isDone  = !task.isDone
    task.doneAt  = task.isDone ? new Date() : null
    await task.save()
    res.json({ success: true, isDone: task.isDone })
  } catch (err) {
    res.status(500).json({ success: false })
  }
})

app.post('/sw-admin/tasks/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id)
    res.redirect(req.get('Referer') || '/sw-admin')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” REPORTS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/reports' , requireAdminAuth , async (req, res) => {
  try {
    const RANGES = {
      '6m':     { label: '۶ ماه اخیر', months: 6 },
      '12m':    { label: '۱۲ ماه اخیر', months: 12 },
      year:     { label: 'امسال', months: 12 },
      lastyear: { label: 'سال گذشته', months: 12 }
    }
    const range = RANGES[req.query.range] ? req.query.range : '6m'
    const { label: rangeLabel, months: n } = RANGES[range]

    // بازهٔ زمانی (ماه شمسی)
    const now = moment().locale('en')
    let start
    if (range === '6m' || range === '12m') start = now.clone().startOf('jMonth').subtract(n - 1, 'jMonth')
    else if (range === 'year') start = now.clone().startOf('jYear')
    else start = now.clone().subtract(1, 'jYear').startOf('jYear')

    const end = start.clone().add(n, 'jMonth').subtract(1, 'ms')
    const prevStart = start.clone().subtract(n, 'jMonth')
    const prevEnd = start.clone().subtract(1, 'ms')

    const s = start.toDate(), e = end.toDate(), ps = prevStart.toDate(), pe = prevEnd.toDate()
    const inRange = (d, a, b) => d && new Date(d) >= a && new Date(d) <= b

    // ماه‌های بازه برای محور نمودار
    const buckets = []
    for (let i = 0; i < n; i++) {
      const m = start.clone().add(i, 'jMonth')
      buckets.push({ key: m.format('jYYYY-jMM'), label: m.clone().locale('fa').format('jMMMM'), revenue: 0, projects: 0, done: 0, clients: 0 })
    }
    const bucketOf = (d) => buckets.find(b => b.key === moment(d).locale('en').format('jYYYY-jMM'))

    const [invoices, projects, clients, reviews] = await Promise.all([
      Invoice.find().select('total status issueDate createdAt paidAt client').lean(),
      Project.find().select('status createdAt updatedAt completedAt category client').populate('category', 'title').lean(),
      Client.find().select('name company isActive createdAt').lean(),
      Review.find({ isApproved: true }).select('rating').lean()
    ])

    const paidDate = (inv) => inv.paidAt || inv.issueDate || inv.createdAt
    const doneDate = (p) => p.completedAt || p.updatedAt || p.createdAt

    const paid = invoices.filter(inv => inv.status === 'paid')
    let revenue = 0, prevRevenue = 0
    paid.forEach(inv => {
      const d = paidDate(inv), t = Number(inv.total) || 0
      if (inRange(d, s, e)) { revenue += t; const b = bucketOf(d); if (b) b.revenue += t }
      else if (inRange(d, ps, pe)) prevRevenue += t
    })

    let done = 0, prevDone = 0
    projects.filter(p => p.status === 'done').forEach(p => {
      const d = doneDate(p)
      if (inRange(d, s, e)) { done++; const b = bucketOf(d); if (b) b.done++ }
      else if (inRange(d, ps, pe)) prevDone++
    })

    projects.forEach(p => {
      if (inRange(p.createdAt, s, e)) { const b = bucketOf(p.createdAt); if (b) b.projects++ }
    })

    let newClients = 0, prevNewClients = 0
    clients.forEach(c => {
      if (inRange(c.createdAt, s, e)) { newClients++; const b = bucketOf(c.createdAt); if (b) b.clients++ }
      else if (inRange(c.createdAt, ps, pe)) prevNewClients++
    })

    // درصد تغییر نسبت به بازهٔ قبل (اگر بازهٔ قبل صفر باشد null = نمایش داده نمی‌شود)
    const trend = (cur, prev) => prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null

    // میانگین امتیاز نظرات تأییدشده (اگر فیلد rating وجود نداشته باشد null می‌شود)
    const rated = reviews.filter(r => Number(r.rating) > 0)
    const ratingAvg = rated.length ? Math.round((rated.reduce((a, r) => a + Number(r.rating), 0) / rated.length) * 10) / 10 : null

    // پروژه‌های ثبت‌شده در بازه بر اساس نوع
    const typeMap = {}
    projects.filter(p => inRange(p.createdAt, s, e)).forEach(p => {
      const title = (p.category && p.category.title) || 'بدون نوع'
      typeMap[title] = (typeMap[title] || 0) + 1
    })
    const types = Object.keys(typeMap).map(title => ({ title, count: typeMap[title] })).sort((a, b) => b.count - a.count).slice(0, 6)

    // برترین مشتریان بر اساس درآمد فاکتورهای پرداخت‌شده در بازه
    const byClient = {}
    paid.filter(inv => inRange(paidDate(inv), s, e) && inv.client).forEach(inv => {
      const id = String(inv.client)
      byClient[id] = (byClient[id] || 0) + (Number(inv.total) || 0)
    })
    const projectCount = {}
    projects.forEach(p => { if (p.client) projectCount[String(p.client)] = (projectCount[String(p.client)] || 0) + 1 })
    const clientById = {}
    clients.forEach(c => { clientById[String(c._id)] = c })
    const topClients = Object.keys(byClient)
      .map(id => ({
        name: clientById[id] ? (clientById[id].company || clientById[id].name) : 'مشتری حذف‌شده',
        projects: projectCount[id] || 0,
        revenue: byClient[id]
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // وضعیت فاکتورهای صادرشده در بازه
    const invoiceStatus = { paid: 0, sent: 0, overdue: 0, draft: 0, cancelled: 0 }
    invoices.filter(inv => inRange(inv.issueDate || inv.createdAt, s, e)).forEach(inv => {
      if (invoiceStatus[inv.status] !== undefined) invoiceStatus[inv.status]++
    })

    res.render('admin/Reports', {
      range,
      rangeLabel,
      months: buckets.map(b => b.label),
      series: {
        revenue : buckets.map(b => b.revenue),
        projects: buckets.map(b => b.projects),
        done    : buckets.map(b => b.done),
        clients : buckets.map(b => b.clients)
      },
      kpi: {
        revenue   : { value: revenue, trend: trend(revenue, prevRevenue) },
        done      : { value: done, trend: trend(done, prevDone) },
        newClients: { value: newClients, trend: trend(newClients, prevNewClients), active: clients.filter(c => c.isActive).length },
        rating    : { avg: ratingAvg, count: rated.length }
      },
      types,
      topClients,
      invoiceStatus
    })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ Ú¯Ø²Ø§Ø±Ø´â€ŒÙ‡Ø§')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  ADMIN â€” SETTINGS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/settings' , requireAdminAuth , async (req, res) => {
  try {
    const setting = (await Setting.findOne()) || (await Setting.create({}))

    const [me, users] = await Promise.all([
      User.findById(req.session.user.id).select('name email role').lean(),
      User.find().select('name email role isActive createdAt').sort({ createdAt: 1 }).lean()
    ])

    res.render('admin/Settings', { setting, me, users })
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ØªÙ†Ø¸ÛŒÙ…Ø§Øª')
  }
})

app.post('/sw-admin/settings/profile', requireAdminAuth, async (req, res) => {
  try {
    const { name, email } = req.body

    if (!name || !name.trim() || !email || !email.trim()) {
      return res.redirect('/sw-admin/settings?tab=account&error=نام و ایمیل الزامی است')
    }

    const user = await User.findById(req.session.user.id)
    if (!user) return res.redirect('/sw-admin/login')

    user.name = name.trim()
    user.email = email.trim().toLowerCase()
    await user.save()

    // نام و ایمیل داخل session هم به‌روز شود
    req.session.user.name = user.name
    req.session.user.email = user.email

    res.redirect('/sw-admin/settings?tab=account&success=پروفایل با موفقیت به‌روزرسانی شد')
  } catch (err) {
    console.error('Profile update error:', err)

    if (err.code === 11000) {
      return res.redirect('/sw-admin/settings?tab=account&error=این ایمیل برای کاربر دیگری ثبت شده است')
    }

    res.redirect('/sw-admin/settings?tab=account&error=خطا در به‌روزرسانی پروفایل')
  }
})

app.post('/sw-admin/settings/password', requireAdminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, message: 'اطلاعات ارسالی نامعتبر است' })
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد' })
    }

    const user = await User.findById(req.session.user.id).select('+password')

    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'رمز عبور فعلی اشتباه است' })
    }

    user.password = newPassword
    await user.save()

    res.json({ success: true })
  } catch (err) {
    console.error('Password change error:', err)
    res.status(500).json({ success: false, message: 'خطا در تغییر رمز عبور' })
  }
})

app.post('/sw-admin/settings' , requireAdminAuth , async (req, res) => {
  try {
    const { siteName, siteUrl, email, phone, address,
            'social.instagram': instagram,
            'social.telegram' : telegram,
            'social.linkedin' : linkedin,
            'social.github'   : github,
            'seo.metaTitle'   : metaTitle,
            'seo.metaDescription': metaDescription,
            'seo.keywords': keywords } = req.body

    await Setting.findOneAndUpdate(
      {},
      {
        siteName, siteUrl, email, phone, address,
        socialLinks: { instagram, telegram, linkedin, github },
        seo        : { metaTitle, metaDescription, keywords: String(keywords || '').split(/[,،]/).map(v => v.trim()).filter(Boolean) }
      },
      { upsert: true, new: true }
    )
    res.redirect('/sw-admin/settings')
  } catch (err) {
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø°Ø®ÛŒØ±Ù‡ ØªÙ†Ø¸ÛŒÙ…Ø§Øª')
  }
})

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  PUBLIC CONTACT FORM (from front-end site)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/contact' , async (req, res) => {
  try {
    const { name, email, phone, subject, body, department } = req.body
    await Ticket.create({
      requesterName : name,
      requesterEmail: email,
      requesterPhone: phone  || '',
      subject       : subject || 'Ø¨Ø¯ÙˆÙ† Ù…ÙˆØ¶ÙˆØ¹',
      department    : department || 'general',
      priority      : 'medium',
      status        : 'open',
      source        : 'contact_form',
      messages: [{
        sender : 'client',
        body
      }]
    })

    await Activity.create({
      type        : 'ticket_created',
      title       : `ØªÛŒÚ©Øª Ø¬Ø¯ÛŒØ¯ Ø§Ø² ${name}`,
      icon        : 'bi-ticket-detailed-fill',
      colorVariant: 'warning'
    })

    res.json({ success: true, message: 'ØªÛŒÚ©Øª Ø´Ù…Ø§ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø«Ø¨Øª Ø´Ø¯' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª ØªÛŒÚ©Øª' })
  }
})

app.post('/sw-admin/projects/add', requireAdminAuth, async (req, res) => {
  try {
    const {
      title,
      client,
      category,
      startDate,
      deadline,
      techStack,
      description,
      progress          // â† Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯
    } = req.body

    if (!title || !client || !category) {
      return res.status(400).send('Ù†Ø§Ù… Ù¾Ø±ÙˆÚ˜Ù‡ØŒ Ù…Ø´ØªØ±ÛŒ Ùˆ Ù†ÙˆØ¹ Ù¾Ø±ÙˆÚ˜Ù‡ Ø§Ù„Ø²Ø§Ù…ÛŒ Ù‡Ø³ØªÙ†Ø¯')
    }

    const toEnglishDigits = (str) => {
      if (!str) return str
      const persianDigits = 'Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹'
      const arabicDigits  = 'Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©'
      return String(str)
        .replace(/[Û°-Û¹]/g, d => persianDigits.indexOf(d))
        .replace(/[Ù -Ù©]/g, d => arabicDigits.indexOf(d))
    }

    const normalizeDate = (value) => {
      if (!value) return null

      const cleaned = toEnglishDigits(value).trim()
      const parsed = moment(cleaned, 'jYYYY/jMM/jDD')

      if (!parsed.isValid()) {
        return null
      }

      return parsed.locale('en').toDate()
    }

    const normalizeTechStack = (value) => {
      if (!value) return []

      if (Array.isArray(value)) {
        return value
          .map(item => String(item).trim())
          .filter(Boolean)
      }

      return String(value)
        .split(/[,ØŒÂ·|]/)
        .map(item => item.trim())
        .filter(Boolean)
    }

    const normalizeProgress = (value) => {
      const num = parseInt(toEnglishDigits(value), 10)

      if (Number.isNaN(num)) return 0

      return Math.max(0, Math.min(100, num))
    }

    const parsedStartDate = normalizeDate(startDate)
    const parsedDeadline  = normalizeDate(deadline)

    if (startDate && !parsedStartDate) {
      return res.status(400).send('ØªØ§Ø±ÛŒØ® Ø´Ø±ÙˆØ¹ Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }
    if (deadline && !parsedDeadline) {
      return res.status(400).send('ØªØ§Ø±ÛŒØ® Ø¯Ø¯Ù„Ø§ÛŒÙ† Ù†Ø§Ù…Ø¹ØªØ¨Ø± Ø§Ø³Øª')
    }

    await Project.create({
      title: title.trim(),
      client,
      category,
      startDate: parsedStartDate,
      deadline: parsedDeadline,
      techStack: normalizeTechStack(techStack),
      description: description ? description.trim() : '',
      status: 'active',
      progress: normalizeProgress(progress),   // â† Ø¯ÛŒÚ¯Ù‡ Ù‡Ø§Ø±Ø¯Ú©Ø¯ Ù†ÛŒØ³Øª
      createdBy: '000000000000000000000001'
    })

    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error('Project create error:', err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù¾Ø±ÙˆÚ˜Ù‡')
  }
})




// Ø®Ø±Ø¬ÛŒ Ø§Ú©Ø³Ù„ Ù¾Ø±ÙˆÚ˜Ù‡ Ù‡Ø§
app.get('/sw-admin/projects/export' , requireAdminAuth , async (req, res) => {
  try {

    const projects = await Project.find()
      .populate('client', 'name company')
      .populate('category', 'title')
      .sort({ createdAt: -1 })
      .lean()

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Projects')

    sheet.columns = [
      { header: 'Ù†Ø§Ù… Ù¾Ø±ÙˆÚ˜Ù‡', key: 'title', width: 30 },
      { header: 'Ù…Ø´ØªØ±ÛŒ', key: 'client', width: 25 },
      { header: 'Ù†ÙˆØ¹ Ù¾Ø±ÙˆÚ˜Ù‡', key: 'category', width: 25 },
      { header: 'ÙˆØ¶Ø¹ÛŒØª', key: 'status', width: 18 },
      { header: 'Ù¾ÛŒØ´Ø±ÙØª', key: 'progress', width: 12 },
      { header: 'Ø¯Ø¯Ù„Ø§ÛŒÙ†', key: 'deadline', width: 18 },
      { header: 'ØªÚ©Ù†ÙˆÙ„ÙˆÚ˜ÛŒ', key: 'tech', width: 35 }
    ]

    const statusMap = {
      active: 'Ø¯Ø± Ø­Ø§Ù„ Ø§Ù†Ø¬Ø§Ù…',
      review: 'Ø¯Ø± Ø±ÛŒÙˆÛŒÙˆ',
      done: 'ØªØ­ÙˆÛŒÙ„ Ø´Ø¯Ù‡',
      hold: 'Ù…ØªÙˆÙ‚Ù',
      cancelled: 'Ù„ØºÙˆ Ø´Ø¯Ù‡'
    }

    projects.forEach(p => {

      const clientName =
        p.client?.company ||
        p.client?.name ||
        'Ø¨Ø¯ÙˆÙ† Ù…Ø´ØªØ±ÛŒ'

      const categoryTitle =
        p.category?.title ||
        'Ø¨Ø¯ÙˆÙ† Ù†ÙˆØ¹'

      const tech =
        Array.isArray(p.techStack)
          ? p.techStack.join(' Â· ')
          : ''

      sheet.addRow({
        title: p.title || '',
        client: clientName,
        category: categoryTitle,
        status: statusMap[p.status] || '',
        progress: `${p.progress || 0}%`,
        deadline: p.deadline
          ? new Date(p.deadline).toLocaleDateString('fa-IR')
          : '',
        tech
      })

    })

    sheet.getRow(1).font = { bold: true }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=projects.xlsx'
    )

    await workbook.xlsx.write(res)

    res.end()

  } catch (err) {
    console.error(err)
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø®Ø±ÙˆØ¬ÛŒ Excel')
  }
})





app.post('/sw-admin/packages/save' , requireAdminAuth , async (req,res)=>{

try{

const {
  id,
  name,
  slug,
  description,
  price,
  duration,
  category,
  features,
  isFeatured
} = req.body


const featureList = (features || '')
  .split('\n')
  .map(f => f.trim())
  .filter(Boolean)


if(id){

  await Package.findByIdAndUpdate(id,{
    name,
    slug,
    description,
    price,
    duration,
    category,
    features: featureList,
    isFeatured: !!isFeatured
  })

}else{

  await Package.create({
    name,
    slug,
    description,
    price,
    duration,
    category,
    features: featureList,
    isFeatured: !!isFeatured
  })

}

res.redirect('/sw-admin/packages')

}catch(err){

console.error(err)
res.status(500).send('Package error')

}

})



app.post('/sw-admin/packages/:id/toggle', requireAdminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'شناسه نامعتبر است' })
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });
    pkg.isActive = typeof req.body.isActive === 'boolean' ? req.body.isActive : !pkg.isActive;
    await pkg.save();
    res.json({ success: true, isActive: pkg.isActive });
  } catch (err) {
    console.error('Package status error:', err);
    res.status(500).json({ success: false });
  }
});
app.post('/sw-admin/packages/:id/delete' , requireAdminAuth , async (req,res)=>{

try{

await Package.findByIdAndDelete(req.params.id)

res.redirect('/sw-admin/packages')

}catch(err){

console.error(err)
res.status(500).send('Delete error')

}

})

app.get('/sw-admin/login', async (req, res) => {
  if (req.session?.user) return res.redirect('/sw-admin');
  res.render('./admin/Login');
});

app.post('/sw-admin/login', async (req, res) => {
  const { email, password, remember } = req.body;

  try {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).render('admin/Login', {
        error: 'Ø§ÛŒÙ…ÛŒÙ„ Ùˆ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø§Ù„Ø²Ø§Ù…ÛŒ Ù‡Ø³ØªÙ†Ø¯',
        email: typeof email === 'string' ? email : ''
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    }).select('+password');

    if (!user) {
      return res.status(401).render('admin/Login', {
        error: 'Ø§ÛŒÙ…ÛŒÙ„ ÛŒØ§ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø§Ø´ØªØ¨Ø§Ù‡ Ø§Ø³Øª',
        email
      });
    }

    if (!user.isActive) {
      return res.status(403).render('admin/Login', {
        error: 'Ø­Ø³Ø§Ø¨ Ú©Ø§Ø±Ø¨Ø±ÛŒ Ø´Ù…Ø§ ØºÛŒØ±ÙØ¹Ø§Ù„ Ø´Ø¯Ù‡ Ø§Ø³Øª',
        email
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).render('admin/Login', {
        error: 'Ø§ÛŒÙ…ÛŒÙ„ ÛŒØ§ Ø±Ù…Ø² Ø¹Ø¨ÙˆØ± Ø§Ø´ØªØ¨Ø§Ù‡ Ø§Ø³Øª',
        email
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // Â«Ù…Ø±Ø§ Ø¨Ù‡ Ø®Ø§Ø·Ø± Ø¨Ø³Ù¾Ø§Ø±Â»: Û³Û° Ø±ÙˆØ²ØŒ ÙˆÚ¯Ø±Ù†Ù‡ Ù‡Ù…Ø§Ù† Û± Ø±ÙˆØ² Ù¾ÛŒØ´â€ŒÙØ±Ø¶
    if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

    res.redirect('/sw-admin');
  } catch (err) {
    console.error(err);
    res.status(500).render('admin/Login', {
      error: 'Ø®Ø·Ø§ Ø¯Ø± ÙˆØ±ÙˆØ¯ Ø¨Ù‡ Ù¾Ù†Ù„',
      email: typeof email === 'string' ? email : ''
    });
  }
});

app.post('/sw-admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/sw-admin/login');
  });
});

app.post('/sw-admin/categories/add', requireAdminAuth, async (req, res) => {
  try {

    const { title } = req.body

    if (!title) {
      return res.status(400).json({ error: 'Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª' })
    }

    const slug = title
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')

    const category = await Category.create({
      title: title.trim(),
      slug,
      type: 'service'
    })

    res.json({
      success: true,
      category
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: 'Ø®Ø·Ø§ Ø¯Ø± Ø³Ø§Ø®Øª Ø¯Ø³ØªÙ‡â€ŒØ¨Ù†Ø¯ÛŒ'
    })

  }
})










app.post('/sw-admin/service-categories/add', requireAdminAuth, async (req, res) => {
  try {
    const { title, type } = req.body   // â† type Ù‡Ù… Ø§Ø¶Ø§ÙÙ‡ Ø´Ø¯

    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, message: 'Ø¹Ù†ÙˆØ§Ù† Ø¯Ø³ØªÙ‡â€ŒØ¨Ù†Ø¯ÛŒ Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª' })
    }

    const categoryType = ['service', 'project', 'portfolio', 'blog'].includes(type) ? type : 'service'
    const cleanTitle = title.trim()
    const baseSlug = cleanTitle.toLowerCase().replace(/[^\u0600-\u06FFa-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category'
    const slug = baseSlug + '-' + Date.now().toString(36)
    const newCategory = await Category.create({ title: cleanTitle, slug, type: categoryType })

    res.json({
      ok: true,
      category: {
        _id: newCategory._id,
        title: newCategory.title,
        type: newCategory.type
      }
    })
  } catch (err) {
    console.error('Category create error:', err)
    res.status(500).json({ ok: false, message: 'Ø®Ø·Ø§ Ø¯Ø± Ø«Ø¨Øª Ù†ÙˆØ¹ Ù¾Ø±ÙˆÚ˜Ù‡' })
  }
})


// app.get('/sw-admin/blog-form' , async (req , res) => {
//   res.render('./admin/blog-form')
// })

app.get('/sw-admin/blog-form', requireAdminAuth, async (req, res) => {
  try {
    const authors = await User.find().select('name').lean()   // به‌جای BlogPost.distinct('author')
    const categoriesRaw = await BlogPost.distinct('category');
    const categories = categoriesRaw
      .filter(Boolean)
      .map(c => ({ slug: c, title: c })); // Ú†ÙˆÙ† ØªÙˆ schema category ÙÙ‚Ø· ÛŒÙ‡ Ø±Ø´ØªÙ‡â€ŒØ³Øª

    const mediaItems = await Media.find().sort({ createdAt: -1 }).lean()
    res.render('admin/blog-form', {
      isEdit: false,
      item: {},   // Ø¢Ø¨Ø¬Ú©Øª Ø®Ø§Ù„ÛŒ ØªØ§ item.title Ùˆ Ø¨Ù‚ÛŒÙ‡ Ø®Ø·Ø§ Ù†Ø¯Ù†
      authors,
      categories, mediaItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙØ±Ù… Ù…Ù‚Ø§Ù„Ù‡');
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// GET  ÙØ±Ù… ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ù‚Ø§Ù„Ù‡
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/sw-admin/blog-form/:id', requireAdminAuth, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id).lean();
    if (!post) return res.status(404).send('Ù…Ù‚Ø§Ù„Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯');

    const authors = await User.find().select('name').lean()   // به‌جای BlogPost.distinct('author')
    const categoriesRaw = await BlogPost.distinct('category');
    const categories = categoriesRaw

      .filter(Boolean)
      .map(c => ({ slug: c, title: c }));

    const mediaItems = await Media.find().sort({ createdAt: -1 }).lean()
    res.render('admin/blog-form', {
      isEdit: true,
      item: post,
      authors,
      categories, mediaItems
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ø§Ø±Ú¯Ø°Ø§Ø±ÛŒ ÙØ±Ù… ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ù‚Ø§Ù„Ù‡');
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST  Ø§ÛŒØ¬Ø§Ø¯ Ù…Ù‚Ø§Ù„Ù‡ Ø¬Ø¯ÛŒØ¯
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/sw-admin/blog', requireAdminAuth, blogUpload.single('coverImage'), async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, readTime, publish } = req.body;

    // Ú†Ú©â€ŒØ¨Ø§Ú©Ø³â€ŒÙ‡Ø§ÛŒ ØªÚ¯: Ø§Ú¯Ù‡ ÙÙ‚Ø· ÛŒÚ©ÛŒ Ø§Ù†ØªØ®Ø§Ø¨ Ø¨Ø´Ù‡ string Ù…ÛŒØ§Ø¯ Ù†Ù‡ Ø¢Ø±Ø§ÛŒÙ‡
    let tags = req.body['tags[]'] || req.body.tags || [];
    if (!Array.isArray(tags)) tags = [tags];

    const newPost = new BlogPost({
      title,
      slug,
      excerpt,
      body: content,              // ØªÙˆØ¬Ù‡: content ØªÙˆ ÙØ±Ù… â†’ body ØªÙˆ schema
      category,
      author,
      tags,
      readingTime: readTime ? parseInt(readTime, 10) : undefined,
      status: publish === '1' ? 'published' : 'draft',
      coverImage: req.file ? '/uploads/blog/' + req.file.filename : (req.body.coverImage || undefined),
      coverImageAlt: req.body.coverImageAlt || ''
    });

    await newPost.save();
    res.redirect('/sw-admin/blog');
  } catch (err) {
    console.error(err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø°Ø®ÛŒØ±Ù‡ Ù…Ù‚Ø§Ù„Ù‡');
  }
});



app.post('/clients/:id', requireAdminAuth, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.redirect('/sw-admin/clients?error=Ù†Ø§Ù… Ù…Ø´ØªØ±ÛŒ Ø§Ù„Ø²Ø§Ù…ÛŒ Ø§Ø³Øª');
    }

    const updateData = {
      name: name.trim(),
      company: company ? company.trim() : '',
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : ''
    };

    // Ø§Ú¯Ù‡ Ø§ÛŒÙ…ÛŒÙ„ Ø®Ø§Ù„ÛŒ ÙØ±Ø³ØªØ§Ø¯Ù‡ Ø¨Ø´Ù‡ØŒ Ø­Ø°ÙØ´ Ú©Ù† Ú©Ù‡ unique index Ø±Ùˆ Ø®Ø±Ø§Ø¨ Ù†Ú©Ù†Ù‡
    if (!updateData.email) {
      delete updateData.email;
      await Client.findByIdAndUpdate(req.params.id, { $unset: { email: 1 } });
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!client) {
      return res.redirect('/sw-admin/clients?error=Ù…Ø´ØªØ±ÛŒ Ù¾ÛŒØ¯Ø§ Ù†Ø´Ø¯');
    }

    res.redirect('/sw-admin/clients?success=Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù…Ø´ØªØ±ÛŒ Ø¨Ø§ Ù…ÙˆÙÙ‚ÛŒØª Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø´Ø¯');
  } catch (err) {
    console.error('Edit client error:', err);

    if (err.code === 11000) {
      return res.redirect('/sw-admin/clients?error=Ø§ÛŒÙ† Ø§ÛŒÙ…ÛŒÙ„ Ù‚Ø¨Ù„Ø§Ù‹ Ø¨Ø±Ø§ÛŒ Ù…Ø´ØªØ±ÛŒ Ø¯ÛŒÚ¯Ø±ÛŒ Ø«Ø¨Øª Ø´Ø¯Ù‡');
    }

    res.redirect('/sw-admin/clients?error=Ø®Ø·Ø§ Ø¯Ø± Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ø§Ø·Ù„Ø§Ø¹Ø§Øª Ù…Ø´ØªØ±ÛŒ');
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// POST  ÙˆÛŒØ±Ø§ÛŒØ´ Ù…Ù‚Ø§Ù„Ù‡
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/sw-admin/blog/:id/update', requireAdminAuth, blogUpload.single('coverImage'), async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, readTime, publish } = req.body;

    let tags = req.body['tags[]'] || req.body.tags || [];
    if (!Array.isArray(tags)) tags = [tags];

    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).send('Ù…Ù‚Ø§Ù„Ù‡ ÛŒØ§ÙØª Ù†Ø´Ø¯');

    post.title = title;
    post.slug = slug;
    post.excerpt = excerpt;
    post.body = content;
    post.category = category;
    post.author = author;
    post.tags = tags;
    post.readingTime = readTime ? parseInt(readTime, 10) : undefined;
    post.status = publish === '1' ? 'published' : 'draft';
    post.coverImageAlt = req.body.coverImageAlt || '';

    if (req.file) {
      post.coverImage = '/uploads/blog/' + req.file.filename;
    } else if (req.body.coverImage) {
      post.coverImage = req.body.coverImage;
    }
    post.coverImageAlt = req.body.coverImageAlt || '';

    await post.save(); // pre('save') hook Ø¨Ø±Ø§ÛŒ publishedAt Ù‡Ù…ÛŒÙ†Ø¬Ø§ ÙØ¹Ø§Ù„ Ù…ÛŒâ€ŒÙ…ÙˆÙ†Ù‡
    res.redirect('/sw-admin/blog');
  } catch (err) {
    console.error(err);
    res.status(500).send('Ø®Ø·Ø§ Ø¯Ø± Ø¨Ù‡â€ŒØ±ÙˆØ²Ø±Ø³Ø§Ù†ÛŒ Ù…Ù‚Ø§Ù„Ù‡');
  }
});


//Ù„ÙˆØ¯ Ú©Ø±Ø¯Ù† ØµÙØ­Ø§Øª Ø§Ø³ØªØ§ØªÛŒÚ© Ø³Ø§ÛŒØª


app.get('/services', async (req, res) => {
    res.render('services', { siteSetting: await Setting.findOne().lean() });
});

app.get('/portfolio', (req, res) => {
    res.render('portfolio'); 
});

app.get('/packages', (req, res) => {
    res.render('packages');
});

app.get('/about', async (req, res) => {
    res.render('about', { siteSetting: await Setting.findOne().lean() });
});

app.get('/contact', async (req, res) => {
    res.render('contact', { siteSetting: await Setting.findOne().lean() });
});
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  404
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).render('404')
})
