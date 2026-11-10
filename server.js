const express    = require('express')
const mongoose   = require('mongoose')
const bcrypt     = require('bcryptjs')
const path       = require('path')
const multer     = require('multer')
const ExcelJS    = require('exceljs')
const puppeteer  = require('puppeteer-core')
const ejs        = require('ejs')
const session    = require('express-session');
const moment     = require('jalali-moment');
const methodOverride = require('method-override');
// require('dotenv').config();

const app = express()

// ─────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────
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
    secure: false, // اگر https داشتی true کن
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
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits  = '٠١٢٣٤٥٦٧٨٩'
  return String(str)
    .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
    .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
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
  return String(value).split(/[,،·|]/).map(item => item.trim()).filter(Boolean)
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

// ─────────────────────────────────────────
//  MODELS
// ─────────────────────────────────────────
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


// ─────────────────────────────────────────
// ADMIN LOCALS — اطلاعات مشترک هدر و سایدبار
// ─────────────────────────────────────────

app.use('/sw-admin', async (req, res, next) => {
    const admin = req.session?.user;

    if (!admin) return next();

    try {
        const name = String(admin.name || 'مدیر').trim();
        const words = name.split(/\s+/).filter(Boolean);

        res.locals.adminUser = {
            name: name,
            role: admin.role || 'مدیر',
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


// ─────────────────────────────────────────
// ADMIN — LIVE NOTIFICATIONS API
// ─────────────────────────────────────────

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
                title: t.subject || 'تیکت جدید',
                body: t.requesterName
                    ? `از طرف ${t.requesterName}`
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

// ─────────────────────────────────────────
//  DB + SERVER START
// ─────────────────────────────────────────
const DB_URL = 'mongodb://admin:pM8U6IsnbQBsnGspAg1f@soulwebdb-ttk-service:27017/admin'
// const DB_URL = 'mongodb://localhost:27017/SoulWeb'
const PORT   = 3000

mongoose.connect(DB_URL)
  .then(() => {
    console.log('DB is connected ✅')
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} 🚀`)
    })
  })
  .catch(err => {
    console.error('DB connection failed ❌', err.message)
    process.exit(1)
  })



// ─────────────────────────────────────────
//  MULTER CODE
// ─────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/portfolio')
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + path.extname(file.originalname)
    cb(null, uniqueName)
  }
})

const upload = multer({ storage })

// ─────────────────────────────────────────
//  PUBLIC ROUTES
// ─────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    const [portfolio, packages] = await Promise.all([
      Portfolio.find().sort({ order: 1 }),
      Package.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    ]);

    res.render('index', {
      portfolio,
      packages
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});



// ─────────────────────────────────────────
//  ADMIN — DASHBOARD
// ─────────────────────────────────────────
app.get('/sw-admin', requireAdminAuth, async (req, res) => {
  try {
    const now = new Date();

    // شروع هفته
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    // شروع بازه ۶ ماهه نمودار
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
      chartProjects
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
        .lean()
    ]);

    // آمار اصلی داشبورد
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

    // کارت های کوچک
    const minis = {
      paidAmount: 0,
      pendingCount: 0,
      pendingAmount: 0,
      ratingAvg: 0,
      ratingCount: 0
    };

    // نمودار ۶ ماه اخیر
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

    // فعالیت های اخیر
    const recentActivities = (recentActivitiesData || []).map(activity => ({
      ...activity,
      title: activity.title || 'فعالیت جدید',
      icon: activity.icon || 'bi-lightning-charge-fill',
      colorVariant: activity.colorVariant || 'accent',
      createdAt: activity.createdAt || now
    }));

    // پروژه های اخیر با ساختار مورد نیاز EJS
    const statusLabels = {
      active: { label: 'در حال انجام', cls: 'active' },
      review: { label: 'در حال بررسی', cls: 'warning' },
      done: { label: 'تکمیل شده', cls: 'success' },
      pending: { label: 'در انتظار', cls: 'secondary' },
      cancelled: { label: 'لغو شده', cls: 'danger' }
    };

    const projects = (projectsData || []).map(project => {
      const status = statusLabels[project.status] || {
        label: project.status || 'نامشخص',
        cls: 'secondary'
      };

      const progress = Math.min(
        100,
        Math.max(0, Number(project.progress) || 0)
      );

      const deadline = project.deadline
        ? new Date(project.deadline).toLocaleDateString('fa-IR')
        : '—';

      return {
        name: project.name || project.title || 'بدون عنوان',
        type: project.type || '',
        client:
          project.client?.name ||
          project.client?.company ||
          'بدون مشتری',
        cat:
          project.category?.title ||
          project.category ||
          '—',
        cls: status.cls,
        label: status.label,
        prog: progress,
        urgent: project.deadline
          ? new Date(project.deadline) < now && project.status !== 'done'
          : false,
        deadline
      };
    });

    // تیکت های اخیر با ساختار مورد نیاز EJS
    const tickets = (ticketsData || []).map((ticket, index) => {
      const ticketName =
        ticket.name ||
        ticket.user?.name ||
        ticket.client?.name ||
        ticket.sender?.name ||
        'کاربر';

      const initials = String(ticketName)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0] || '')
        .join('');

      return {
        name: ticketName,
        initials: initials || '؟',
        preview:
          ticket.subject ||
          ticket.title ||
          ticket.message ||
          ticket.description ||
          'تیکت جدید',
        time: ticket.createdAt || now,
        unread: ticket.isRead === false || ticket.unread === true,
        v: (index % 5) + 1
      };
    });

    // وظایف
    const todayTasks = (todayTasksData || []).map(task => ({
      _id: task._id,
      title: task.title || 'بدون عنوان',
      isDone: Boolean(task.isDone),
      priority: ['high', 'medium', 'low'].includes(task.priority)
        ? task.priority
        : 'medium'
    }));

    // تاریخ امروز
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
    res.status(500).send('خطا در بارگذاری داشبورد');
  }
});

// ─────────────────────────────────────────
//  ADMIN — PROJECTS
// ─────────────────────────────────────────
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
  { key: 'todo', title: 'در انتظار' },
  { key: 'inprogress', title: 'در حال انجام' },
  { key: 'review', title: 'در حال بررسی' },
  { key: 'done', title: 'انجام‌شده' }
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
    res.status(500).send('خطا در بارگذاری پروژه‌ها')
  }
})



// app.post('/sw-admin/projects', async (req, res) => {
//   try {
//     const { title, description, client, type, techStack,
//             status, progress, deadline, price, tags } = req.body

//     // createdBy: در پروژه واقعی از session میاد — فعلا placeholder
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

//     // ثبت فعالیت
//     await Activity.create({
//       type        : 'project_created',
//       title       : `پروژه جدید «${title}» ثبت شد`,
//       icon        : 'bi-file-earmark-plus-fill',
//       colorVariant: 'main'
//     })

//     res.redirect('/sw-admin/projects')
//   } catch (err) {
//     console.error(err)
//     res.status(500).send('خطا در ثبت پروژه')
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
      return res.status(400).send('نام پروژه، مشتری و نوع پروژه الزامی هستند')
    }

    const parsedStartDate = normalizeDate(startDate)
    const parsedDeadline  = normalizeDate(deadline)

    if (startDate && !parsedStartDate) {
      return res.status(400).send('تاریخ شروع نامعتبر است')
    }
    if (deadline && !parsedDeadline) {
      return res.status(400).send('تاریخ ددلاین نامعتبر است')
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
    res.status(500).send('خطا در ویرایش پروژه')
  }
})

app.post('/sw-admin/projects/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در حذف پروژه')
  }
})

app.post('/sw-admin/projects/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['active', 'review', 'done', 'hold', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'وضعیت نامعتبر است' });
    }

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!project) {
      return res.status(404).json({ success: false, message: 'پروژه پیدا نشد' });
    }

    res.json({ success: true, status: project.status });
  } catch (err) {
    console.error('Project status error:', err);
    res.status(500).json({ success: false, message: 'خطا در تغییر وضعیت پروژه' });
  }
});
// ─────────────────────────────────────────
//  ADMIN — CLIENTS
// ─────────────────────────────────────────

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
    res.status(500).send('خطا در بارگذاری مشتریان')
  }
})







app.post('/sw-admin/clients' , requireAdminAuth , async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, avatar, category } = req.body

    await Client.create({
      name,
      company,
      email,
      phone,
      address,
      notes,
      avatar,
      category: category || null
    })

    res.redirect('/sw-admin/clients')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در ثبت مشتری')
  }
})



app.post('/sw-admin/clients/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/clients')
  } catch (err) {
    res.status(500).send('خطا در حذف مشتری')
  }
})

app.get('/sw-admin/clients/export' , requireAdminAuth , async (req, res) => {
  try {
    const clients = await Client.find().sort({ createdAt: -1 })

    let csv = 'نام,شرکت,ایمیل,تلفن,آدرس,وضعیت\n'

    clients.forEach(client => {
      csv += `"${client.name || ''}","${client.company || ''}","${client.email || ''}","${client.phone || ''}","${client.address || ''}","${client.isActive ? 'فعال' : 'غیرفعال'}"\n`
    })

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv')

    res.send('\uFEFF' + csv) // برای درست نمایش فارسی در Excel
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در خروجی CSV')
  }
})

app.post('/sw-admin/clients/:id/update', requireAdminAuth, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes, category, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.redirect('/sw-admin/clients?error=نام مشتری الزامی است');
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

    // ایمیل خالی را حذف می‌کنیم تا unique index خراب نشود
    const mail = email ? email.trim().toLowerCase() : '';
    if (mail) updateData.email = mail;
    else updateData.$unset = { email: 1 };

    const client = await Client.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    });

    if (!client) {
      return res.redirect('/sw-admin/clients?error=مشتری پیدا نشد');
    }

    res.redirect('/sw-admin/clients?success=اطلاعات مشتری با موفقیت به‌روزرسانی شد');
  } catch (err) {
    console.error('Edit client error:', err);

    if (err.code === 11000) {
      return res.redirect('/sw-admin/clients?error=این ایمیل قبلاً برای مشتری دیگری ثبت شده');
    }

    res.redirect('/sw-admin/clients?error=خطا در به‌روزرسانی اطلاعات مشتری');
  }
});

// ─────────────────────────────────────────
//  ADMIN — TICKETS
// ─────────────────────────────────────────
app.get('/sw-admin/tickets', requireAdminAuth, async (req, res) => {
  try {
    const [tickets, clients] = await Promise.all([
      Ticket.find().populate('client', 'name').sort({ createdAt: -1 }),
      Client.find({ isActive: true }).select('name company').sort({ name: 1 }).lean()
    ])
    res.render('admin/Tickets', { tickets, clients })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری تیکت‌ها')
  }
})

const patchTicket = (field, allowed, errMsg) => async (req, res) => {
  const wantsJson = (req.get('Accept') || '').includes('application/json')
  try {
    const value = req.body[field]
    if (!allowed.includes(value)) {
      return wantsJson
        ? res.status(400).json({ success: false, message: 'مقدار نامعتبر است' })
        : res.status(400).send('مقدار نامعتبر است')
    }
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, { [field]: value }, { new: true })
    if (!ticket) {
      return wantsJson
        ? res.status(404).json({ success: false, message: 'تیکت پیدا نشد' })
        : res.status(404).send('تیکت پیدا نشد')
    }
    if (wantsJson) return res.json({ success: true, [field]: value })
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    console.error(err)
    wantsJson ? res.status(500).json({ success: false, message: errMsg }) : res.status(500).send(errMsg)
  }
}

app.post('/sw-admin/tickets/:id/status', requireAdminAuth, patchTicket('status', ['open', 'pending', 'closed'], 'خطا در تغییر وضعیت تیکت'))
app.post('/sw-admin/tickets/:id/priority', requireAdminAuth, patchTicket('priority', ['urgent', 'medium', 'low'], 'خطا در تغییر اولویت تیکت'))


app.post('/sw-admin/tickets/:id/reply', requireAdminAuth, async (req, res) => {
  try {
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''
    if (!body) return res.status(400).json({ success: false, message: 'متن پاسخ نمی‌تواند خالی باشد' })

    const ticket = await Ticket.findById(req.params.id)
    if (!ticket) return res.status(404).json({ success: false, message: 'تیکت پیدا نشد' })

    ticket.messages.push({ sender: 'admin', body })
    if (ticket.status === 'open') ticket.status = 'pending'   // پاسخ داده شد = در حال بررسی
    await ticket.save()

    const msg = ticket.messages[ticket.messages.length - 1]
    res.json({
      success: true,
      status: ticket.status,
      message: { sender: msg.sender, body: msg.body, createdAt: msg.createdAt || new Date() }
    })
  } catch (err) {
    console.error('Ticket reply error:', err)
    res.status(500).json({ success: false, message: 'خطا در ارسال پاسخ' })
  }
})
app.post('/sw-admin/tickets', requireAdminAuth, async (req, res) => {
  try {
    const { client, name, email, subject, body, department, priority } = req.body

    if (!subject || !subject.trim() || !body || !body.trim()) {
      return res.redirect('/sw-admin/tickets?error=موضوع و متن تیکت الزامی است')
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
      return res.redirect('/sw-admin/tickets?error=مشتری یا نام درخواست‌دهنده را مشخص کنید')
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
      title: `تیکت جدید برای ${requester.requesterName}`,
      icon: 'bi-ticket-detailed-fill',
      colorVariant: 'warning'
    })

    res.redirect('/sw-admin/tickets?success=تیکت با موفقیت ایجاد شد#' + ticket._id)
  } catch (err) {
    console.error('Ticket create error:', err)
    res.redirect('/sw-admin/tickets?error=خطا در ایجاد تیکت')
  }
})
app.post('/sw-admin/tickets/:id/delete', requireAdminAuth, async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    res.status(500).send('خطا در حذف تیکت')
  }
})

// ─────────────────────────────────────────
//  ADMIN — INVOICES
// ─────────────────────────────────────────
app.post('/sw-admin/invoices/:id/delete', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('شناسه فاکتور نامعتبر است')
    }

    const deletedInvoice = await Invoice.findByIdAndDelete(id)

    if (!deletedInvoice) {
      return res.status(404).send('فاکتور پیدا نشد')
    }

    res.redirect('/sw-admin/invoices')

  } catch (err) {
    console.error('Invoice delete error:', err)
    res.status(500).send('خطا در حذف فاکتور')
  }
})



app.post('/sw-admin/invoices/:id/publish', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('شناسه فاکتور نامعتبر است')
    }

    const invoice = await Invoice.findById(id)

    if (!invoice) {
      return res.status(404).send('فاکتور پیدا نشد')
    }

    if (invoice.status !== 'draft') {
      return res.status(400).send('این فاکتور در وضعیت پیش‌نویس نیست')
    }

    invoice.status = 'sent'
    await invoice.save()

    res.redirect('/sw-admin/invoices')

  } catch (err) {
    console.error('Invoice publish error:', err)
    res.status(500).send('خطا در انتشار فاکتور')
  }
})




app.get('/sw-admin/invoices/export/pdf' , requireAdminAuth , async (req, res) => {
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
        title: 'گزارش فاکتورها',
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
      await browser.close()
    }

    console.error('Invoices PDF export error:', err)
    res.status(500).send('خطا در تولید خروجی PDF فاکتورها')
  }
})

app.get('/sw-admin/invoices/:id/pdf' , requireAdminAuth , async (req, res) => {
  let browser

  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('شناسه فاکتور نامعتبر است')
    }

    const invoice = await Invoice.findById(id)
      .populate('client')
      .populate('project')
      .lean()

    if (!invoice) {
      return res.status(404).send('فاکتور پیدا نشد')
    }

    const formatMoney = (value) => {
      const num = Number(value) || 0
      return num.toLocaleString('fa-IR')
    }

    const formatDate = (date) => {
      if (!date) return '—'

      try {
        return new Date(date).toLocaleDateString('fa-IR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        })
      } catch (err) {
        return '—'
      }
    }

    const getClientName = (client) => {
      if (!client) return 'بدون مشتری'
      return client.company || client.name || 'بدون نام'
    }

    const getProjectTitle = (project) => {
      if (!project) return 'بدون پروژه'
      return project.title || 'بدون عنوان'
    }

    const getStatusLabel = (status) => {
      const map = {
        draft: 'پیش‌نویس',
        sent: 'ارسال‌شده',
        paid: 'پرداخت‌شده',
        overdue: 'معوق',
        cancelled: 'لغوشده'
      }

      return map[status] || 'نامشخص'
    }
const buildItemsRows = (items) => {
  if (!Array.isArray(items) || !items.length) {
    return `
      <tr>
        <td>خدمات انجام‌شده</td>
        <td>۱</td>
        <td>${formatMoney(invoice.total)} تومان</td>
      </tr>
    `
  }

  return items.map(item => {
    const qty = Number(item.quantity) || 1
    const lineTotal = Number(item.total) || (qty * (Number(item.unitPrice) || 0))

    return `
      <tr>
        <td>${item.description || '—'}</td>
        <td>${qty.toLocaleString('fa-IR')}</td>
        <td>${formatMoney(lineTotal)} تومان</td>
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
              <h1>فاکتور</h1>
              <p>سیستم مدیریت SoulWeb</p>
            </div>

            <div class="invoice-meta">
              <div><strong>شماره فاکتور:</strong> ${invoice.invoiceNumber || '—'}</div>
              <div><strong>تاریخ صدور:</strong> ${formatDate(invoice.issueDate || invoice.createdAt)}</div>
              <div><strong>سررسید:</strong> ${formatDate(invoice.dueDate)}</div>
              <div><strong>وضعیت:</strong> ${getStatusLabel(invoice.status)}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">اطلاعات فاکتور</div>

            <div class="grid">
              <div class="card">
                <div class="row">
                  <span class="label">مشتری</span>
                  <span class="value">${getClientName(invoice.client)}</span>
                </div>

                <div class="row">
                  <span class="label">پروژه</span>
                  <span class="value">${getProjectTitle(invoice.project)}</span>
                </div>
              </div>

              <div class="card">
                <div class="row">
                  <span class="label">شماره</span>
                  <span class="value">${invoice.invoiceNumber || '—'}</span>
                </div>

                <div class="row">
                  <span class="label">مبلغ کل</span>
                  <span class="value">${formatMoney(invoice.total)} تومان</span>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">جزئیات</div>

            <table>
              <thead>
                <tr>
                  <th>شرح</th>
                  <th>تعداد</th>
                  <th>مبلغ</th>
                </tr>
              </thead>

              <tbody>
                ${buildItemsRows(invoice.items)}
              </tbody>
            </table>
          </div>

          <div class="total-box">
            <div class="total-row">
              <span>جمع کل</span>
              <span>${formatMoney(invoice.total)} تومان</span>
            </div>
          </div>

          <div class="footer">
            این فاکتور به‌صورت سیستمی تولید شده است.
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

    const fileName = `invoice-${invoice.invoiceNumber || invoice._id}.pdf`

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Length', pdfBuffer.length)

    return res.send(pdfBuffer)
  } catch (err) {
    if (browser) {
      await browser.close()
    }

    console.error('Invoice PDF Error:', err)
    return res.status(500).send('خطا در ساخت PDF فاکتور')
  }
})



app.get('/sw-admin/invoices' , requireAdminAuth , async (req, res) => {
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

    res.render('admin/invoices', {
      layout: 'layouts/sw-admin',
      title: 'مدیریت فاکتورها',
      invoices,
      clients,
      invoiceStats
    })
  } catch (err) {
    console.error('Invoices page error:', err)
    res.status(500).send('خطا در دریافت فاکتورها')
  }
})




app.get('/sw-admin/clients/:clientId/projects' , requireAdminAuth , async (req, res) => {
  try {
    const { clientId } = req.params

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({
        message: 'شناسه مشتری معتبر نیست'
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
      message: 'خطا در دریافت پروژه‌های مشتری'
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
      return res.status(400).send('انتخاب مشتری الزامی است')
    }

    if (!mongoose.Types.ObjectId.isValid(client)) {
      return res.status(400).send('شناسه مشتری معتبر نیست')
    }

    if (project && !mongoose.Types.ObjectId.isValid(project)) {
      return res.status(400).send('شناسه پروژه معتبر نیست')
    }

    const foundClient = await Client.findById(client).lean()

    if (!foundClient) {
      return res.status(404).send('مشتری پیدا نشد')
    }

    let foundProject = null

    if (project) {
      foundProject = await Project.findOne({
        _id: project,
        client
      }).lean()

      if (!foundProject) {
        return res.status(400).send('پروژه انتخاب‌شده متعلق به این مشتری نیست')
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
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
        .replace(/,/g, '')
        .replace(/،/g, '')
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
      return res.status(400).send('حداقل یک آیتم معتبر برای فاکتور لازم است')
    }

const moment = require('jalali-moment')

const toEnglishDigits = (str) => {
  if (!str) return str
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
  const arabicDigits  = '٠١٢٣٤٥٦٧٨٩'
  return String(str)
    .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
    .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
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
  return res.status(400).send('تاریخ صدور نامعتبر است')
}
if (due_date && !parsedDueDate) {
  return res.status(400).send('تاریخ سررسید نامعتبر است')
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
    res.status(500).send('خطا در ثبت فاکتور')
  }
})


// app.post('/sw-admin/invoices' , requireAdminAuth , async (req, res) => {
//   try {
//     // items از فرم به صورت JSON string میاد
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
//     res.status(500).send('خطا در ثبت فاکتور')
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
//       title       : `فاکتور #${inv.invoiceNumber} پرداخت شد`,
//       icon        : 'bi-receipt-cutoff',
//       colorVariant: 'success',
//       relatedModel: 'Invoice',
//       relatedId   : inv._id
//     })

//     res.redirect('/sw-admin/invoices')
//   } catch (err) {
//     res.status(500).send('خطا')
//   }
// })

// ─────────────────────────────────────────────────────────────
//  PORTFOLIO ROUTES
//  در server.js جایگزین بلوک قبلی portfolio بکن
// ─────────────────────────────────────────────────────────────

// GET — list
app.get('/sw-admin/portfolio' , requireAdminAuth , async (req, res) => {
  try {

    const [items, clients, categories] = await Promise.all([

      // پورتفولیوها
      Portfolio.find()
        .populate('client', 'name company')
        .populate('project', 'title')
        .populate('category', 'title slug')   // اگر category رفرنس است
        .sort({ order: 1, createdAt: -1 })
        .lean(),

      // لیست مشتری‌ها برای select
      Client.find({ isActive: true })
        .sort({ name: 1 })
        .lean(),

      // دسته‌های مخصوص پورتفولیو
      Category.find({
        type: 'portfolio',
        isActive: true
      })
        .sort({ order: 1 })
        .lean()
    ])

    res.render('admin/Portfolio', {
      items,
      clients,
      categories,
      flash: req.flash ? req.flash() : {}
    })

  } catch (err) {
    console.error('Portfolio Load Error:', err)
    res.status(500).send('خطا در بارگذاری پورتفولیو')
  }
})


// GET — فرم واحد افزودن/ویرایش نمونه کار
// اگر ?id=... ارسال شود یعنی حالت ویرایش، در غیر این‌صورت حالت افزودن جدید
app.get('/sw-admin/portfolio/form' , requireAdminAuth , async (req, res) => {
  try {

    const { id } = req.query

    if (id && !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).send('شناسه نمونه کار معتبر نیست')
    }

    const [clients, categories, foundItem] = await Promise.all([

      // لیست مشتری‌ها برای select
      Client.find({ isActive: true })
        .sort({ name: 1 })
        .lean(),

      // دسته‌های مخصوص پورتفولیو
      Category.find({
        type: 'portfolio',
        isActive: true
      })
        .sort({ order: 1 })
        .lean(),

      // اگر id ارسال شده بود، نمونه کار مربوطه را بخوان؛ وگرنه null
      id
        ? Portfolio.findById(id)
            .populate('client', 'name company')
            .populate('project', 'title')
            .populate('category', 'title slug')
            .lean()
        : Promise.resolve(null)
    ])

    // اگر id ارسال شده بود ولی آیتمی پیدا نشد → خطای ۴۰۴
    if (id && !foundItem) {
      return res.status(404).send('نمونه کار مورد نظر پیدا نشد')
    }

    // شیء پیش‌فرض/خالی برای حالت «افزودن جدید» تا EJS با مقدار undefined خطا ندهد
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
      flash    : req.flash ? req.flash() : {}
    })

  } catch (err) {
    console.error('Portfolio Form Page Error:', err)
    res.status(500).send('خطا در بارگذاری فرم نمونه کار')
  }
})


// POST — create new
app.post('/sw-admin/portfolio' , requireAdminAuth , upload.single('coverImage'), async (req, res) => {
  try {
    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish,
      seoKeywords, metaDescription
    } = req.body

    const coverImage = req.file ? `/uploads/portfolio/${req.file.filename}` : ''

    // techStack از چک‌باکس‌های name="techStack[]" به صورت آرایه ارسال می‌شود
    // برای سازگاری، حالت رشته جدا‌شده با کاما نیز پشتیبانی می‌شود
    const techStackArr = Array.isArray(techStack)
      ? techStack.map(t => t.trim()).filter(Boolean)
      : (techStack ? techStack.split(',').map(t => t.trim()).filter(Boolean) : [])

    await Portfolio.create({
      title          : (title || '').trim(),
      description    : description || '',
      coverImage     : coverImage,
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
      title       : `نمونه کار «${(title || '').trim()}» به پورتفولیو اضافه شد`,
      icon        : 'bi-collection-fill',
      colorVariant: 'accent'
    })

    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در ثبت نمونه کار')
  }
})


// POST — update existing
app.post('/sw-admin/portfolio/:id/update' , requireAdminAuth , upload.single('coverImage'), async (req, res) => {

  try {

    const portfolio = await Portfolio.findById(req.params.id)

    if(!portfolio){
      return res.status(404).send('پروژه پیدا نشد')
    }

    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish,
      seoKeywords, metaDescription
    } = req.body

    const coverImage = req.file
      ? '/uploads/portfolio/' + req.file.filename
      : portfolio.coverImage   // اگر عکس جدید نبود قبلی بماند

    // techStack از چک‌باکس‌های name="techStack[]" به صورت آرایه ارسال می‌شود
    // برای سازگاری، حالت رشته جدا‌شده با کاما نیز پشتیبانی می‌شود
    const techStackArr = Array.isArray(techStack)
      ? techStack.map(t => t.trim()).filter(Boolean)
      : (techStack ? techStack.split(',').map(t=>t.trim()).filter(Boolean) : [])

    portfolio.title = (title || '').trim()
    portfolio.description = description || ''
    portfolio.coverImage = coverImage
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
    res.status(500).send('خطا در ویرایش')
  }

})


// POST — publish (toggle draft → published)
app.post('/sw-admin/portfolio/:id/publish' , requireAdminAuth ,  async (req, res) => {
  try {
    await Portfolio.findByIdAndUpdate(req.params.id, { isPublished: true })
    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در انتشار')
  }
})

// POST — delete
app.post('/sw-admin/portfolio/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await Portfolio.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در حذف نمونه کار')
  }
})

// ─────────────────────────────────────────
//  ADMIN — PACKAGES
// ─────────────────────────────────────────
app.get('/sw-admin/packages' , requireAdminAuth , async (req, res) => {
  try {
    // همه پکیج‌ها را بر اساس فیلد order مرتب می‌کنیم (مثل ترتیب پایه/اقتصادی/حرفه‌ای/سازمانی)
    const packages = await Package.find().sort({ order: 1, createdAt: 1 });
 
    // تعداد پکیج‌های فعال
    const activeCount = packages.filter(p => p.isActive).length;
 
    // پرفروش‌ترین پکیج (بر اساس فیلد sales)
    let bestSeller = null;
    if (packages.length > 0) {
      bestSeller = packages.reduce((max, p) => (p.sales > (max ? max.sales : -1) ? p : max), null);
    }
 
    // مجموع خرید این ماه و درآمد پکیج‌ها فعلاً چون مدل سفارش/خرید جداگانه‌ای نداریم صفر است
    const monthlyPurchases = 0;
    const totalRevenue = 0;
 
    res.render('admin/packages', {
      packages,
      stats: {
        activeCount,
        monthlyPurchases,
        bestSellerName: bestSeller ? bestSeller.name : '—',
        totalRevenue
      }
    });
  } catch (err) {
    console.error('خطا در دریافت پکیج‌ها:', err);
    res.status(500).send('خطا در بارگذاری صفحه پکیج‌ها');
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
    res.status(500).send('خطا در ثبت پکیج')
  }
})

// ─────────────────────────────────────────
//  ADMIN — REVIEWS
// ─────────────────────────────────────────
app.get('/sw-admin/reviews' , requireAdminAuth , async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('client',  'name')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
    res.render('admin/Reviews', { reviews })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری نظرات')
  }
})

app.post('/sw-admin/reviews/:id/approve', requireAdminAuth , async (req, res) => {
  try {
    await Review.findByIdAndUpdate(req.params.id, {
      isApproved : true,
      isPublished: true
    })
    res.redirect('/sw-admin/reviews')
  } catch (err) {
    res.status(500).send('خطا')
  }
})

// ─────────────────────────────────────────
//  ADMIN — BLOG
// ─────────────────────────────────────────
app.get('/sw-admin/blog' , requireAdminAuth , async (req, res) => {
  try {
    const posts = await BlogPost.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 })
    res.render('admin/Blog', { posts })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری وبلاگ')
  }
})

app.post('/sw-admin/blog' , requireAdminAuth , async (req, res) => {
  try {
    const { title, excerpt, body, tags, category, status, coverImage } = req.body
    const slug = title
      .replace(/\s+/g, '-')
      .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '')
      + '-' + Date.now()

    const wordsPerMinute = 200
    const wordCount      = body.split(/\s+/).length
    const readingTime    = Math.ceil(wordCount / wordsPerMinute)

    await BlogPost.create({
      title, slug, excerpt, body, coverImage,
      tags        : tags ? tags.split(',').map(t => t.trim()) : [],
      category    : category    || '',
      status      : status      || 'draft',
      readingTime,
      author      : '000000000000000000000001'
    })
    res.redirect('/sw-admin/blog')
  } catch (err) {
    res.status(500).send('خطا در ثبت پست')
  }
})

app.post('/sw-admin/blog/:id/delete' , requireAdminAuth , async (req, res) => {
  try {
    await BlogPost.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/blog')
  } catch (err) {
    res.status(500).send('خطا')
  }
})

// ─────────────────────────────────────────
//  ADMIN — TASKS (AJAX-friendly)
// ─────────────────────────────────────────
app.get('/sw-admin/tasks' , requireAdminAuth , async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('project', 'title')
      .sort({ createdAt: -1 })
    res.render('admin/Tasks', { tasks })
  } catch (err) {
    res.status(500).send('خطا')
  }
})

app.post('/sw-admin/tasks' , requireAdminAuth , async (req, res) => {
  try {
    const { title, priority, dueDate, project } = req.body
    await Task.create({
      title,
      priority  : priority || 'medium',
      dueDate   : dueDate  || null,
      project   : project  || null,
      assignedTo: '000000000000000000000001',
      createdBy : '000000000000000000000001'
    })
    res.redirect(req.get('Referer') || '/sw-admin')
  } catch (err) {
    res.status(500).send('خطا در ثبت وظیفه')
  }
})

// toggle done — returns JSON for fetch calls from dashboard
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
    res.status(500).send('خطا')
  }
})

// ─────────────────────────────────────────
//  ADMIN — REPORTS
// ─────────────────────────────────────────
app.get('/sw-admin/reports' , requireAdminAuth , async (req, res) => {
  try {
    const [totalProjects, totalClients, totalInvoices,
           paidInvoices, totalReviews] = await Promise.all([
      Project.countDocuments(),
      Client.countDocuments(),
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: 'paid' }),
      Review.countDocuments({ isApproved: true })
    ])

    const revenueResult = await Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ])
    const totalRevenue = revenueResult[0]?.total || 0

    res.render('admin/Reports', {
      stats: {
        totalProjects, totalClients,
        totalInvoices, paidInvoices,
        totalReviews,  totalRevenue
      }
    })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری گزارش‌ها')
  }
})

// ─────────────────────────────────────────
//  ADMIN — SETTINGS
// ─────────────────────────────────────────
app.get('/sw-admin/settings' , requireAdminAuth , async (req, res) => {
  try {
    // getOrCreate the singleton
    let setting = await Setting.findOne()
    if (!setting) setting = await Setting.create({})
    res.render('admin/Settings', { setting })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری تنظیمات')
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
            'seo.metaDescription': metaDescription } = req.body

    await Setting.findOneAndUpdate(
      {},
      {
        siteName, siteUrl, email, phone, address,
        socialLinks: { instagram, telegram, linkedin, github },
        seo        : { metaTitle, metaDescription }
      },
      { upsert: true, new: true }
    )
    res.redirect('/sw-admin/settings')
  } catch (err) {
    res.status(500).send('خطا در ذخیره تنظیمات')
  }
})

// ─────────────────────────────────────────
//  PUBLIC CONTACT FORM (from front-end site)
// ─────────────────────────────────────────
app.post('/contact' , requireAdminAuth , async (req, res) => {
  try {
    const { name, email, phone, subject, body, department } = req.body
    await Ticket.create({
      requesterName : name,
      requesterEmail: email,
      requesterPhone: phone  || '',
      subject       : subject || 'بدون موضوع',
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
      title       : `تیکت جدید از ${name}`,
      icon        : 'bi-ticket-detailed-fill',
      colorVariant: 'warning'
    })

    res.json({ success: true, message: 'تیکت شما با موفقیت ثبت شد' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در ثبت تیکت' })
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
      progress          // ← اضافه شد
    } = req.body

    if (!title || !client || !category) {
      return res.status(400).send('نام پروژه، مشتری و نوع پروژه الزامی هستند')
    }

    const toEnglishDigits = (str) => {
      if (!str) return str
      const persianDigits = '۰۱۲۳۴۵۶۷۸۹'
      const arabicDigits  = '٠١٢٣٤٥٦٧٨٩'
      return String(str)
        .replace(/[۰-۹]/g, d => persianDigits.indexOf(d))
        .replace(/[٠-٩]/g, d => arabicDigits.indexOf(d))
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
        .split(/[,،·|]/)
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
      return res.status(400).send('تاریخ شروع نامعتبر است')
    }
    if (deadline && !parsedDeadline) {
      return res.status(400).send('تاریخ ددلاین نامعتبر است')
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
      progress: normalizeProgress(progress),   // ← دیگه هاردکد نیست
      createdBy: '000000000000000000000001'
    })

    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error('Project create error:', err)
    res.status(500).send('خطا در ثبت پروژه')
  }
})




// خرجی اکسل پروژه ها
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
      { header: 'نام پروژه', key: 'title', width: 30 },
      { header: 'مشتری', key: 'client', width: 25 },
      { header: 'نوع پروژه', key: 'category', width: 25 },
      { header: 'وضعیت', key: 'status', width: 18 },
      { header: 'پیشرفت', key: 'progress', width: 12 },
      { header: 'ددلاین', key: 'deadline', width: 18 },
      { header: 'تکنولوژی', key: 'tech', width: 35 }
    ]

    const statusMap = {
      active: 'در حال انجام',
      review: 'در ریویو',
      done: 'تحویل شده',
      hold: 'متوقف',
      cancelled: 'لغو شده'
    }

    projects.forEach(p => {

      const clientName =
        p.client?.company ||
        p.client?.name ||
        'بدون مشتری'

      const categoryTitle =
        p.category?.title ||
        'بدون نوع'

      const tech =
        Array.isArray(p.techStack)
          ? p.techStack.join(' · ')
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
    res.status(500).send('خطا در خروجی Excel')
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
        error: 'ایمیل و رمز عبور الزامی هستند',
        email: typeof email === 'string' ? email : ''
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    }).select('+password');

    if (!user) {
      return res.status(401).render('admin/Login', {
        error: 'ایمیل یا رمز عبور اشتباه است',
        email
      });
    }

    if (!user.isActive) {
      return res.status(403).render('admin/Login', {
        error: 'حساب کاربری شما غیرفعال شده است',
        email
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).render('admin/Login', {
        error: 'ایمیل یا رمز عبور اشتباه است',
        email
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    // «مرا به خاطر بسپار»: ۳۰ روز، وگرنه همان ۱ روز پیش‌فرض
    if (remember) req.session.cookie.maxAge = 1000 * 60 * 60 * 24 * 30;

    res.redirect('/sw-admin');
  } catch (err) {
    console.error(err);
    res.status(500).render('admin/Login', {
      error: 'خطا در ورود به پنل',
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
      return res.status(400).json({ error: 'عنوان الزامی است' })
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
      error: 'خطا در ساخت دسته‌بندی'
    })

  }
})










app.post('/sw-admin/service-categories/add', requireAdminAuth, async (req, res) => {
  try {
    const { title, type } = req.body   // ← type هم اضافه شد

    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, message: 'عنوان دسته‌بندی الزامی است' })
    }

    const newCategory = await Category.create({
      title: title.trim(),
      type: type || 'service'   // ← اگه فرستاده نشد، مقدار پیش‌فرض service
    })

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
    res.status(500).json({ ok: false, message: 'خطا در ثبت نوع پروژه' })
  }
})


// app.get('/sw-admin/blog-form' , async (req , res) => {
//   res.render('./admin/blog-form')
// })

app.get('/sw-admin/blog-form', requireAdminAuth, async (req, res) => {
  try {
    const authors = await BlogPost.distinct('author');
    const categoriesRaw = await BlogPost.distinct('category');
    const categories = categoriesRaw
      .filter(Boolean)
      .map(c => ({ slug: c, title: c })); // چون تو schema category فقط یه رشته‌ست

    res.render('admin/blog-form', {
      isEdit: false,
      item: {},   // آبجکت خالی تا item.title و بقیه خطا ندن
      authors,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در بارگذاری فرم مقاله');
  }
});

// ─────────────────────────────────────
// GET  فرم ویرایش مقاله
// ─────────────────────────────────────
app.get('/sw-admin/blog-form/:id', requireAdminAuth, async (req, res) => {
  try {
    const post = await BlogPost.findById(req.params.id).lean();
    if (!post) return res.status(404).send('مقاله یافت نشد');

    const authors = await BlogPost.distinct('author');
    const categoriesRaw = await BlogPost.distinct('category');
    const categories = categoriesRaw
      .filter(Boolean)
      .map(c => ({ slug: c, title: c }));

    res.render('admin/blog-form', {
      isEdit: true,
      item: post,
      authors,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در بارگذاری فرم ویرایش مقاله');
  }
});

// ─────────────────────────────────────
// POST  ایجاد مقاله جدید
// ─────────────────────────────────────
app.post('/sw-admin/blog', requireAdminAuth, upload.single('coverImage'), async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, readTime, publish } = req.body;

    // چک‌باکس‌های تگ: اگه فقط یکی انتخاب بشه string میاد نه آرایه
    let tags = req.body['tags[]'] || req.body.tags || [];
    if (!Array.isArray(tags)) tags = [tags];

    const newPost = new BlogPost({
      title,
      slug,
      excerpt,
      body: content,              // توجه: content تو فرم → body تو schema
      category,
      author,
      tags,
      readingTime: readTime ? parseInt(readTime, 10) : undefined,
      status: publish === '1' ? 'published' : 'draft',
      coverImage: req.file ? '/uploads/' + req.file.filename : undefined
    });

    await newPost.save();
    res.redirect('/sw-admin/blog');
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در ذخیره مقاله');
  }
});



app.post('/clients/:id', async (req, res) => {
  try {
    const { name, company, email, phone, address, notes } = req.body;

    if (!name || !name.trim()) {
      return res.redirect('/sw-admin/clients?error=نام مشتری الزامی است');
    }

    const updateData = {
      name: name.trim(),
      company: company ? company.trim() : '',
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes: notes ? notes.trim() : ''
    };

    // اگه ایمیل خالی فرستاده بشه، حذفش کن که unique index رو خراب نکنه
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
      return res.redirect('/sw-admin/clients?error=مشتری پیدا نشد');
    }

    res.redirect('/sw-admin/clients?success=اطلاعات مشتری با موفقیت به‌روزرسانی شد');
  } catch (err) {
    console.error('Edit client error:', err);

    if (err.code === 11000) {
      return res.redirect('/sw-admin/clients?error=این ایمیل قبلاً برای مشتری دیگری ثبت شده');
    }

    res.redirect('/sw-admin/clients?error=خطا در به‌روزرسانی اطلاعات مشتری');
  }
});

// ─────────────────────────────────────
// POST  ویرایش مقاله
// ─────────────────────────────────────
app.post('/sw-admin/blog/:id/update', requireAdminAuth, upload.single('coverImage'), async (req, res) => {
  try {
    const { title, slug, excerpt, content, category, author, readTime, publish } = req.body;

    let tags = req.body['tags[]'] || req.body.tags || [];
    if (!Array.isArray(tags)) tags = [tags];

    const post = await BlogPost.findById(req.params.id);
    if (!post) return res.status(404).send('مقاله یافت نشد');

    post.title = title;
    post.slug = slug;
    post.excerpt = excerpt;
    post.body = content;
    post.category = category;
    post.author = author;
    post.tags = tags;
    post.readingTime = readTime ? parseInt(readTime, 10) : undefined;
    post.status = publish === '1' ? 'published' : 'draft';

    if (req.file) {
      post.coverImage = '/uploads/' + req.file.filename;
    }

    await post.save(); // pre('save') hook برای publishedAt همینجا فعال می‌مونه
    res.redirect('/sw-admin/blog');
  } catch (err) {
    console.error(err);
    res.status(500).send('خطا در به‌روزرسانی مقاله');
  }
});


//لود کردن صفحات استاتیک سایت


app.get('/services', (req, res) => {
    res.render('services'); 
});

app.get('/portfolio', (req, res) => {
    res.render('portfolio'); 
});

app.get('/packages', (req, res) => {
    res.render('packages');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/contact', (req, res) => {
    res.render('contact');
});
// ─────────────────────────────────────────
//  404
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404')
})

