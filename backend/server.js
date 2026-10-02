import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import Job from './models/Job.js';
import User from './models/User.js';
import Candidate from './models/Candidate.js';
import Interviewer from './models/Interviewer.js';
import Notification from './models/Notification.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hirezone_jwt_secret_2026';

app.use(cors());
app.use(express.json());

// ── MongoDB Connection ──────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(' Connected to MongoDB successfully!'))
  .catch((err) => console.error(' MongoDB connection error:', err));

// ── AUTH ROUTES ─────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'No account found with this email.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password.' });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user._id, email: user.email, role: user.role, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Verify token and get logged-in user
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided.' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: user._id, email: user.email, role: user.role, name: user.name });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

// ── JOB ROUTES ──────────────────────────────────────────────────────────────
app.get('/api/jobs', async (req, res) => {
  try {
    const now = new Date();
    // Auto-delete expired jobs
    await Job.deleteMany({ expiresAt: { $lt: now } });
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const job = new Job(req.body);
    const saved = await job.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const updated = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Job not found.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    // Also remove all candidates for this job
    await Candidate.deleteMany({ jobId: req.params.id });
    res.json({ message: 'Job and associated candidates deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CANDIDATE ROUTES ─────────────────────────────────────────────────────────
app.get('/api/candidates', async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/candidates/:id', async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
    res.json(candidate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/candidates/:id', async (req, res) => {
  try {
    const updated = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: 'Candidate not found.' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/candidates', async (req, res) => {
  try {
    const AI_SCORE_THRESHOLD = 70;
    const { name, email, jobId, currentStage, cvText, cvUrl, notes, source, aiScore, aiSummary, password } = req.body;

    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const pwd = password || 'Welcome@123';
      const hashed = await bcrypt.hash(pwd, 10);
      user = new User({ name, email: email.toLowerCase(), password: hashed, role: 'Candidate' });
      await user.save();
    }

    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const stageName = (job.stages || []).find(s => s.id === currentStage)?.name || currentStage;
    const passingThreshold = job.passingThreshold || AI_SCORE_THRESHOLD;
    const selfApply = source === 'self-apply';
    const passedScreening = !selfApply || aiScore === null || aiScore === undefined || Number(aiScore) >= passingThreshold;

    const candidateStatus = passedScreening && selfApply ? 'Applied' : (selfApply ? 'Screened Out' : 'Applied');

    const candidate = new Candidate({
      name, email, jobId, currentStage, cvText, cvUrl, notes, source,
      aiScore, aiSummary, stageLabel: stageName, status: candidateStatus
    });
    const saved = await candidate.save();

    // Add candidate to the job's candidates array
    if (passedScreening) {
      job.candidates = [...(job.candidates || []), {
        id: saved._id.toString(),
        name, email,
        stage: currentStage,
        stageLabel: stageName,
        status: candidateStatus,
        hasSubmittedFeedback: false,
        score: 0, feedback: '',
        cvText: cvText || '', cvUrl: cvUrl || '',
        notes: notes || '', source,
        aiScore: aiScore || null,
        aiSummary: aiSummary || '',
        createdAt: Date.now()
      }];
      await job.save();
    }

    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Advance candidate to next stage
app.post('/api/candidates/:id/advance', async (req, res) => {
  try {
    const { jobId, nextStageId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const stageInfo = (job.stages || []).find(s => s.id === nextStageId);
    job.candidates = (job.candidates || []).map(c => {
      if (c.id !== req.params.id) return c;
      const newHistory = [...(c.feedbackHistory || [])];
      if (c.hasSubmittedFeedback) {
        newHistory.push({ stageId: c.stage, stageName: c.stageLabel, score: c.score, feedback: c.feedback, date: Date.now() });
      }
      return { ...c, stage: nextStageId, stageLabel: stageInfo?.name || nextStageId, status: 'Pending', hasSubmittedFeedback: false, score: 0, feedback: '', feedbackHistory: newHistory };
    });
    await job.save();

    await Candidate.findByIdAndUpdate(req.params.id, { currentStage: nextStageId, status: 'Pending', hasSubmittedFeedback: false });

    // Notifications
    const candidateDoc = await Candidate.findById(req.params.id);
    if (candidateDoc) {
      const candUser = await User.findOne({ email: candidateDoc.email.toLowerCase() });
      if (candUser) {
        await new Notification({ recipientUid: candUser._id.toString(), message: `You have been advanced to ${stageInfo?.name || nextStageId}`, type: 'stage_advanced' }).save();
      }
    }
    if (stageInfo?.interviewer) {
      await new Notification({ recipientUid: stageInfo.interviewer, message: `New candidate advanced to your stage: ${stageInfo.name}`, type: 'stage_advanced' }).save();
    }

    res.json({ message: 'Candidate advanced successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Submit interviewer feedback
app.post('/api/candidates/:id/feedback', async (req, res) => {
  try {
    const { jobId, payload } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    job.candidates = (job.candidates || []).map(c =>
      c.id === req.params.id ? { ...c, ...payload, hasSubmittedFeedback: true } : c
    );
    await job.save();

    // Notifications
    const hrUsers = await User.find({ role: 'HR' });
    const candidateDoc = await Candidate.findById(req.params.id);
    const msg = `Feedback submitted for candidate ${candidateDoc?.name || 'unknown'}`;
    for (const hr of hrUsers) {
      await new Notification({ recipientUid: hr._id.toString(), message: msg, type: 'feedback_ready' }).save();
    }
    if (candidateDoc) {
      const candUser = await User.findOne({ email: candidateDoc.email.toLowerCase() });
      if (candUser) {
        await new Notification({ recipientUid: candUser._id.toString(), message: `Feedback has been submitted for your recent interview.`, type: 'feedback_ready' }).save();
      }
    }

    res.json({ message: 'Feedback submitted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fail a candidate
app.post('/api/candidates/:id/fail', async (req, res) => {
  try {
    const { jobId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    job.candidates = (job.candidates || []).map(c =>
      c.id === req.params.id ? { ...c, status: 'Failed' } : c
    );
    await job.save();
    await Candidate.findByIdAndUpdate(req.params.id, { status: 'Failed' });

    // Notifications
    const candidateDoc = await Candidate.findById(req.params.id);
    if (candidateDoc) {
      const candUser = await User.findOne({ email: candidateDoc.email.toLowerCase() });
      if (candUser) {
        await new Notification({ recipientUid: candUser._id.toString(), message: `An update regarding your application for ${job.title}`, type: 'application_update' }).save();
      }
    }

    res.json({ message: 'Candidate marked as failed.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Hire a candidate
app.post('/api/candidates/:id/hire', async (req, res) => {
  try {
    const { jobId, offer } = req.body;
    const job = await Job.findById(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    const now = Date.now();
    job.candidates = (job.candidates || []).map(c =>
      c.id === req.params.id ? { ...c, status: 'Hired', hiredAt: now, offer } : c
    );
    await job.save();
    await Candidate.findByIdAndUpdate(req.params.id, { status: 'Hired', offer });

    // Notifications
    const candidateDoc = await Candidate.findById(req.params.id);
    if (candidateDoc) {
      const candUser = await User.findOne({ email: candidateDoc.email.toLowerCase() });
      if (candUser) {
        await new Notification({ recipientUid: candUser._id.toString(), message: `Congratulations! You have been hired for ${job.title}.`, type: 'hired' }).save();
      }
    }

    res.json({ message: 'Candidate hired successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── INTERVIEWER ROUTES ───────────────────────────────────────────────────────
app.get('/api/interviewers', async (req, res) => {
  try {
    const interviewers = await Interviewer.find().sort({ createdAt: -1 });
    res.json(interviewers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/interviewers', async (req, res) => {
  try {
    const interviewer = new Interviewer(req.body);
    const saved = await interviewer.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/interviewers/:id', async (req, res) => {
  try {
    await Interviewer.findByIdAndDelete(req.params.id);
    res.json({ message: 'Interviewer deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync interviewers from User collection (role='Interviewer') into Interviewer collection
app.post('/api/interviewers/sync', async (req, res) => {
  try {
    const interviewerUsers = await User.find({ role: 'Interviewer' });
    let created = 0;
    for (const u of interviewerUsers) {
      const exists = await Interviewer.findOne({ email: u.email });
      if (!exists) {
        await new Interviewer({ name: u.name, email: u.email, role: 'interviewer', stage: 'all' }).save();
        created++;
      }
    }
    const all = await Interviewer.find().sort({ createdAt: -1 });
    res.json({ message: `Synced. ${created} new interviewer(s) added.`, interviewers: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── NOTIFICATION ROUTES ──────────────────────────────────────────────────────
app.get('/api/notifications/:uid', async (req, res) => {
  try {
    const notifs = await Notification.find({ recipientUid: req.params.uid }).sort({ createdAt: -1 });
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    if (!req.body.recipientUid) return res.status(200).json({ skipped: true });
    const notif = new Notification(req.body);
    await notif.save();
    res.status(201).json(notif);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 HireZone API running on http://localhost:${PORT}`);
});
