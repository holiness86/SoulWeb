const express = require('express')
const app = express()
const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

// midellwer
app.set('view engine' , 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({extended: true}))
app.use(express.json())

// listin app & DB conection
const DBurl = "mongodb://localhost:27017/SoulWeb"
const PORT = process.env.PORT || 3000
mongoose.connect(DBurl)
.then(() => {
    console.log('DB is connected ✅')
    app.listen(PORT , () => {
        console.log(`Server running on port ${PORT} 🚀`)
    })
})

// router
app.get('/' , (req , res) => {
    res.render('index')
})

app.get('/sw-admin', (req, res) => {
    res.render('admin/Dashboard')
})

app.get('/sw-admin/projects' , (req , res) => {
    res.render('admin/Projects')
})