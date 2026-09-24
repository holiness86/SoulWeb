// createAdmin.js
const mongoose = require('mongoose');
const User = require('./models/user.model'); // مسیر فایل مدلت رو درست کن

const MONGO_URI = 'mongodb://admin:pM8U6IsnbQBsnGspAg1f@soulwebdb-ttk-service:27017/soulwebdb'; // اسم دیتابیس درست رو بذار

async function main() {
  await mongoose.connect(MONGO_URI);

  const admin = await User.create({
    name: 'Arshya',
    email: 'admin@soulweb.com',   // ایمیل دلخواه خودتو بذار
    password: '1234', // پسورد ساده - خودش هش میشه
    role: 'admin'
  });

  console.log('ساخته شد:', admin);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('خطا:', err);
  process.exit(1);
});