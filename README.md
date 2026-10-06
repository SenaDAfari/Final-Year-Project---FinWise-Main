# FinWise - AI Personal Financial Advisory System for Ghanaian University Students

## Overview
FinWise is a web-based MVP that helps Ghanaian university students manage their finances with AI-powered advice. Features include user authentication, onboarding, expense tracking, dashboard with charts, AI financial advisor chat, and savings goals tracking.

**Tech Stack:**
- Frontend: React.js, Chart.js, Axios, React Router
- Backend: Python Flask, Firebase Admin SDK
- Database: Firebase Firestore
- Auth: Firebase Authentication
- AI: OpenAI API

**Color Scheme:**
- Primary: #0A2E1A (deep forest green)
- Accent: #F4B942 (gold)
- Background: #F7F9F7 (off-white)
- Cards: #FFFFFF (white)

## Project Structure
```
finwise/
├── frontend/          # React app
├── backend/           # Flask API
└── README.md          # This file
```

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- Python 3.8+
- Firebase account (create project at console.firebase.google.com)
- OpenAI API key (from platform.openai.com)

### 2. Firebase Setup
1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Go to Project Settings > Service Accounts > Generate new private key (JSON)
5. Save as `backend/firebase-service-account.json`
6. Get web config (for frontend) from Project Settings > General > Your apps > Web app config

### 3. Backend Setup
```bash
cd backend
pip install -r requirements.txt
# Add your OpenAI API key to .env
cp .env.example .env
python app.py
```
Backend runs on http://localhost:5000

### 4. Frontend Setup
```bash
cd frontend
npm install
# Add Firebase config to src/config/firebase.js
npm start
```
Frontend runs on http://localhost:3000

### 5. Environment Variables (backend/.env)
```
OPENAI_API_KEY=your_openai_api_key_here
FLASK_ENV=development
```

### 6. Firebase Collections
- `users`: user profiles, onboarding data
- `expenses/{userId}`: expense logs
- `savings/{userId}`: savings deposits

### 7. API Endpoints
- `POST /api/register`
- `POST /api/login`
- `POST /api/onboarding`
- `GET /api/dashboard/:userId`
- `POST /api/expenses`
- `GET /api/expenses/:userId`
- `POST /api/ai-tip/:userId`
- `POST /api/ai-chat/:userId`
- `POST /api/savings-deposit/:userId`

## Ghanaian Universities Dropdown
- University of Ghana (UG)
- Kwame Nkrumah University of Science and Technology (KNUST)
- University of Cape Coast (UCC)
- Ashesi University
- Ghana Institute of Management and Public Administration (GIMPA)
- African University College of Communications (AUCC)

## Running the App
1. Start backend: `cd backend && python app.py`
2. Start frontend: `cd frontend && npm start`
3. Open http://localhost:3000
