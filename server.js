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

const app = express()

// ─────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
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
const Ticket    = require('./models/ticket.model')
const Task      = require('./models/task.model')
const Activity  = require('./models/activity.model')
const Portfolio = require('./models/portfolio.model')
const Review    = require('./models/review.model')
const Package   = require('./models/package.model')
const BlogPost  = require('./models/blogPost.model')
const Setting   = require('./models/setting.model')
const Category  = require('./models/category')

// ─────────────────────────────────────────
//  DB + SERVER START
// ─────────────────────────────────────────
const DB_URL = process.env.DB_URL || 'mongodb://localhost:27017/SoulWeb'
const PORT   = process.env.PORT   || 3000

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
app.get('/sw-admin' , requireAdminAuth , async (req, res) => {
  try {
    const [
      activeProjects,
      totalClients,
      deliveredProjects,
      openTickets,
      recentActivities,
      todayTasks
    ] = await Promise.all([
      Project.countDocuments({ status: 'active' }),
      Client.countDocuments({ isActive: true }),
      Project.countDocuments({ status: 'done' }),
      Ticket.countDocuments({ status: 'open' }),
      Activity.find().sort({ createdAt: -1 }).limit(7),
      Task.find().sort({ createdAt: -1 }).limit(7)
    ])

    res.render('admin/Dashboard', {
      stats: {
        activeProjects,
        totalClients,
        deliveredProjects,
        openTickets
      },
      recentActivities,
      todayTasks
    })
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در بارگذاری داشبورد')
  }
})

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

res.render('admin/projects', {
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

// ─────────────────────────────────────────
//  ADMIN — CLIENTS
// ─────────────────────────────────────────

app.get('/sw-admin/clients', requireAdminAuth , async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = 6
    const skip = (page - 1) * limit

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const [
      clientsCount,
      activeClientsCount,
      newClientsThisWeekCount,
      clients,
      categories
    ] = await Promise.all([
      Client.countDocuments(),

      Client.countDocuments({ isActive: true }),

      Client.countDocuments({
        createdAt: { $gte: sevenDaysAgo }
      }),

      Client.find()
        .populate('category', 'title slug icon color gradient')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Category.find({
        type: 'service',
        isActive: true
      })
        .sort({ order: 1 })
        .lean()
    ])

    const clientsWithProjects = await Promise.all(
      clients.map(async (client) => {
        const projectsCount = await Portfolio.countDocuments({
          client: client._id
        })

        const lastProject = await Portfolio.findOne({
          client: client._id
        })
          .sort({ createdAt: -1 })
          .select('title')
          .lean()

        return {
          ...client,
          projectsCount,
          projectTitle: lastProject ? lastProject.title : '---'
        }
      })
    )

    const totalPages = Math.ceil(clientsCount / limit)

    const startItem = clientsCount === 0 ? 0 : skip + 1
    const endItem = Math.min(skip + limit, clientsCount)

    res.render('admin/Clients', {
      clients: clientsWithProjects,
      categories,

      clientsCount,
      activeClientsCount,
      newClientsThisWeekCount,

      currentPage: page,
      totalPages,
      limit,
      startItem,
      endItem
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


// ─────────────────────────────────────────
//  ADMIN — TICKETS
// ─────────────────────────────────────────
app.get('/sw-admin/tickets', requireAdminAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('client', 'name')
      .sort({ createdAt: -1 })
    res.render('admin/Tickets', { tickets })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری تیکت‌ها')
  }
})

app.post('/sw-admin/tickets/:id/status', requireAdminAuth, async (req, res) => {
  try {
    // req.body.status باید یکی از مقادیر 'open' | 'pending' | 'closed' باشد
    await Ticket.findByIdAndUpdate(req.params.id, { status: req.body.status })
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    res.status(500).send('خطا در تغییر وضعیت تیکت')
  }
})

app.post('/sw-admin/tickets/:id/priority', requireAdminAuth, async (req, res) => {
  try {
    // req.body.priority باید یکی از مقادیر 'urgent' | 'medium' | 'low' باشد
    await Ticket.findByIdAndUpdate(req.params.id, { priority: req.body.priority })
    res.redirect('/sw-admin/tickets')
  } catch (err) {
    res.status(500).send('خطا در تغییر اولویت تیکت')
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

app.get('/sw-admin/login' , async (req , res) => {
  res.render('./admin/Login')
})


app.post('/sw-admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).render('admin/Login', {
        error: 'ایمیل و رمز عبور الزامی هستند'
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    }).select('+password');

    if (!user) {
      return res.status(401).render('admin/Login', {
        error: 'ایمیل یا رمز عبور اشتباه است'
      });
    }

    if (!user.isActive) {
      return res.status(403).render('admin/Login', {
        error: 'حساب کاربری شما غیرفعال شده است'
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).render('admin/Login', {
        error: 'ایمیل یا رمز عبور اشتباه است'
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.redirect('/sw-admin');
  } catch (err) {
    console.error(err);
    res.status(500).render('admin/Login', {
      error: 'خطا در ورود به پنل'
    });
  }
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
// ─────────────────────────────────────────
//  404
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404')
})