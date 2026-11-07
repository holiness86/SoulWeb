const express        = require('express')
const mongoose       = require('mongoose')
const path           = require('path')
const fs             = require('fs')
const multer         = require('multer')
const ExcelJS        = require('exceljs')
const puppeteer      = require('puppeteer-core')
const ejs            = require('ejs')
const session        = require('express-session')
const moment         = require('jalali-moment')
const methodOverride = require('method-override')

try { require('dotenv').config() } catch (e) { /* dotenv نصب نیست؛ از env سیستم استفاده می‌شود */ }

const app = express()

// ─────────────────────────────────────────
//  CONFIG  (مقادیر حساس را در .env / env سرور بگذار)
// ─────────────────────────────────────────
const PORT           = process.env.PORT || 3000
const DB_URL         = process.env.DB_URL || 'mongodb://localhost:27017/SoulWeb'
const SESSION_SECRET = process.env.SESSION_SECRET || 'soulweb-super-secret-key'
const COOKIE_SECURE  = process.env.COOKIE_SECURE === 'true'   // پشت https برابر true بگذار
const CHROME_PATH    = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

// ─────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────
app.disable('x-powered-by')
if (COOKIE_SECURE) app.set('trust proxy', 1)

app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(methodOverride('_method'))

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: COOKIE_SECURE,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}))

function requireAdminAuth(req, res, next) {
  if (!req.session || !req.session.user) return res.redirect('/sw-admin/login')
  next()
}

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
//  ADMIN LOCALS — داده‌ی مشترک سایدبار/هدر (adminUser, ticketBadge, notifCount)
// ─────────────────────────────────────────
const ROLE_LABELS = { admin: 'مدیر کل سیستم' }

app.use('/sw-admin', async (req, res, next) => {
  const u = req.session && req.session.user
  if (!u || req.method !== 'GET') return next()

  try {
    const words = String(u.name || '').trim().split(/\s+/).filter(Boolean)

    res.locals.adminUser = {
      name    : u.name,
      role    : ROLE_LABELS[u.role] || u.role || 'مدیر',
      initials: words.length > 1
        ? words.slice(0, 2).map(w => w[0]).join('\u200c')
        : (words[0] || 'ادم').slice(0, 2)
    }

    const openTickets = await Ticket.countDocuments({ status: 'open' })
    res.locals.ticketBadge = openTickets
    res.locals.notifCount  = openTickets
  } catch (err) {
    console.error('Admin locals error:', err)
  }
  next()
})

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id)

// try/catch مشترک برای روت‌های ساده (پیام خطا همان پیام قبلی هر روت)
const safe = (msg, fn) => async (req, res) => {
  try { await fn(req, res) }
  catch (err) { console.error(msg, err); res.status(500).send(msg) }
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
  const parsed = moment(toEnglishDigits(value).trim(), 'jYYYY/jMM/jDD')
  return parsed.isValid() ? parsed.locale('en').toDate() : null
}

const normalizeTechStack = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean)
  return String(value).split(/[,،·|]/).map(item => item.trim()).filter(Boolean)
}

const normalizeProgress = (value) => {
  const num = parseInt(toEnglishDigits(value), 10)
  return Number.isNaN(num) ? 0 : Math.max(0, Math.min(100, num))
}

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

const makeSlug = (text) =>
  String(text || '').replace(/\s+/g, '-').replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '') + '-' + Date.now()

const formatMoney = (v) => (Number(v) || 0).toLocaleString('fa-IR')

const formatDate = (date) => {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch (err) { return '—' }
}

const asArray = (v) => Array.isArray(v) ? v : (v === undefined || v === null ? [] : [v])

// ─────────────────────────────────────────
//  UPLOAD (multer) — public/uploads/<folder>
// ─────────────────────────────────────────
const makeUpload = (folder) => {
  const dir = path.join(__dirname, 'public', 'uploads', folder)
  fs.mkdirSync(dir, { recursive: true })

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dir),
      filename   : (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    }),
    limits    : { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('image/'))
  })
}

const uploadPortfolio = makeUpload('portfolio')
const uploadBlog      = makeUpload('blog')

// ─────────────────────────────────────────
//  PDF (puppeteer)
// ─────────────────────────────────────────
async function htmlToPdf(html, margin) {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    return await page.pdf({ format: 'A4', printBackground: true, margin })
  } finally {
    await browser.close()
  }
}

const invoiceStatusLabel = (status) => ({
  draft: 'پیش‌نویس', sent: 'ارسال‌شده', paid: 'پرداخت‌شده', overdue: 'معوق', cancelled: 'لغوشده'
}[status] || 'نامشخص')

function buildInvoiceStats(invoices) {
  const count  = (s) => invoices.filter(inv => inv.status === s).length
  const amount = (s) => invoices
    .filter(inv => inv.status === s)
    .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0)

  return {
    total    : invoices.length,
    draft    : count('draft'),
    sent     : count('sent'),
    paid     : count('paid'),
    overdue  : count('overdue'),
    cancelled: count('cancelled'),
    paidAmount   : amount('paid'),
    sentAmount   : amount('sent'),
    overdueAmount: amount('overdue')
  }
}

const INVOICE_PDF_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px; direction: rtl; font-family: Tahoma, Arial, sans-serif; color: #0f172a; background: #fff; }
  .invoice-box { width: 100%; border: 1px solid #e2e8f0; border-radius: 18px; padding: 28px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
  .brand h1 { margin: 0 0 8px; font-size: 26px; color: #2563eb; }
  .brand p { margin: 0; color: #64748b; font-size: 13px; }
  .invoice-meta { text-align: left; direction: rtl; font-size: 13px; line-height: 1.9; }
  .section { margin-bottom: 22px; }
  .section-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; color: #334155; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; background: #f8fafc; }
  .row { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 13px; }
  .row:last-child { border-bottom: 0; }
  .label { color: #64748b; }
  .value { font-weight: 700; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #eff6ff; color: #1d4ed8; padding: 12px; font-size: 13px; text-align: right; border: 1px solid #dbeafe; }
  td { padding: 12px; font-size: 13px; border: 1px solid #e2e8f0; }
  .total-box { margin-top: 24px; margin-right: auto; width: 320px; border: 1px solid #dbeafe; border-radius: 14px; overflow: hidden; }
  .total-row { display: flex; justify-content: space-between; padding: 14px 16px; background: #eff6ff; font-size: 15px; font-weight: 800; color: #1d4ed8; }
  .footer { margin-top: 36px; padding-top: 18px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 12px; text-align: center; }
`

function buildInvoiceHtml(invoice) {
  const clientName   = invoice.client  ? (invoice.client.company || invoice.client.name || 'بدون نام') : 'بدون مشتری'
  const projectTitle = invoice.project ? (invoice.project.title || 'بدون عنوان') : 'بدون پروژه'
  const number       = esc(invoice.invoiceNumber || '—')

  const rows = (Array.isArray(invoice.items) && invoice.items.length)
    ? invoice.items.map(item => {
        const qty       = Number(item.quantity) || 1
        const lineTotal = Number(item.total) || (qty * (Number(item.unitPrice) || 0))
        return `<tr><td>${esc(item.description || '—')}</td><td>${qty.toLocaleString('fa-IR')}</td><td>${formatMoney(lineTotal)} تومان</td></tr>`
      }).join('')
    : `<tr><td>خدمات انجام‌شده</td><td>۱</td><td>${formatMoney(invoice.total)} تومان</td></tr>`

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8" /><style>${INVOICE_PDF_CSS}</style></head>
<body>
  <div class="invoice-box">
    <div class="header">
      <div class="brand"><h1>فاکتور</h1><p>سیستم مدیریت SoulWeb</p></div>
      <div class="invoice-meta">
        <div><strong>شماره فاکتور:</strong> ${number}</div>
        <div><strong>تاریخ صدور:</strong> ${formatDate(invoice.issueDate || invoice.createdAt)}</div>
        <div><strong>سررسید:</strong> ${formatDate(invoice.dueDate)}</div>
        <div><strong>وضعیت:</strong> ${invoiceStatusLabel(invoice.status)}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">اطلاعات فاکتور</div>
      <div class="grid">
        <div class="card">
          <div class="row"><span class="label">مشتری</span><span class="value">${esc(clientName)}</span></div>
          <div class="row"><span class="label">پروژه</span><span class="value">${esc(projectTitle)}</span></div>
        </div>
        <div class="card">
          <div class="row"><span class="label">شماره</span><span class="value">${number}</span></div>
          <div class="row"><span class="label">مبلغ کل</span><span class="value">${formatMoney(invoice.total)} تومان</span></div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">جزئیات</div>
      <table>
        <thead><tr><th>شرح</th><th>تعداد</th><th>مبلغ</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="total-box">
      <div class="total-row"><span>جمع کل</span><span>${formatMoney(invoice.total)} تومان</span></div>
    </div>

    <div class="footer">این فاکتور به‌صورت سیستمی تولید شده است.</div>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────
//  PUBLIC ROUTES
// ─────────────────────────────────────────
app.get('/', async (req, res) => {
  try {
    const [portfolio, packages] = await Promise.all([
      Portfolio.find().sort({ order: 1 }),
      Package.find({ isActive: true }).sort({ order: 1, createdAt: -1 })
    ])
    res.render('index', { portfolio, packages })
  } catch (err) {
    console.error(err)
    res.status(500).send('Server Error')
  }
})

// صفحات استاتیک سایت
;['services', 'portfolio', 'packages', 'about', 'contact'].forEach(page => {
  app.get('/' + page, (req, res) => res.render(page))
})

// فرم تماس سایت → ساخت تیکت (عمومی، بدون نیاز به لاگین)
app.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, body, department } = req.body

    if (!name || !email || !body) {
      return res.status(400).json({ success: false, message: 'نام، ایمیل و پیام الزامی هستند' })
    }

    await Ticket.create({
      requesterName : name,
      requesterEmail: email,
      requesterPhone: phone || '',
      subject       : subject || 'بدون موضوع',
      department    : department || 'general',
      priority      : 'medium',
      status        : 'open',
      source        : 'contact_form',
      messages      : [{ sender: 'client', body }]
    })

    await Activity.create({
      type        : 'ticket_created',
      title       : `تیکت جدید از ${name}`,
      icon        : 'bi-ticket-detailed-fill',
      colorVariant: 'warning'
    })

    res.json({ success: true, message: 'تیکت شما با موفقیت ثبت شد' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ success: false, message: 'خطا در ثبت تیکت' })
  }
})

// ─────────────────────────────────────────
//  ADMIN — AUTH
// ─────────────────────────────────────────
app.get('/sw-admin/login', (req, res) => {
  if (req.session.user) return res.redirect('/sw-admin')
  res.render('admin/Login')
})

app.post('/sw-admin/login', async (req, res) => {
  const fail = (status, error) => res.status(status).render('admin/Login', { error })

  try {
    const { email, password } = req.body
    if (!email || !password) return fail(400, 'ایمیل و رمز عبور الزامی هستند')

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password')
    if (!user) return fail(401, 'ایمیل یا رمز عبور اشتباه است')
    if (!user.isActive) return fail(403, 'حساب کاربری شما غیرفعال شده است')

    const isMatch = await user.comparePassword(password)
    if (!isMatch) return fail(401, 'ایمیل یا رمز عبور اشتباه است')

    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role }
    res.redirect('/sw-admin')
  } catch (err) {
    console.error(err)
    fail(500, 'خطا در ورود به پنل')
  }
})

// خروج (فرم «خروج از حساب» در سایدبار به همین آدرس POST می‌کند)
app.post('/sw-admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid')
    res.redirect('/sw-admin/login')
  })
})

// ─────────────────────────────────────────
//  ADMIN — DASHBOARD
// ─────────────────────────────────────────
app.get('/sw-admin', requireAdminAuth, safe('خطا در بارگذاری داشبورد', async (req, res) => {
  const [activeProjects, totalClients, deliveredProjects, openTickets, recentActivities, todayTasks] =
    await Promise.all([
      Project.countDocuments({ status: 'active' }),
      Client.countDocuments({ isActive: true }),
      Project.countDocuments({ status: 'done' }),
      Ticket.countDocuments({ status: 'open' }),
      Activity.find().sort({ createdAt: -1 }).limit(7),
      Task.find().sort({ createdAt: -1 }).limit(7)
    ])

  res.render('admin/Dashboard', {
    stats: { activeProjects, totalClients, deliveredProjects, openTickets },
    recentActivities,
    todayTasks
  })
}))

// ─────────────────────────────────────────
//  ADMIN — PROJECTS
// ─────────────────────────────────────────
function parseProjectBody(body) {
  const { title, client, category, startDate, deadline, techStack, description, progress } = body

  if (!title || !client || !category) return { error: 'نام پروژه، مشتری و نوع پروژه الزامی هستند' }

  const parsedStart = normalizeDate(startDate)
  const parsedDeadline = normalizeDate(deadline)

  if (startDate && !parsedStart)    return { error: 'تاریخ شروع نامعتبر است' }
  if (deadline && !parsedDeadline)  return { error: 'تاریخ ددلاین نامعتبر است' }

  return {
    data: {
      title      : title.trim(),
      client,
      category,
      startDate  : parsedStart,
      deadline   : parsedDeadline,
      techStack  : normalizeTechStack(techStack),
      description: description ? description.trim() : '',
      progress   : normalizeProgress(progress)
    }
  }
}

app.get('/sw-admin/projects', requireAdminAuth, safe('خطا در بارگذاری پروژه‌ها', async (req, res) => {
  const { status, search } = req.query
  const filter = {}

  if (status) filter.status = status
  if (search) filter.title = { $regex: escapeRegex(search), $options: 'i' }

  const [projects, clients, serviceCategories] = await Promise.all([
    Project.find(filter)
      .populate('client', 'name company')
      .populate('category', 'title slug')
      .sort({ createdAt: -1 })
      .lean(),
    Client.find({ isActive: true }).sort({ name: 1 }).lean(),
    Category.find({ type: 'service' }).lean()
  ])

  const kanbanColumns = [
    { key: 'todo',       title: 'در انتظار' },
    { key: 'inprogress', title: 'در حال انجام' },
    { key: 'review',     title: 'در حال بررسی' },
    { key: 'done',       title: 'انجام‌شده' }
  ]

  const defaultTechOptions = ['HTML', 'CSS', 'JavaScript', 'Node.js', 'React', 'MongoDB']

  res.render('admin/Projects', {
    projects, clients, serviceCategories, kanbanColumns, defaultTechOptions, query: req.query
  })
}))

app.get('/sw-admin/projects/export', requireAdminAuth, safe('خطا در خروجی Excel', async (req, res) => {
  const projects = await Project.find()
    .populate('client', 'name company')
    .populate('category', 'title')
    .sort({ createdAt: -1 })
    .lean()

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Projects')

  sheet.columns = [
    { header: 'نام پروژه', key: 'title',    width: 30 },
    { header: 'مشتری',     key: 'client',   width: 25 },
    { header: 'نوع پروژه', key: 'category', width: 25 },
    { header: 'وضعیت',     key: 'status',   width: 18 },
    { header: 'پیشرفت',    key: 'progress', width: 12 },
    { header: 'ددلاین',    key: 'deadline', width: 18 },
    { header: 'تکنولوژی',  key: 'tech',     width: 35 }
  ]

  const statusMap = {
    active: 'در حال انجام', review: 'در ریویو', done: 'تحویل شده', hold: 'متوقف', cancelled: 'لغو شده'
  }

  projects.forEach(p => {
    sheet.addRow({
      title   : p.title || '',
      client  : p.client?.company || p.client?.name || 'بدون مشتری',
      category: p.category?.title || 'بدون نوع',
      status  : statusMap[p.status] || '',
      progress: `${p.progress || 0}%`,
      deadline: p.deadline ? new Date(p.deadline).toLocaleDateString('fa-IR') : '',
      tech    : Array.isArray(p.techStack) ? p.techStack.join(' · ') : ''
    })
  })

  sheet.getRow(1).font = { bold: true }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', 'attachment; filename=projects.xlsx')

  await workbook.xlsx.write(res)
  res.end()
}))

app.post('/sw-admin/projects/add', requireAdminAuth, safe('خطا در ثبت پروژه', async (req, res) => {
  const { error, data } = parseProjectBody(req.body)
  if (error) return res.status(400).send(error)

  await Project.create({ ...data, status: 'active', createdBy: req.session.user.id })
  res.redirect('/sw-admin/projects')
}))

app.post('/sw-admin/projects/:id/update', requireAdminAuth, safe('خطا در ویرایش پروژه', async (req, res) => {
  const { error, data } = parseProjectBody(req.body)
  if (error) return res.status(400).send(error)

  if (req.body.status) data.status = req.body.status

  await Project.findByIdAndUpdate(req.params.id, data)
  res.redirect('/sw-admin/projects')
}))

app.post('/sw-admin/projects/:id/delete', requireAdminAuth, safe('خطا در حذف پروژه', async (req, res) => {
  await Project.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/projects')
}))

// ─────────────────────────────────────────
//  ADMIN — CLIENTS
// ─────────────────────────────────────────
app.get('/sw-admin/clients', requireAdminAuth, safe('خطا در بارگذاری مشتریان', async (req, res) => {
  const page  = Math.max(parseInt(req.query.page) || 1, 1)
  const limit = 6
  const skip  = (page - 1) * limit

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [clientsCount, activeClientsCount, newClientsThisWeekCount, clients, categories] = await Promise.all([
    Client.countDocuments(),
    Client.countDocuments({ isActive: true }),
    Client.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    Client.find()
      .populate('category', 'title slug icon color gradient')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Category.find({ type: 'service', isActive: true }).sort({ order: 1 }).lean()
  ])

  const clientsWithProjects = await Promise.all(clients.map(async (client) => {
    const [projectsCount, lastProject] = await Promise.all([
      Portfolio.countDocuments({ client: client._id }),
      Portfolio.findOne({ client: client._id }).sort({ createdAt: -1 }).select('title').lean()
    ])
    return { ...client, projectsCount, projectTitle: lastProject ? lastProject.title : '---' }
  }))

  res.render('admin/Clients', {
    clients: clientsWithProjects,
    categories,
    clientsCount,
    activeClientsCount,
    newClientsThisWeekCount,
    currentPage: page,
    totalPages : Math.ceil(clientsCount / limit),
    limit,
    startItem  : clientsCount === 0 ? 0 : skip + 1,
    endItem    : Math.min(skip + limit, clientsCount)
  })
}))

app.get('/sw-admin/clients/export', requireAdminAuth, safe('خطا در خروجی CSV', async (req, res) => {
  const clients = await Client.find().sort({ createdAt: -1 })

  let csv = 'نام,شرکت,ایمیل,تلفن,آدرس,وضعیت\n'
  clients.forEach(c => {
    csv += [c.name, c.company, c.email, c.phone, c.address, c.isActive ? 'فعال' : 'غیرفعال']
      .map(csvCell).join(',') + '\n'
  })

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=clients.csv')
  res.send('\uFEFF' + csv) // برای درست نمایش فارسی در Excel
}))

app.get('/sw-admin/clients/:clientId/projects', requireAdminAuth, async (req, res) => {
  try {
    const { clientId } = req.params
    if (!isValidId(clientId)) return res.status(400).json({ message: 'شناسه مشتری معتبر نیست' })

    const projects = await Project.find({ client: clientId })
      .select('title status progress deadline')
      .sort({ createdAt: -1 })
      .lean()

    res.json(projects)
  } catch (err) {
    console.error('Client projects fetch error:', err)
    res.status(500).json({ message: 'خطا در دریافت پروژه‌های مشتری' })
  }
})

app.post('/sw-admin/clients', requireAdminAuth, safe('خطا در ثبت مشتری', async (req, res) => {
  const { name, company, email, phone, address, notes, avatar, category } = req.body

  await Client.create({ name, company, email, phone, address, notes, avatar, category: category || null })
  res.redirect('/sw-admin/clients')
}))

// ویرایش مشتری — مسیر قدیمی (/clients/:id) هم نگه داشته شده تا فرم فعلی کار کند، ولی حالا محافظت‌شده است
const clientsBack = (type, msg) => `/sw-admin/clients?${type}=${encodeURIComponent(msg)}`

app.post(['/sw-admin/clients/:id', '/clients/:id'], requireAdminAuth, async (req, res) => {
  try {
    const { name, company, email, phone, address, notes } = req.body

    if (!name || !name.trim()) return res.redirect(clientsBack('error', 'نام مشتری الزامی است'))

    const updateData = {
      name   : name.trim(),
      company: company ? company.trim() : '',
      email  : email ? email.trim().toLowerCase() : undefined,
      phone  : phone ? phone.trim() : '',
      address: address ? address.trim() : '',
      notes  : notes ? notes.trim() : ''
    }

    // ایمیل خالی را حذف می‌کنیم تا unique index خراب نشود
    if (!updateData.email) {
      delete updateData.email
      await Client.findByIdAndUpdate(req.params.id, { $unset: { email: 1 } })
    }

    const client = await Client.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    if (!client) return res.redirect(clientsBack('error', 'مشتری پیدا نشد'))

    res.redirect(clientsBack('success', 'اطلاعات مشتری با موفقیت به‌روزرسانی شد'))
  } catch (err) {
    console.error('Edit client error:', err)
    if (err.code === 11000) return res.redirect(clientsBack('error', 'این ایمیل قبلاً برای مشتری دیگری ثبت شده'))
    res.redirect(clientsBack('error', 'خطا در به‌روزرسانی اطلاعات مشتری'))
  }
})

app.post('/sw-admin/clients/:id/delete', requireAdminAuth, safe('خطا در حذف مشتری', async (req, res) => {
  await Client.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/clients')
}))

// ─────────────────────────────────────────
//  ADMIN — TICKETS
// ─────────────────────────────────────────
app.get('/sw-admin/tickets', requireAdminAuth, safe('خطا در بارگذاری تیکت‌ها', async (req, res) => {
  const tickets = await Ticket.find().populate('client', 'name').sort({ createdAt: -1 })
  res.render('admin/Tickets', { tickets })
}))

// status: 'open' | 'pending' | 'closed'
app.post('/sw-admin/tickets/:id/status', requireAdminAuth, safe('خطا در تغییر وضعیت تیکت', async (req, res) => {
  await Ticket.findByIdAndUpdate(req.params.id, { status: req.body.status })
  res.redirect('/sw-admin/tickets')
}))

// priority: 'urgent' | 'medium' | 'low'
app.post('/sw-admin/tickets/:id/priority', requireAdminAuth, safe('خطا در تغییر اولویت تیکت', async (req, res) => {
  await Ticket.findByIdAndUpdate(req.params.id, { priority: req.body.priority })
  res.redirect('/sw-admin/tickets')
}))

app.post('/sw-admin/tickets/:id/delete', requireAdminAuth, safe('خطا در حذف تیکت', async (req, res) => {
  await Ticket.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/tickets')
}))

// ─────────────────────────────────────────
//  ADMIN — INVOICES
// ─────────────────────────────────────────
app.get('/sw-admin/invoices', requireAdminAuth, safe('خطا در دریافت فاکتورها', async (req, res) => {
  const [invoices, clients] = await Promise.all([
    Invoice.find()
      .populate('client', 'name company email phone')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
      .lean(),
    Client.find({ isActive: true }).select('name company email').sort({ createdAt: -1 }).lean()
  ])

  res.render('admin/Invoices', {
    title: 'مدیریت فاکتورها',
    invoices,
    clients,
    invoiceStats: buildInvoiceStats(invoices)
  })
}))

// ⚠️ قبل از /:id/pdf تعریف شده تا با آن تداخل نکند
app.get('/sw-admin/invoices/export/pdf', requireAdminAuth, safe('خطا در تولید خروجی PDF فاکتورها', async (req, res) => {
  const invoices = await Invoice.find()
    .populate('client', 'name company email phone')
    .populate('project', 'title')
    .sort({ createdAt: -1 })
    .lean()

  const html = await ejs.renderFile(path.join(__dirname, 'views', 'admin', 'invoices-pdf.ejs'), {
    title: 'گزارش فاکتورها',
    invoices,
    invoiceStats: buildInvoiceStats(invoices)
  })

  const pdfBuffer = await htmlToPdf(html, { top: '14mm', right: '10mm', bottom: '14mm', left: '10mm' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="invoices-${Date.now()}.pdf"`)
  res.send(pdfBuffer)
}))

app.get('/sw-admin/invoices/:id/pdf', requireAdminAuth, safe('خطا در ساخت PDF فاکتور', async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) return res.status(400).send('شناسه فاکتور نامعتبر است')

  const invoice = await Invoice.findById(id).populate('client').populate('project').lean()
  if (!invoice) return res.status(404).send('فاکتور پیدا نشد')

  const pdfBuffer = await htmlToPdf(buildInvoiceHtml(invoice), { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber || invoice._id}.pdf"`)
  res.setHeader('Content-Length', pdfBuffer.length)
  res.send(pdfBuffer)
}))

app.post('/sw-admin/invoices/add', requireAdminAuth, safe('خطا در ثبت فاکتور', async (req, res) => {
  const { client, project, item_desc, item_qty, item_price, issue_date, due_date, note, status } = req.body

  if (!client) return res.status(400).send('انتخاب مشتری الزامی است')
  if (!isValidId(client)) return res.status(400).send('شناسه مشتری معتبر نیست')
  if (project && !isValidId(project)) return res.status(400).send('شناسه پروژه معتبر نیست')

  if (!(await Client.exists({ _id: client }))) return res.status(404).send('مشتری پیدا نشد')

  if (project && !(await Project.exists({ _id: project, client }))) {
    return res.status(400).send('پروژه انتخاب‌شده متعلق به این مشتری نیست')
  }

  const parseMoney = (value) => {
    if (value === undefined || value === null) return 0
    const normalized = toEnglishDigits(value).replace(/[,،]/g, '').trim()
    const num = Number(normalized)
    return Number.isFinite(num) ? num : 0
  }

  const quantities = asArray(item_qty)
  const prices     = asArray(item_price)

  const items = asArray(item_desc)
    .map((desc, i) => ({
      description: String(desc || '').trim(),
      quantity   : parseMoney(quantities[i]) > 0 ? parseMoney(quantities[i]) : 1,
      unitPrice  : parseMoney(prices[i])
    }))
    .filter(item => item.description && item.unitPrice > 0)

  if (!items.length) return res.status(400).send('حداقل یک آیتم معتبر برای فاکتور لازم است')

  const parsedIssueDate = normalizeDate(issue_date)
  const parsedDueDate   = normalizeDate(due_date)

  if (issue_date && !parsedIssueDate) return res.status(400).send('تاریخ صدور نامعتبر است')
  if (due_date && !parsedDueDate)     return res.status(400).send('تاریخ سررسید نامعتبر است')

  let invoiceNumber = `INV-${(await Invoice.countDocuments()) + 1001}`
  while (await Invoice.exists({ invoiceNumber })) invoiceNumber = `INV-${Date.now()}`

  await Invoice.create({
    invoiceNumber,
    client,
    project  : project || null,
    items,
    issueDate: parsedIssueDate || new Date(),
    dueDate  : parsedDueDate,
    notes    : note ? String(note).trim() : '',
    status   : ['draft', 'sent'].includes(status) ? status : 'sent',
    currency : 'IRR',
    createdBy: req.session.user.id
  })

  res.redirect('/sw-admin/invoices')
}))

app.post('/sw-admin/invoices/:id/publish', requireAdminAuth, safe('خطا در انتشار فاکتور', async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) return res.status(400).send('شناسه فاکتور نامعتبر است')

  const invoice = await Invoice.findById(id)
  if (!invoice) return res.status(404).send('فاکتور پیدا نشد')
  if (invoice.status !== 'draft') return res.status(400).send('این فاکتور در وضعیت پیش‌نویس نیست')

  invoice.status = 'sent'
  await invoice.save()
  res.redirect('/sw-admin/invoices')
}))

app.post('/sw-admin/invoices/:id/delete', requireAdminAuth, safe('خطا در حذف فاکتور', async (req, res) => {
  const { id } = req.params
  if (!isValidId(id)) return res.status(400).send('شناسه فاکتور نامعتبر است')

  const deleted = await Invoice.findByIdAndDelete(id)
  if (!deleted) return res.status(404).send('فاکتور پیدا نشد')

  res.redirect('/sw-admin/invoices')
}))

// ─────────────────────────────────────────
//  ADMIN — PORTFOLIO
// ─────────────────────────────────────────
const portfolioCategories = () => Category.find({ type: 'portfolio', isActive: true }).sort({ order: 1 }).lean()

function parsePortfolioBody(body) {
  const { title, description, category, techStack, liveUrl, client, isFeatured, publish, seoKeywords, metaDescription } = body

  return {
    title          : (title || '').trim(),
    description    : description || '',
    category       : category || 'web',
    techStack      : normalizeTechStack(techStack),
    liveUrl        : liveUrl || '',
    client         : client || null,
    isFeatured     : isFeatured === 'on',
    isPublished    : publish === '1',
    seoKeywords    : (seoKeywords || '').trim(),
    metaDescription: (metaDescription || '').trim()
  }
}

app.get('/sw-admin/portfolio', requireAdminAuth, safe('خطا در بارگذاری پورتفولیو', async (req, res) => {
  const [items, clients, categories] = await Promise.all([
    Portfolio.find()
      .populate('client', 'name company')
      .populate('project', 'title')
      .populate('category', 'title slug')
      .sort({ order: 1, createdAt: -1 })
      .lean(),
    Client.find({ isActive: true }).sort({ name: 1 }).lean(),
    portfolioCategories()
  ])

  res.render('admin/Portfolio', { items, clients, categories, flash: {} })
}))

// فرم واحد افزودن/ویرایش — اگر ?id=... باشد حالت ویرایش است
app.get('/sw-admin/portfolio/form', requireAdminAuth, safe('خطا در بارگذاری فرم نمونه کار', async (req, res) => {
  const { id } = req.query
  if (id && !isValidId(id)) return res.status(400).send('شناسه نمونه کار معتبر نیست')

  const [clients, categories, foundItem] = await Promise.all([
    Client.find({ isActive: true }).sort({ name: 1 }).lean(),
    portfolioCategories(),
    id
      ? Portfolio.findById(id)
          .populate('client', 'name company')
          .populate('project', 'title')
          .populate('category', 'title slug')
          .lean()
      : null
  ])

  if (id && !foundItem) return res.status(404).send('نمونه کار مورد نظر پیدا نشد')

  // شیء خالی برای حالت «افزودن» تا EJS با undefined خطا ندهد
  const emptyItem = {
    _id: null, title: '', description: '', coverImage: '', category: '', techStack: [],
    liveUrl: '', client: null, isFeatured: false, isPublished: false, views: 0,
    seoKeywords: '', metaDescription: ''
  }

  res.render('admin/portfolio-form', {
    item  : foundItem || emptyItem,
    isEdit: !!foundItem,
    clients,
    categories,
    flash : {}
  })
}))

app.post('/sw-admin/portfolio', requireAdminAuth, uploadPortfolio.single('coverImage'), safe('خطا در ثبت نمونه کار', async (req, res) => {
  const data = parsePortfolioBody(req.body)

  await Portfolio.create({
    ...data,
    coverImage: req.file ? `/uploads/portfolio/${req.file.filename}` : '',
    order     : await Portfolio.countDocuments()
  })

  await Activity.create({
    type        : 'project_created',
    title       : `نمونه کار «${data.title}» به پورتفولیو اضافه شد`,
    icon        : 'bi-collection-fill',
    colorVariant: 'accent'
  })

  res.redirect('/sw-admin/portfolio')
}))

app.post('/sw-admin/portfolio/:id/update', requireAdminAuth, uploadPortfolio.single('coverImage'), safe('خطا در ویرایش', async (req, res) => {
  const portfolio = await Portfolio.findById(req.params.id)
  if (!portfolio) return res.status(404).send('پروژه پیدا نشد')

  portfolio.set(parsePortfolioBody(req.body))
  if (req.file) portfolio.coverImage = `/uploads/portfolio/${req.file.filename}` // وگرنه عکس قبلی می‌ماند

  await portfolio.save()
  res.redirect('/sw-admin/portfolio')
}))

app.post('/sw-admin/portfolio/:id/publish', requireAdminAuth, safe('خطا در انتشار', async (req, res) => {
  await Portfolio.findByIdAndUpdate(req.params.id, { isPublished: true })
  res.redirect('/sw-admin/portfolio')
}))

app.post('/sw-admin/portfolio/:id/delete', requireAdminAuth, safe('خطا در حذف نمونه کار', async (req, res) => {
  await Portfolio.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/portfolio')
}))

// ─────────────────────────────────────────
//  ADMIN — PACKAGES
// ─────────────────────────────────────────
const parseFeatures = (features) =>
  (features || '').split('\n').map(f => f.trim()).filter(Boolean)

app.get('/sw-admin/packages', requireAdminAuth, safe('خطا در بارگذاری صفحه پکیج‌ها', async (req, res) => {
  const packages = await Package.find().sort({ order: 1, createdAt: 1 })

  const activeCount = packages.filter(p => p.isActive).length
  const bestSeller  = packages.reduce((max, p) => (p.sales > (max ? max.sales : -1) ? p : max), null)

  res.render('admin/Packages', {
    packages,
    stats: {
      activeCount,
      monthlyPurchases: 0, // مدل سفارش/خرید جداگانه‌ای نداریم
      bestSellerName  : bestSeller ? bestSeller.name : '—',
      totalRevenue    : 0
    }
  })
}))

app.post('/sw-admin/packages', requireAdminAuth, safe('خطا در ثبت پکیج', async (req, res) => {
  const { name, description, price, currency, duration, features, category, isFeatured } = req.body

  await Package.create({
    name, description, currency, duration,
    price     : Number(price),
    slug      : makeSlug(name),
    features  : parseFeatures(features),
    category  : category || 'web',
    isFeatured: isFeatured === 'on'
  })
  res.redirect('/sw-admin/packages')
}))

// افزودن/ویرایش (اگر id بیاید ویرایش است)
app.post('/sw-admin/packages/save', requireAdminAuth, safe('Package error', async (req, res) => {
  const { id, name, slug, description, price, duration, category, features, isFeatured } = req.body

  const data = {
    name, description, price, duration, category,
    slug      : slug || makeSlug(name),
    features  : parseFeatures(features),
    isFeatured: !!isFeatured
  }

  if (id) await Package.findByIdAndUpdate(id, data)
  else    await Package.create(data)

  res.redirect('/sw-admin/packages')
}))

app.post('/sw-admin/packages/:id/delete', requireAdminAuth, safe('Delete error', async (req, res) => {
  await Package.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/packages')
}))

// ─────────────────────────────────────────
//  ADMIN — REVIEWS
// ─────────────────────────────────────────
app.get('/sw-admin/reviews', requireAdminAuth, safe('خطا در بارگذاری نظرات', async (req, res) => {
  const reviews = await Review.find()
    .populate('client', 'name')
    .populate('project', 'title')
    .sort({ createdAt: -1 })
  res.render('admin/Reviews', { reviews })
}))

app.post('/sw-admin/reviews/:id/approve', requireAdminAuth, safe('خطا', async (req, res) => {
  await Review.findByIdAndUpdate(req.params.id, { isApproved: true, isPublished: true })
  res.redirect('/sw-admin/reviews')
}))

// ─────────────────────────────────────────
//  ADMIN — BLOG
// ─────────────────────────────────────────
async function blogFormData() {
  const [authors, categoriesRaw] = await Promise.all([
    BlogPost.distinct('author'),
    BlogPost.distinct('category')
  ])
  // category در schema فقط یک رشته است
  const categories = categoriesRaw.filter(Boolean).map(c => ({ slug: c, title: c }))
  return { authors, categories }
}

function parseBlogBody(req) {
  const { title, slug, excerpt, content, category, author, readTime, publish } = req.body

  // چک‌باکس‌های تگ: اگر فقط یکی انتخاب شود string می‌آید نه آرایه
  const tags = asArray(req.body['tags[]'] || req.body.tags)

  return {
    title,
    slug       : slug || makeSlug(title),
    excerpt,
    body       : content, // content در فرم → body در schema
    category,
    author     : author || req.session.user.id,
    tags,
    readingTime: readTime ? parseInt(readTime, 10) : Math.ceil(String(content || '').split(/\s+/).length / 200),
    status     : publish === '1' ? 'published' : 'draft'
  }
}

app.get('/sw-admin/blog', requireAdminAuth, safe('خطا در بارگذاری وبلاگ', async (req, res) => {
  const posts = await BlogPost.find().populate('author', 'name').sort({ createdAt: -1 })
  res.render('admin/Blog', { posts })
}))

app.get('/sw-admin/blog-form', requireAdminAuth, safe('خطا در بارگذاری فرم مقاله', async (req, res) => {
  res.render('admin/blog-form', { isEdit: false, item: {}, ...(await blogFormData()) })
}))

app.get('/sw-admin/blog-form/:id', requireAdminAuth, safe('خطا در بارگذاری فرم ویرایش مقاله', async (req, res) => {
  const post = await BlogPost.findById(req.params.id).lean()
  if (!post) return res.status(404).send('مقاله یافت نشد')

  res.render('admin/blog-form', { isEdit: true, item: post, ...(await blogFormData()) })
}))

app.post('/sw-admin/blog', requireAdminAuth, uploadBlog.single('coverImage'), safe('خطا در ذخیره مقاله', async (req, res) => {
  await BlogPost.create({
    ...parseBlogBody(req),
    coverImage: req.file ? `/uploads/blog/${req.file.filename}` : undefined
  })
  res.redirect('/sw-admin/blog')
}))

app.post('/sw-admin/blog/:id/update', requireAdminAuth, uploadBlog.single('coverImage'), safe('خطا در به‌روزرسانی مقاله', async (req, res) => {
  const post = await BlogPost.findById(req.params.id)
  if (!post) return res.status(404).send('مقاله یافت نشد')

  post.set(parseBlogBody(req))
  if (req.file) post.coverImage = `/uploads/blog/${req.file.filename}`

  await post.save() // hook مربوط به publishedAt همین‌جا اجرا می‌شود
  res.redirect('/sw-admin/blog')
}))

app.post('/sw-admin/blog/:id/delete', requireAdminAuth, safe('خطا', async (req, res) => {
  await BlogPost.findByIdAndDelete(req.params.id)
  res.redirect('/sw-admin/blog')
}))

// ─────────────────────────────────────────
//  ADMIN — TASKS
// ─────────────────────────────────────────
app.get('/sw-admin/tasks', requireAdminAuth, safe('خطا', async (req, res) => {
  const tasks = await Task.find().populate('project', 'title').sort({ createdAt: -1 })
  res.render('admin/Tasks', { tasks })
}))

app.post('/sw-admin/tasks', requireAdminAuth, safe('خطا در ثبت وظیفه', async (req, res) => {
  const { title, priority, dueDate, project } = req.body

  await Task.create({
    title,
    priority  : priority || 'medium',
    dueDate   : dueDate || null,
    project   : project || null,
    assignedTo: req.session.user.id,
    createdBy : req.session.user.id
  })
  res.redirect(req.get('Referer') || '/sw-admin')
}))

// تغییر وضعیت انجام‌شده — JSON برای fetch داشبورد
app.post('/sw-admin/tasks/:id/toggle', requireAdminAuth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
    if (!task) return res.status(404).json({ success: false })

    task.isDone = !task.isDone
    task.doneAt = task.isDone ? new Date() : null
    await task.save()

    res.json({ success: true, isDone: task.isDone })
  } catch (err) {
    res.status(500).json({ success: false })
  }
})

app.post('/sw-admin/tasks/:id/delete', requireAdminAuth, safe('خطا', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id)
  res.redirect(req.get('Referer') || '/sw-admin')
}))

// ─────────────────────────────────────────
//  ADMIN — REPORTS
// ─────────────────────────────────────────
app.get('/sw-admin/reports', requireAdminAuth, safe('خطا در بارگذاری گزارش‌ها', async (req, res) => {
  const [totalProjects, totalClients, totalInvoices, paidInvoices, totalReviews, revenueResult] = await Promise.all([
    Project.countDocuments(),
    Client.countDocuments(),
    Invoice.countDocuments(),
    Invoice.countDocuments({ status: 'paid' }),
    Review.countDocuments({ isApproved: true }),
    Invoice.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ])
  ])

  res.render('admin/Reports', {
    stats: {
      totalProjects, totalClients, totalInvoices, paidInvoices, totalReviews,
      totalRevenue: revenueResult[0]?.total || 0
    }
  })
}))

// ─────────────────────────────────────────
//  ADMIN — SETTINGS
// ─────────────────────────────────────────
app.get('/sw-admin/settings', requireAdminAuth, safe('خطا در بارگذاری تنظیمات', async (req, res) => {
  const setting = (await Setting.findOne()) || (await Setting.create({}))
  res.render('admin/Settings', { setting })
}))

app.post('/sw-admin/settings', requireAdminAuth, safe('خطا در ذخیره تنظیمات', async (req, res) => {
  const {
    siteName, siteUrl, email, phone, address,
    'social.instagram'   : instagram,
    'social.telegram'    : telegram,
    'social.linkedin'    : linkedin,
    'social.github'      : github,
    'seo.metaTitle'      : metaTitle,
    'seo.metaDescription': metaDescription
  } = req.body

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
}))

// ─────────────────────────────────────────
//  ADMIN — CATEGORIES (AJAX)
// ─────────────────────────────────────────
app.post('/sw-admin/categories/add', requireAdminAuth, async (req, res) => {
  try {
    const { title } = req.body
    if (!title) return res.status(400).json({ error: 'عنوان الزامی است' })

    const category = await Category.create({
      title: title.trim(),
      slug : title.trim().toLowerCase().replace(/\s+/g, '-'),
      type : 'service'
    })
    res.json({ success: true, category })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'خطا در ساخت دسته‌بندی' })
  }
})

app.post('/sw-admin/service-categories/add', requireAdminAuth, async (req, res) => {
  try {
    const { title, type } = req.body
    if (!title || !title.trim()) {
      return res.status(400).json({ ok: false, message: 'عنوان دسته‌بندی الزامی است' })
    }

    const newCategory = await Category.create({ title: title.trim(), type: type || 'service' })

    res.json({
      ok: true,
      category: { _id: newCategory._id, title: newCategory.title, type: newCategory.type }
    })
  } catch (err) {
    console.error('Category create error:', err)
    res.status(500).json({ ok: false, message: 'خطا در ثبت نوع پروژه' })
  }
})

// ─────────────────────────────────────────
//  404 + ERROR HANDLER
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404')
})

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  if (res.headersSent) return next(err)
  res.status(500).send('خطای داخلی سرور')
})

// ─────────────────────────────────────────
//  DB + SERVER START
// ─────────────────────────────────────────
mongoose.connect(DB_URL)
  .then(() => {
    console.log('DB is connected ✅')
    app.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`))
  })
  .catch(err => {
    console.error('DB connection failed ❌', err.message)
    process.exit(1)
  })