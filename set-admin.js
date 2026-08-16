// این فایل رو کنار پروژه SoulWeb بذار (کنار فایل اصلی سرور)
// مسیر require مدل User رو مطابق ساختار پروژه‌ت اصلاح کن اگه فرق داره
// اجرا: node set-admin.js

const mongoose = require('mongoose');
const User = require('./models/user.model'); // اگه مسیر فرق داره، اینجا اصلاح کن

// ⚠️ آدرس دیتابیس رو مطابق پروژه SoulWeb اصلاح کن
const urlDB = 'mongodb://admin:pM8U6IsnbQBsnGspAg1f@soulwebdb-ttk-service:27017/admin';

async function run() {
    try {
        await mongoose.connect(urlDB);
        console.log('به مونگو وصل شد');

        const email = 'admin@solweb.ir'; // دلخواه، اگه ایمیل دیگه‌ای می‌خوای عوضش کن

        let adminUser = await User.findOne({ email });

        if (!adminUser) {
            adminUser = new User({
                name: 'Arshya',
                email: email,
                password: 'arshya',
                role: 'admin'
            });
            console.log('یوزر ادمین جدید ساخته می‌شه...');
        } else {
            adminUser.password = 'arshya';
            adminUser.role = 'admin';
            console.log('یوزر ادمین موجود آپدیت می‌شه...');
        }

        // save() باعث اجرای pre-save hook و هش‌شدن خودکار پسورد میشه
        await adminUser.save();

        console.log('✅ انجام شد.');
        console.log('ایمیل:', email);
        console.log('پسورد: arshya');
        console.log('هش ذخیره‌شده:', adminUser.password);

    } catch (err) {
        console.error('خطا:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

run();