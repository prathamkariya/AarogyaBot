# AarogyaBot

AI-powered multilingual health triage for rural India

Live URL: https://aarogyabot.vercel.app

Backend repo: https://github.com/SWAR777/Team-Stetharos-Aetrix-

Frontend repo:(https://github.com/Maahirsoni19/Aetrix)

## Overview

AarogyaBot is a multilingual health triage system for patients, ASHA workers, and admins. The backend accepts symptom descriptions, classifies urgency with Groq-hosted Llama 3.3 70B plus rule-based checks, and returns triage guidance with nearby facilities. The frontend provides a chat interface, ASHA workflow screens, and an admin dashboard for viewing aggregate triage data.

## Problem Statement

Rural patients often reach formal care late because first-line symptom screening and facility navigation are not easily available in local languages. ASHA workers also need a lightweight system that can standardize triage decisions and surface nearby care options quickly.

## Key Features

- Multilingual symptom intake with follow-up questioning
- Rule-based urgency classification: emergency, clinic, or self-care
- Nearby facility lookup using OSRM distance calculations
- Session reset and conversation state management
- Firestore-backed storage for triage sessions and dashboard data
- Admin dashboard for counts and symptom trends
- PDF triage report generation with ReportLab
- Separate flows for public users, ASHA workers, and admins

## Tech Stack

### Frontend

- React.js
- Next.js app structure in the current frontend repo
- Tailwind CSS
- Firebase-related client integration points
- Vercel

### Backend

- Flask
- Groq Llama 3.3 70B
- Firebase Firestore
- OSRM
- ReportLab
- Python

## Local Setup

### Backend

powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt


Create backend\.env and add the variables listed below. Place your Firebase service account file at backend\firebase-key.json.

powershell
cd backend
python app.py


The backend runs on http://localhost:5000.

### Frontend

powershell
cd stetharos-frontend
npm install


Create stetharos-frontend\.env.local and add the variables listed below.

powershell
cd stetharos-frontend
npm run dev


The frontend runs on http://localhost:3000.

## Environment Variables

### backend/.env

env
GROQ_API_KEY=your_groq_api_key


Required file:

text
backend/firebase-key.json


This file should contain a Firebase Admin SDK service account JSON for Firestore access.

### stetharos-frontend/.env.local

env
NEXT_PUBLIC_API_URL=http://localhost:5000


## API Endpoints

### Implemented in backend/app.py

- GET /health - Health check for the Flask service.
- POST /triage - Accepts a symptom message, manages session state, and returns triage output.
- POST /triage/reset - Clears the in-memory conversation state for a session.
- GET /facilities - Returns the nearest facilities for a latitude, longitude, and tier.
- GET /sessions - Lists stored triage session records from Firestore.
- GET /asha-workers - Lists ASHA worker records from Firestore.
- GET /admins - Lists admin records from Firestore.
- GET /stats - Returns aggregate triage counts and top symptoms.
- POST /generate-report - Generates and downloads a PDF triage report.

### Referenced in project requirements but not present in the current Flask app

- POST /rate-asha - Intended to submit a rating for an ASHA worker.
- GET /asha-leaderboard - Intended to return ranked ASHA worker performance data.
- GET /asha-profile - Intended to return profile data for an ASHA worker.

## Notes

- The checked-in frontend calls POST /report, but the current backend implements POST /generate-report.
- The checked-in frontend defaults to http://localhost:5001, while the current backend starts on port 5000.

## Team

Team Stetharos, PDEU

## License

MIT
