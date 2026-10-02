import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const createUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const usersToCreate = [
      // Interviewers
      { email: 'malan@hirezone.com', password: 'Malan@2690', role: 'Interviewer', name: 'Malan' },
      { email: 'nubaidh@hirezone.com', password: 'Nubaidh@5808', role: 'Interviewer', name: 'Nubaidh' },
      { email: 'disney@hirezone.com', password: 'Disney@2690', role: 'Interviewer', name: 'Disney' },
      { email: 'thulani@hirezone.com', password: 'Thulani@0212', role: 'Interviewer', name: 'Thulani' },
      { email: 'abhi@hirezone.com', password: 'Abhishek@5', role: 'Interviewer', name: 'Abhi' },
      // Managers
      { email: 'sarah@hirezone.com', password: 'Sarah@0212', role: 'Executive Manager', name: 'Sarah' },
      // HR
      { email: 'navinhr@hirezone.com', password: 'Navin@2690', role: 'HR', name: 'Navin' },
      { email: 'naveen@hirezone.com', password: 'Naveen@5808', role: 'HR', name: 'Naveen' }
    ];

    for (const u of usersToCreate) {
      // Check if user already exists
      const exists = await User.findOne({ email: u.email });
      const hashedPassword = await bcrypt.hash(u.password, 10);
      if (!exists) {
        const newUser = new User({
          ...u,
          password: hashedPassword
        });
        await newUser.save();
        console.log(`User created: ${u.email}`);
      } else {
        exists.password = hashedPassword;
        await exists.save();
        console.log(`User updated: ${u.email}`);
      }
    }

    console.log('Finished creating users.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

createUsers();
