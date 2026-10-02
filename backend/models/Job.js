import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  department: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'Full-time',
  },
  status: {
    type: String,
    enum: ['Active', 'Closed', 'Draft'],
    default: 'Active',
  },
  questions: [{
    type: String,
  }],
  passingThreshold: {
    type: Number,
    default: 70,
  },
  expiresAt: {
    type: Date,
  },
  company: { type: String, default: 'HireZone' },
  location: { type: String, default: 'Remote' },
  stages: { type: Array, default: [] },
  candidates: { type: Array, default: [] },
}, { timestamps: true });

export default mongoose.model('Job', jobSchema);
