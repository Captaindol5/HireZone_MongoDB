import {
  sendStageAdvancedEmail,
  sendFeedbackPublishedEmail,
  sendHiredEmail,
  sendRejectedEmail,
} from './emailService';

// The URL of our MongoDB Node.js Backend
const API_URL = 'http://localhost:5000/api';

// Minimum AI score for a self-apply candidate to appear in the HR pipeline
const AI_SCORE_THRESHOLD = 70;

// ── Helper to normalise job data from MongoDB ───────────────────────────────
const normalizeJob = (job) => ({
  id: job._id || job.id,
  title: job.title || 'Untitled role',
  location: job.location || 'Remote',
  type: job.type || 'General',
  status: job.status || 'Active',
  company: job.company || 'HireZone',
  stages: Array.isArray(job.stages) ? job.stages : [],
  candidates: Array.isArray(job.candidates) ? job.candidates : [],
  expiresAt: job.expiresAt || null,
  department: job.department || job.type || 'General',
  questions: Array.isArray(job.questions) ? job.questions : [],
  passingThreshold: typeof job.passingThreshold === 'number' ? job.passingThreshold : 70,
});

const normalizeInterviewer = (person) => ({
  id: person._id || person.id,
  name: person.name || 'Team member',
  role: person.role || 'interviewer',
  stage: person.stage || 'all',
  email: person.email || '',
});

const buildStageId = (stageName) => {
  const base = String(stageName || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return base || `stage-${Date.now()}`;
};

// ── Polling Helper: Replaces Firebase onSnapshot ────────────────────────────
// Calls the API every 3 seconds so the UI stays up-to-date automatically.
const pollData = (endpoint, callback, interval = 3000) => {
  let isMounted = true;

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`);
      if (response.ok) {
        const data = await response.json();
        if (isMounted) callback(data);
      }
    } catch (err) {
      console.warn(`[Polling] Could not reach ${endpoint}:`, err.message);
    }
  };

  fetchData(); // Immediate first fetch
  const timerId = setInterval(fetchData, interval); // Then every 3 seconds

  // Return cleanup function (same API as Firebase unsubscribe)
  return () => {
    isMounted = false;
    clearInterval(timerId);
  };
};

// ── Jobs ────────────────────────────────────────────────────────────────────

export const fetchJobs = async () => {
  const res = await fetch(`${API_URL}/jobs`);
  if (!res.ok) throw new Error('Failed to fetch jobs.');
  const jobs = await res.json();
  return jobs.map(normalizeJob);
};

export const subscribeToJobs = (callback) => {
  return pollData('/jobs', (jobs) => callback(jobs.map(normalizeJob)));
};

export const subscribeToPublicJobs = (callback) => {
  return pollData('/jobs', (jobs) => {
    const publicJobs = jobs
      .filter(j => j.status !== 'Closed')
      .map(j => ({
        ...normalizeJob(j),
        candidates: [], // Strip candidate data for public
      }));
    callback(publicJobs);
  });
};

export const createJob = async ({ title, department, expiresAt, questions, passingThreshold }) => {
  if (!title?.trim()) throw new Error('Job title is required.');
  const res = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title.trim(),
      department: department || 'General',
      type: department || 'General',
      location: 'Remote',
      company: 'HireZone',
      status: 'Active',
      stages: [],
      candidates: [],
      questions: Array.isArray(questions) ? questions : [],
      passingThreshold: typeof passingThreshold === 'number' ? passingThreshold : 70,
      expiresAt: expiresAt || null,
    })
  });
  const saved = await res.json();
  return normalizeJob(saved);
};

export const updateJob = async (jobId, payload) => {
  if (!jobId) throw new Error('Job ID is required.');
  await fetch(`${API_URL}/jobs/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const deleteJob = async (jobId) => {
  if (!jobId) throw new Error('Job ID is required.');
  await fetch(`${API_URL}/jobs/${jobId}`, { method: 'DELETE' });
};

// ── Stages (managed inside Job document) ────────────────────────────────────

export const createStageForJob = async (jobId, { name, interviewerId, passingThreshold }) => {
  if (!jobId) throw new Error('Job ID is required.');
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  const job = await res.json();
  if (!job) throw new Error('Job not found.');

  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Stage name is required.');

  const existingStages = Array.isArray(job.stages) ? job.stages : [];
  const newStage = { id: buildStageId(cleanName), name: cleanName, interviewer: interviewerId || '', passingThreshold: passingThreshold ?? 7 };
  const updatedStages = [...existingStages, newStage];

  await updateJob(jobId, { stages: updatedStages });
  return normalizeJob({ ...job, stages: updatedStages });
};

export const updateStageForJob = async (jobId, stageId, { name, interviewerId, passingThreshold }) => {
  if (!jobId || !stageId) throw new Error('Job and stage are required.');
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  const job = await res.json();
  if (!job) throw new Error('Job not found.');

  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Stage name is required.');

  const stages = (job.stages || []).map(s =>
    s.id === stageId ? { ...s, name: cleanName, interviewer: interviewerId || '', passingThreshold: passingThreshold ?? 7 } : s
  );
  await updateJob(jobId, { stages });
  return normalizeJob({ ...job, stages });
};

export const deleteStageForJob = async (jobId, stageId) => {
  if (!jobId || !stageId) throw new Error('Job and stage are required.');
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  const job = await res.json();
  if (!job) throw new Error('Job not found.');

  const remainingStages = (job.stages || []).filter(s => s.id !== stageId);
  const fallbackStage = remainingStages[0];
  const nextCandidates = (job.candidates || []).map(c =>
    c.stage === stageId
      ? { ...c, stage: fallbackStage?.id || '', stageLabel: fallbackStage?.name || 'Unassigned' }
      : c
  );
  await updateJob(jobId, { stages: remainingStages, candidates: nextCandidates });
  return normalizeJob({ ...job, stages: remainingStages, candidates: nextCandidates });
};

export const assignStageInterviewer = async (jobId, stageId, interviewerId) => {
  if (!jobId) throw new Error('Job is required.');
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  const job = await res.json();
  if (!job) throw new Error('Job not found.');

  const stages = (job.stages || []).map(s => {
    if (stageId && s.id === stageId) return { ...s, interviewer: interviewerId || '' };
    if (s.interviewer === interviewerId) return { ...s, interviewer: '' };
    return s;
  });
  await updateJob(jobId, { stages });
  return normalizeJob({ ...job, stages });
};

export const updateStageAssignment = async (jobId, stageId, interviewerId) => {
  return assignStageInterviewer(jobId, stageId, interviewerId);
};

export const persistJobs = async (jobs) => {
  for (const job of jobs) {
    await updateJob(job.id || job._id, normalizeJob(job));
  }
};

// ── Interviewers ─────────────────────────────────────────────────────────────

export const fetchInterviewers = async () => {
  const res = await fetch(`${API_URL}/interviewers`);
  if (!res.ok) return [];
  const list = await res.json();
  return list.map(normalizeInterviewer);
};

export const subscribeToInterviewers = (callback) => {
  return pollData('/interviewers', (list) => callback(list.map(normalizeInterviewer)));
};

// ── Candidates ───────────────────────────────────────────────────────────────

export const fetchCandidates = async () => {
  const res = await fetch(`${API_URL}/candidates`);
  if (!res.ok) return [];
  return await res.json();
};

export const createCandidateProfile = async ({
  name, email, jobId, stageId,
  cvText = '', cvUrl = '', notes = '',
  source = 'HR portal', aiScore = null, aiSummary = '',
}) => {
  if (!name || !email || !jobId || !stageId) {
    throw new Error('Candidate name, email, job, and stage are required.');
  }
  const res = await fetch(`${API_URL}/candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, jobId, currentStage: stageId, cvText, cvUrl, notes, source, aiScore, aiSummary })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Could not create candidate.');
  }
  return await res.json();
};

export const updateCandidateProfile = async (candidateId, payload) => {
  await fetch(`${API_URL}/candidates/${candidateId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};

export const subscribeToCandidate = (candidateId, callback) => {
  if (!candidateId) return () => {};
  return pollData(`/candidates/${candidateId}`, callback);
};

export const advanceCandidateStage = async (jobId, candidateId, nextStageId) => {
  const res = await fetch(`${API_URL}/candidates/${candidateId}/advance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, nextStageId })
  });

  // Fire stage-advanced email
  try {
    const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
    const job = await jobRes.json();
    const stageInfo = (job.stages || []).find(s => s.id === nextStageId);
    const candidate = (job.candidates || []).find(c => c.id === candidateId);
    if (candidate?.email) {
      sendStageAdvancedEmail({
        candidateName: candidate.name,
        toEmail: candidate.email,
        jobTitle: job.title || 'your role',
        stageName: stageInfo?.name || nextStageId,
      });
    }
  } catch { /* email errors should not block UI */ }

  return res;
};

export const submitCandidateFeedback = async (jobId, candidateId, payload) => {
  await fetch(`${API_URL}/candidates/${candidateId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, payload })
  });

  // Fire feedback-published email
  try {
    const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
    const job = await jobRes.json();
    const candidate = (job.candidates || []).find(c => c.id === candidateId);
    const stageInfo = (job.stages || []).find(s => s.id === candidate?.stage);
    if (candidate?.email) {
      sendFeedbackPublishedEmail({
        candidateName: candidate.name,
        toEmail: candidate.email,
        jobTitle: job.title || 'your role',
        stageName: stageInfo?.name || candidate?.stageLabel || 'Interview',
      });
    }
  } catch { /* email errors should not block UI */ }
};

export const failCandidate = async (jobId, candidateId) => {
  await fetch(`${API_URL}/candidates/${candidateId}/fail`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId })
  });

  // Fire rejection email
  try {
    const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
    const job = await jobRes.json();
    const candidate = (job.candidates || []).find(c => c.id === candidateId);
    if (candidate?.email) {
      sendRejectedEmail({ candidateName: candidate.name, toEmail: candidate.email, jobTitle: job.title || 'the role' });
    }
  } catch { /* email errors should not block UI */ }
};

export const hireCandidate = async (jobId, candidateId, offer = {}) => {
  await fetch(`${API_URL}/candidates/${candidateId}/hire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId, offer })
  });

  // Fire hired email
  try {
    const jobRes = await fetch(`${API_URL}/jobs/${jobId}`);
    const job = await jobRes.json();
    const candidate = (job.candidates || []).find(c => c.id === candidateId);
    if (candidate?.email) {
      sendHiredEmail({
        candidateName: candidate.name,
        toEmail: candidate.email,
        jobTitle: job.title || 'the role',
        startDate: offer.startDate || '',
        offerNotes: offer.offerNotes || '',
      });
    }
  } catch { /* email errors should not block UI */ }
};

// ── Notifications ────────────────────────────────────────────────────────────

export const subscribeToNotifications = (uid, callback) => {
  if (!uid) return () => {};
  return pollData(`/notifications/${uid}`, callback);
};

export const markNotificationRead = async (notifId) => {
  if (!notifId) return;
  await fetch(`${API_URL}/notifications/${notifId}/read`, { method: 'PUT' });
};

export const createNotification = async (recipientUid, message, type = 'general') => {
  if (!recipientUid) return;
  await fetch(`${API_URL}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientUid, message, type })
  });
};

// ── User Profile ─────────────────────────────────────────────────────────────

export const fetchUserProfile = async (uid) => {
  if (!uid) return null;
  try {
    const token = localStorage.getItem('hirezone_token');
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
};

// ── AI Screening Report ──────────────────────────────────────────────────────

export const saveAiReport = async (jobId, candidateId, report) => {
  // Update the candidate's AI report in the job candidates array
  const res = await fetch(`${API_URL}/jobs/${jobId}`);
  const job = await res.json();
  if (job) {
    const updated = (job.candidates || []).map(c =>
      c.id === candidateId ? { ...c, aiReport: report } : c
    );
    await updateJob(jobId, { candidates: updated });
  }
  // Also update the candidate document
  await updateCandidateProfile(candidateId, { aiReport: report });
};
