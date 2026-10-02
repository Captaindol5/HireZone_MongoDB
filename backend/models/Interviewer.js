import mongoose from 'mongoose';

const interviewerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, default: 'interviewer' },
  stage: { type: String, default: 'all' },
}, { timestamps: true });

export default mongoose.model('Interviewer', interviewerSchema);
