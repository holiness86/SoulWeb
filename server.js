const express = require('express')
const app = express()


// midellwer
app.set('view engine' , 'ejs')
app.use(express.static('public'))
app.use(express.urlencoded({extended: true}))
app.use(express.json())

// listin app
app.listen(3000 , () => {
    console.log('server is runing ...');
})


app.get('/' , (req , res) => {
    res.render('index')
})