# University Examination Management System

An enterprise-grade Examination Timetabling and Invigilator Verification System.

Timetable generation is a **future module** — this repository focuses on the surrounding platform: users, invitations, RBAC, departments, courses, approvals, examinations, attendance (QR), audit logs, and settings.

## Tech Stack

**Frontend:** React 18, Vite, React Router, TailwindCSS, TanStack Query, Axios, React Hook Form, Zod, Lucide, Framer Motion, Socket.IO Client
**Backend:** Node.js, Express, Prisma ORM, PostgreSQL (Neon), JWT, bcrypt, Zod, Helmet, express-rate-limit, Socket.IO
**Database:** PostgreSQL on Neon

## Roles

- **Super Admin** — full control. Cannot self-register. Bootstrap via seed script only.
- **Department Head** — manages department courses.
- **Invigilator** — views assignments, scans attendance QR.

## Repository Layout

```
Time_Table_Web_App/
├── client/     # React + Vite frontend
├── server/     # Express + Prisma backend
└── README.md
```

## Getting Started

### 1. Backend

```powershell
cd server
copy .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, SUPER_ADMIN_* values
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Server runs on `http://localhost:4000`.

### 2. Frontend

```powershell
cd client
copy .env.example .env
npm install
npm run dev
```

Client runs on `http://localhost:5173`.

### 3. First Login

Use the Super Admin email/password you set in `server/.env` before running `npm run seed`.

## Architecture Principles

- Layered backend: `routes → controllers → services → prisma`
- Consistent API response envelope: `{ success, data, error, meta }`
- RBAC enforced on the backend for every protected endpoint; UI hides unauthorized actions but never trusts the client.
- Feature-based frontend folders (`features/*`) for module isolation.
- Zod validation on both sides.
- All secrets in `.env` — never committed.

## Roadmap

- [x] Phase 1 — Scaffolding, auth, RBAC shell
- [x] Phase 2 — Invitations + user activation + approval workflow
- [x] Phase 3 — Faculties, departments, academic years, semesters
- [x] Phase 4 — Courses + approval workflow
- [x] Phase 5 — Examinations, invigilator assignments
- [x] Phase 6 — QR attendance + attendance window + replacements
- [x] Phase 7 — Audit logs UI + reports
- [ ] Phase 8 — Timetable generation algorithm

## Deployment

This project is configured for deployment on multiple platforms:

### 🚀 Fly.io (Recommended - No Spin-Down)

**Quick Start**: See [`QUICK_START_FLY.md`](./QUICK_START_FLY.md) (10 steps, 30 minutes)

**Full Guide**: See [`FLY_DEPLOYMENT.md`](./FLY_DEPLOYMENT.md)

**Checklist**: See [`FLY_CHECKLIST.md`](./FLY_CHECKLIST.md)

**Features**:
- ✅ Always-on backend (no 15-min spin-down)
- ✅ Perfect Socket.IO support
- ✅ Free tier with better uptime
- ✅ GitHub auto-deploy via Actions
- ✅ Works with your existing Neon database

**Files created**:
- `server/fly.toml` - Backend configuration
- `client/fly.toml` - Frontend configuration
- `server/Dockerfile` - Backend Docker config
- `client/Dockerfile` - Frontend Docker config
- `.github/workflows/fly-deploy.yml` - Auto-deploy workflow
- `generate-secrets.ps1` / `generate-secrets.sh` - Secret generators

**Quick Deploy**:
```bash
# Generate secrets
.\generate-secrets.ps1  # Windows
# OR
./generate-secrets.sh   # Mac/Linux

# Install Fly CLI
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Follow QUICK_START_FLY.md for step-by-step guide
```

---

### 🎯 Render (Alternative - Easiest Setup)

**Guide**: See [`DEPLOYMENT.md`](./DEPLOYMENT.md)

**Features**:
- ✅ Easiest setup (Blueprint deployment)
- ✅ Nice dashboard UI
- ✅ Works with Neon database
- ⚠️ Free tier spins down after 15 min idle

**Files included**:
- `render.yaml` - Blueprint configuration (already configured)

**Quick Deploy**:
1. Go to [Render Dashboard](https://dashboard.render.com)
2. New → Blueprint
3. Connect this repository
4. Set environment variables
5. Deploy

---

### 📊 Comparison

| Feature | Fly.io | Render |
|---------|--------|--------|
| **Setup Time** | 30 min | 15 min |
| **Spin-Down** | No (configurable) | Yes (15 min) |
| **Dashboard** | Basic | Excellent |
| **Socket.IO** | Perfect | Works with fallback |
| **Free Tier** | Forever | Forever |
| **Best For** | Production | Quick testing |

---

### Database

Both deployment options use **Neon PostgreSQL** (external managed database):
- Free tier with no 90-day expiration
- Auto-suspend when idle, wakes in ~1s
- Connection pooling included
- Get yours at [neon.tech](https://neon.tech)
