# HireZone — AI-Powered Applicant Tracking System (ATS)

[![Vite](https://img.shields.io/badge/Frontend-Vite%20%2B%20React-blue.svg)](https://vitejs.dev/)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green.svg)](https://expressjs.com/)
[![Database](https://img.shields.io/badge/Database-MongoDB-brightgreen.svg)](https://www.mongodb.com/)
[![AI Engine](https://img.shields.io/badge/AI-Google%20Gemini-purple.svg)](https://ai.google.dev/)

HireZone is a modern, enterprise-ready Applicant Tracking System (ATS) designed to streamline end-to-end recruitment workflows. It features live candidate screening powered by Google Gemini AI, dynamic Kanban hiring pipelines with mandatory feedback stage-gates, role-based evaluation portals, and a real-time notification system.

---

## Table of Contents
1. [Core Features](#core-features)
2. [Tech Stack](#tech-stack)
3. [System Architecture](#system-architecture)
4. [Getting Started](#getting-started)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [Directory Structure](#directory-structure)
7. [Scripts Reference](#scripts-reference)

---

## Core Features

- **Public Careers Portal & Application Flow**: Candidate self-service job board with live application forms, resume PDF uploading, and automatic text extraction.
- **Automated AI Resume Screening**: Integration with Google Gemini AI to analyze candidate resumes against job descriptions, calculate fit scores, and provide unbiased evaluation summaries.
- **Kanban Pipeline & Stage-Gates**: Visual recruitment board for HR managers with strict business logic — preventing candidates from advancing without submitted interviewer feedback.
- **Interviewer Evaluation Portal**: Structured candidate queues and scorecards allowing interviewers to score candidates (1–10) and record qualitative assessments.
- **Executive Analytics Dashboard**: High-level comparison matrices, hiring funnel conversion metrics, and candidate distribution breakdowns.
- **Real-Time Notification System**: Instant notification dispatch upon feedback submission or candidate application, with unread badge counters and one-click read clearing.

---

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | React 19, React Router v7 |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS, Lucide React Icons |
| **Authentication** | Firebase Authentication |
| **Backend API** | Node.js, Express 5 |
| **Database** | MongoDB (local), Mongoose ODM |
| **AI Evaluation Engine** | Google Gemini Generative AI SDK (`@google/generative-ai`) |
| **Document Processing** | `pdfjs-dist` (client-side PDF text extraction) |
| **Email Notifications** | EmailJS (`@emailjs/browser`) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   React Frontend (Vite)              │
│   Firebase Auth  ──►  JWT Token  ──►  Express API   │
└────────────────────────┬────────────────────────────┘
                         │ REST API (port 5000)
┌────────────────────────▼────────────────────────────┐
│              Node.js + Express Backend               │
│   Routes: /api/auth  /api/jobs  /api/candidates     │
│           /api/notifications  /api/interviewers     │
└────────────────────────┬────────────────────────────┘
                         │ Mongoose ODM
┌────────────────────────▼────────────────────────────┐
│                  MongoDB Database                    │
│  Collections: users, jobs, candidates,              │
│               interviewers, notifications           │
└─────────────────────────────────────────────────────┘
```

---

## Getting Started

### Prerequisites
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 9.0.0`
- **MongoDB**: Running locally on `mongodb://localhost:27017`

### 1. Clone and Install Frontend Dependencies

```bash
git clone https://github.com/Captaindol5/HireZone_MongoDB.git
cd HireZone_MongoDB
npm install
```

### 2. Configure Frontend Environment Variables

Create a `.env` file in the root directory:

```env
# Google Gemini AI (for AI resume screening)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# EmailJS (for automated email notifications)
VITE_EMAILJS_SERVICE_ID=your_emailjs_service_id
VITE_EMAILJS_PUBLIC_KEY=your_emailjs_public_key
VITE_EMAILJS_TEMPLATE_ID=your_emailjs_template_id
```

### 3. Install and Configure Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hirezone
JWT_SECRET=your_jwt_secret_key
```

### 4. Seed the Database (First Time Setup)

Run the user creation script to populate initial HR, Interviewer, and Manager accounts:

```bash
cd backend
node createUsers.js
```

### 5. Start the Backend Server

```bash
cd backend
node server.js
```

The API will be accessible at: `http://localhost:5000`

### 6. Start the Frontend Development Server

In a new terminal from the project root:

```bash
npm run dev
```

The application will be accessible at: `http://localhost:5173`

---

## Role-Based Access Control (RBAC)

HireZone enforces route-level authentication guards via Firebase Auth tokens validated against the MongoDB User collection.

| Role | Landing Route | Responsibilities |
| :--- | :--- | :--- |
| **HR / Hiring Manager** | `/portal/hr` | Manage Kanban stages, advance candidates, oversee jobs |
| **Interviewer** | `/portal/interviewer` | Review assigned candidates, view AI summary, submit scorecards |
| **Executive Manager** | `/portal/analytics` | View hiring funnel, conversion rates, and executive reports |
| **Candidate (Public)** | `/careers` | Discover listings, submit resume PDF, view confirmation |

---

## Directory Structure

```
HireZone_MongoDB/
├── backend/                    # Node.js + Express REST API
│   ├── models/
│   │   ├── Candidate.js        # Mongoose schema for candidates
│   │   ├── Interviewer.js      # Mongoose schema for interviewers
│   │   ├── Job.js              # Mongoose schema for jobs
│   │   ├── Notification.js     # Mongoose schema for notifications
│   │   └── User.js             # Mongoose schema for users
│   ├── createUsers.js          # Script to seed initial user accounts
│   ├── syncInterviewers.js     # Script to sync interviewers collection
│   ├── server.js               # Main Express server & API routes
│   └── package.json
├── public/                     # Static assets and icons
├── scripts/
│   └── cleanupDb.js            # Database cleanup utility
├── src/
│   ├── components/             # Reusable UI components (Navbar, Modals, etc.)
│   ├── context/                # React context (AuthContext)
│   ├── firebase/               # Firebase SDK configuration (Auth only)
│   ├── pages/
│   │   ├── portals/            # Role-specific portals (HR, Interviewer, Manager)
│   │   ├── CareersPage.jsx     # Public careers listing
│   │   ├── JobApplicationPage.jsx  # Candidate application & PDF upload
│   │   ├── LandingPage.jsx     # Public landing page
│   │   └── LoginPage.jsx       # Multi-role authentication page
│   ├── services/               # API service layer (data fetching)
│   └── App.jsx                 # Route definitions and ProtectedRoute guards
├── .env.example                # Environment variable template
├── index.html
├── package.json
└── vite.config.js
```

---

## Scripts Reference

### Frontend (run from project root)
| Command | Action |
| :--- | :--- |
| `npm run dev` | Launch Vite development server on port 5173 |
| `npm run build` | Compile production bundle to `dist/` |
| `npm run lint` | Execute ESLint checks across codebase |

### Backend (run from `backend/` directory)
| Command | Action |
| :--- | :--- |
| `node server.js` | Start the Express API server on port 5000 |
| `node createUsers.js` | Seed initial user accounts into MongoDB |
| `node syncInterviewers.js` | Sync interviewer records between collections |
