const mongoose = require('mongoose');
const User = require('../../models/user.model'); // مسیر مدل خودت

mongoose.connect('mongodb://127.0.0.1:27017/SoulWeb');

async function run() {
  await User.create({
    name: 'Admin',
    email: 'admin@example.com',
    password: '12345678',
    role: 'admin'
  });

  console.log('Admin Created');
  process.exit();
}

run();