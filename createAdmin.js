require('dotenv').config();
const readline = require('readline');
const mongoose = require('mongoose');
const Admin = require('./src/models/Admin');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

const run = async () => {
  console.log('\n=======================================');
  console.log('   NEURAVIA - CREATE ADMIN SCRIPT   ');
  console.log('=======================================\n');

  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/neuravia';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const name = (await askQuestion('Enter Admin Name (default: Admin): ')).trim() || 'Admin';
    let email = '';
    while (!email || !email.includes('@')) {
      email = (await askQuestion('Enter Admin Email (e.g. admin@neuravia.in): ')).trim().toLowerCase();
      if (!email.includes('@')) {
        console.log('❌ Please enter a valid email address.');
      }
    }

    let password = '';
    while (!password || password.length < 6) {
      password = (await askQuestion('Enter Admin Password (min 6 characters): ')).trim();
      if (password.length < 6) {
        console.log('❌ Password must be at least 6 characters.');
      }
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      console.log(`\n⚠️  Admin with email ${email} already exists! Updating password...`);
      existingAdmin.name = name;
      existingAdmin.password = password;
      await existingAdmin.save();
      console.log('\n🎉 Admin updated successfully!');
    } else {
      const newAdmin = new Admin({
        name,
        email,
        password,
        role: 'superadmin'
      });
      await newAdmin.save();
      console.log('\n🎉 New Admin created successfully!');
    }

    console.log(`\n🔑 Login Credentials:`);
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Panel:    http://localhost:5173/login\n`);

  } catch (error) {
    console.error('\n❌ Error creating admin:', error.message);
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();
