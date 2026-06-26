const express    = require('express')
const bcrypt     = require('bcryptjs')
const path       = require('path')
const multer     = require('multer')
const ExcelJS    = require('exceljs')
const puppeteer  = require('puppeteer-core')
const ejs        = require('ejs')
const session    = require('express-session');
const mongoose   = require('mongoose')
//---------------------------------------------------
const app = express()
//---------------------------------------------------
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
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

module.exports = app