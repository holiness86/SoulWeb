const express    = require('express')
const mongoose   = require('mongoose')
const bcrypt     = require('bcryptjs')
const path       = require('path')
const multer     = require('multer')
const ExcelJS    = require('exceljs')


const app = express()

// ─────────────────────────────────────────
//  MIDDLEWARE
// ─────────────────────────────────────────
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ─────────────────────────────────────────
//  MODELS
// ─────────────────────────────────────────
const User      = require('./models/user.model')
const Client    = require('./models/client.model')
const Project   = require('./models/project.model')
const Invoice   = require('./models/invoice.model')
const Message   = require('./models/message.model')
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
    const portfolio = await Portfolio.find().sort({ order : 1 })
    res.render('index' , { portfolio })
  } catch (err) {
    res.status(500).send('Server Error')
  }
})

// ─────────────────────────────────────────
//  ADMIN — DASHBOARD
// ─────────────────────────────────────────
app.get('/sw-admin', async (req, res) => {
  try {
    const [
      activeProjects,
      totalClients,
      deliveredProjects,
      unreadMessages,
      recentActivities,
      todayTasks
    ] = await Promise.all([
      Project.countDocuments({ status: 'active' }),
      Client.countDocuments({ isActive: true }),
      Project.countDocuments({ status: 'done' }),
      Message.countDocuments({ isRead: false }),
      Activity.find().sort({ createdAt: -1 }).limit(7),
      Task.find().sort({ createdAt: -1 }).limit(7)
    ])

    res.render('admin/Dashboard', {
      stats: {
        activeProjects,
        totalClients,
        deliveredProjects,
        unreadMessages
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
app.get('/sw-admin/projects', async (req, res) => {
  try {
    const { status, search } = req.query

    const filter = {}

    if (status) {
      filter.status = status
    }

    if (search) {
      filter.title = { $regex: search, $options: 'i' }
    }

    const [projects, clients, serviceCategories] = await Promise.all([
      Project.find(filter)
        .populate('client', 'name company')
        .populate('category', 'title slug')
        .sort({ createdAt: -1 })
        .lean(),

      Client.find({ isActive: true })
        .sort({ name: 1 })
        .lean(),

      Category.find({
        type: 'service',
        isActive: true
      })
        .sort({ order: 1 })
        .lean()
    ])

    res.render('admin/Projects', {
      projects,
      clients,
      serviceCategories,
      query: req.query
    })

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

app.post('/sw-admin/projects/:id/update', async (req, res) => {
  try {
    const { title, status, progress, deadline } = req.body
    await Project.findByIdAndUpdate(req.params.id, {
      title,
      status,
      progress: Number(progress),
      deadline: deadline || null
    })
    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در ویرایش پروژه')
  }
})

app.post('/sw-admin/projects/:id/delete', async (req, res) => {
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

app.get('/sw-admin/clients', async (req, res) => {
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







app.post('/sw-admin/clients', async (req, res) => {
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



app.post('/sw-admin/clients/:id/delete', async (req, res) => {
  try {
    await Client.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/clients')
  } catch (err) {
    res.status(500).send('خطا در حذف مشتری')
  }
})

app.get('/sw-admin/clients/export', async (req, res) => {
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
//  ADMIN — MESSAGES
// ─────────────────────────────────────────
app.get('/sw-admin/messages', async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('client', 'name')
      .sort({ createdAt: -1 })
    res.render('admin/Messages', { messages })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری پیام‌ها')
  }
})

app.post('/sw-admin/messages/:id/read', async (req, res) => {
  try {
    await Message.findByIdAndUpdate(req.params.id, { isRead: true })
    res.redirect('/sw-admin/messages')
  } catch (err) {
    res.status(500).send('خطا')
  }
})

app.post('/sw-admin/messages/:id/delete', async (req, res) => {
  try {
    await Message.findByIdAndDelete(req.params.id)
    res.redirect('/sw-admin/messages')
  } catch (err) {
    res.status(500).send('خطا در حذف پیام')
  }
})

// ─────────────────────────────────────────
//  ADMIN — INVOICES
// ─────────────────────────────────────────
app.get('/sw-admin/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('client',  'name company')
      .populate('project', 'title')
      .sort({ createdAt: -1 })
    res.render('admin/Invoices', { invoices })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری فاکتورها')
  }
})

app.post('/sw-admin/invoices', async (req, res) => {
  try {
    // items از فرم به صورت JSON string میاد
    const items = JSON.parse(req.body.items || '[]')
    const lastInvoice = await Invoice.findOne().sort({ createdAt: -1 })
    const lastNum = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.replace('INV-', '')) + 1
      : 1001

    await Invoice.create({
      invoiceNumber: `INV-${lastNum}`,
      client : req.body.client,
      project: req.body.project || null,
      items,
      tax      : Number(req.body.tax)      || 0,
      discount : Number(req.body.discount) || 0,
      dueDate  : req.body.dueDate  || null,
      notes    : req.body.notes    || '',
      currency : req.body.currency || 'IRR',
      createdBy: '000000000000000000000001'
    })

    res.redirect('/sw-admin/invoices')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در ثبت فاکتور')
  }
})

app.post('/sw-admin/invoices/:id/paid', async (req, res) => {
  try {
    await Invoice.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      paidAt: new Date()
    })

    const inv = await Invoice.findById(req.params.id)
    await Activity.create({
      type        : 'invoice_paid',
      title       : `فاکتور #${inv.invoiceNumber} پرداخت شد`,
      icon        : 'bi-receipt-cutoff',
      colorVariant: 'success',
      relatedModel: 'Invoice',
      relatedId   : inv._id
    })

    res.redirect('/sw-admin/invoices')
  } catch (err) {
    res.status(500).send('خطا')
  }
})

// ─────────────────────────────────────────────────────────────
//  PORTFOLIO ROUTES
//  در server.js جایگزین بلوک قبلی portfolio بکن
// ─────────────────────────────────────────────────────────────

// GET — list
app.get('/sw-admin/portfolio', async (req, res) => {
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


// POST — create new
app.post('/sw-admin/portfolio', upload.single('coverImage'), async (req, res) => {
  try {
    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish
    } = req.body

    const coverImage = req.file ? `/uploads/portfolio/${req.file.filename}` : ''

    await Portfolio.create({
      title       : (title || '').trim(),
      description : description || '',
      coverImage  : coverImage,
      category    : category || 'web',
      techStack   : techStack ? techStack.split(',').map(t => t.trim()).filter(Boolean) : [],
      liveUrl     : liveUrl || '',
      client      : client || null,
      isFeatured  : isFeatured === 'on',
      isPublished : publish === '1',
      order       : await Portfolio.countDocuments()
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
app.post('/sw-admin/portfolio/:id/update', upload.single('coverImage'), async (req, res) => {

  try {

    const portfolio = await Portfolio.findById(req.params.id)

    if(!portfolio){
      return res.status(404).send('پروژه پیدا نشد')
    }

    const {
      title, description, category,
      techStack, liveUrl, client, isFeatured, publish
    } = req.body

    const coverImage = req.file
      ? '/uploads/portfolio/' + req.file.filename
      : portfolio.coverImage   // اگر عکس جدید نبود قبلی بماند

    portfolio.title = title.trim()
    portfolio.description = description || ''
    portfolio.coverImage = coverImage
    portfolio.category = category || 'web'
    portfolio.techStack = techStack ? techStack.split(',').map(t=>t.trim()).filter(Boolean) : []
    portfolio.liveUrl = liveUrl || ''
    portfolio.client = client || null
    portfolio.isFeatured = isFeatured === 'on'
    portfolio.isPublished = publish === '1'

    await portfolio.save()

    res.redirect('/sw-admin/portfolio')

  } catch(err){
    console.error(err)
    res.status(500).send('خطا در ویرایش')
  }

})


// POST — publish (toggle draft → published)
app.post('/sw-admin/portfolio/:id/publish', async (req, res) => {
  try {
    await Portfolio.findByIdAndUpdate(req.params.id, { isPublished: true })
    res.redirect('/sw-admin/portfolio')
  } catch (err) {
    console.error(err)
    res.status(500).send('خطا در انتشار')
  }
})

// POST — delete
app.post('/sw-admin/portfolio/:id/delete', async (req, res) => {
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
app.get('/sw-admin/packages', async (req, res) => {
  try {
    const packages = await Package.find().sort({ order: 1 })
    res.render('admin/Packages', { packages })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری پکیج‌ها')
  }
})

app.post('/sw-admin/packages', async (req, res) => {
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
app.get('/sw-admin/reviews', async (req, res) => {
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

app.post('/sw-admin/reviews/:id/approve', async (req, res) => {
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
app.get('/sw-admin/blog', async (req, res) => {
  try {
    const posts = await BlogPost.find()
      .populate('author', 'name')
      .sort({ createdAt: -1 })
    res.render('admin/Blog', { posts })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری وبلاگ')
  }
})

app.post('/sw-admin/blog', async (req, res) => {
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

app.post('/sw-admin/blog/:id/delete', async (req, res) => {
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
app.get('/sw-admin/tasks', async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('project', 'title')
      .sort({ createdAt: -1 })
    res.render('admin/Tasks', { tasks })
  } catch (err) {
    res.status(500).send('خطا')
  }
})

app.post('/sw-admin/tasks', async (req, res) => {
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
app.post('/sw-admin/tasks/:id/toggle', async (req, res) => {
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

app.post('/sw-admin/tasks/:id/delete', async (req, res) => {
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
app.get('/sw-admin/reports', async (req, res) => {
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
app.get('/sw-admin/settings', async (req, res) => {
  try {
    // getOrCreate the singleton
    let setting = await Setting.findOne()
    if (!setting) setting = await Setting.create({})
    res.render('admin/Settings', { setting })
  } catch (err) {
    res.status(500).send('خطا در بارگذاری تنظیمات')
  }
})

app.post('/sw-admin/settings', async (req, res) => {
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
app.post('/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, body } = req.body
    await Message.create({
      senderName : name,
      senderEmail: email,
      senderPhone: phone  || '',
      subject    : subject || '',
      body,
      source     : 'contact_form'
    })

    await Activity.create({
      type        : 'message_received',
      title       : `پیام جدید از ${name}`,
      icon        : 'bi-chat-left-dots-fill',
      colorVariant: 'warning'
    })

    res.json({ success: true, message: 'پیام شما با موفقیت ارسال شد' })
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطا در ارسال پیام' })
  }
})

app.post('/sw-admin/projects/add', async (req, res) => {
  try {
    const {
      title,
      client,
      category,
      startDate,
      deadline,
      techStack,
      description
    } = req.body

    if (!title || !client || !category) {
      return res.status(400).send('نام پروژه، مشتری و نوع پروژه الزامی هستند')
    }

    const normalizeDate = (value) => {
      if (!value) return null

      const date = new Date(value)

      if (Number.isNaN(date.getTime())) {
        return null
      }

      return date
    }

    const normalizeTechStack = (value) => {
      if (!value) return []

      if (Array.isArray(value)) {
        return value
          .map(item => String(item).trim())
          .filter(Boolean)
      }

      return String(value)
        .split(/[,،،·|]/)
        .map(item => item.trim())
        .filter(Boolean)
    }

    await Project.create({
      title: title.trim(),
      client,
      category,
      startDate: normalizeDate(startDate),
      deadline: normalizeDate(deadline),
      techStack: normalizeTechStack(techStack),
      description: description ? description.trim() : '',
      status: 'active',
      progress: 0,
      createdBy: '000000000000000000000001'
    })

    res.redirect('/sw-admin/projects')
  } catch (err) {
    console.error('Project create error:', err)
    res.status(500).send('خطا در ثبت پروژه')
  }
})




// خرجی اکسل پروژه ها
app.get('/sw-admin/projects/export', async (req, res) => {
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
// ─────────────────────────────────────────
//  404
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404')
})