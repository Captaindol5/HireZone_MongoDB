import mongoose from 'mongoose';

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  jobId: { type: String, required: true },
  currentStage: { type: String },
  status: { type: String, default: 'Applied' },
  cvText: { type: String },
  cvUrl: { type: String },
  notes: { type: String },
  source: { type: String },
  hasSubmittedFeedback: { type: Boolean, default: false },
  stageLabel: { type: String },
  aiScore: { type: Number },
  aiSummary: { type: String },
  feedbackHistory: { type: Array, default: [] }
}, { timestamps: true });

export default mongoose.model('Candidate', candidateSchema);
