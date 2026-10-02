import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Interviewer from './models/Interviewer.js';

dotenv.config();

const syncInterviewers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const interviewerUsers = await User.find({ role: 'Interviewer' });
    console.log(`Found ${interviewerUsers.length} interviewer user(s) in User collection.`);

    let created = 0;
    let skipped = 0;

    for (const u of interviewerUsers) {
      const exists = await Interviewer.findOne({ email: u.email });
      if (!exists) {
        await new Interviewer({
          name: u.name,
          email: u.email,
          role: 'interviewer',
          stage: 'all',
        }).save();
        console.log(`  ✅ Created interviewer: ${u.name} (${u.email})`);
        created++;
      } else {
        console.log(`  ⏭️  Already exists: ${u.email}`);
        skipped++;
      }
    }

    console.log(`\nDone! ${created} created, ${skipped} skipped.`);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

syncInterviewers();
