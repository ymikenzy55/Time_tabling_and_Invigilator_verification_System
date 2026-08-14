# Deploying to Render

This guide covers deploying the full stack (PostgreSQL + Express API + React client) to Render using the included `render.yaml` blueprint.

## Prerequisites

- A [Render](https://render.com) account
- This repo pushed to GitHub

## Option A — Blueprint (recommended)

1. Go to **Render Dashboard → New → Blueprint**.
2. Select this GitHub repository.
3. Render detects `render.yaml` and creates three resources:
   - **PostgreSQL** database (`exam-management-db`)
   - **Web Service** for the server (`exam-management-server`)
   - **Static Site** for the client (`exam-management-client`)
4. Before clicking **Apply**, set the secret env vars (the ones marked `sync: false` in `render.yaml`):

   | Variable | Example |
   |---|---|
   | `JWT_SECRET` | a random 32+ char string |
   | `QR_SIGNING_SECRET` | a random 32+ char string |
   | `SUPER_ADMIN_EMAIL` | `admin@example.edu` |
   | `SUPER_ADMIN_PASSWORD` | a strong password (min 8 chars) |
   | `SUPER_ADMIN_NAME` | `System Administrator` |
   | `SUPER_ADMIN_STAFF_ID` | `SA-0001` |
   | `SMTP_HOST` | (optional, e.g. `smtp.gmail.com`) |
   | `SMTP_USER` | (optional) |
   | `SMTP_PASS` | (optional) |
   | `SMTP_FROM` | (optional, e.g. `"Exams <noreply@example.edu>"`) |

5. Click **Apply**. Render provisions the DB, builds the server and client, and deploys.

## Option B — Manual setup

### 1. Create the PostgreSQL database
- Dashboard → **New → PostgreSQL**
- Name: `exam-management-db`
- Plan: Free
- Save the **Internal Database URL** — you'll use it for `DATABASE_URL`.

### 2. Create the server (Web Service)
- Dashboard → **New → Web Service**
- Connect this repo
- **Root Directory:** `server`
- **Runtime:** Node
- **Build Command:** `npm install && npx prisma generate`
- **Start Command:** `npx prisma migrate deploy && npm start`
- **Environment Variables:**

  | Key | Value |
  |---|---|
  | `NODE_ENV` | `production` |
  | `PORT` | `4000` |
  | `DATABASE_URL` | *(Internal DB URL from step 1)* |
  | `JWT_SECRET` | *(random 32+ chars)* |
  | `QR_SIGNING_SECRET` | *(random 32+ chars)* |
  | `CLIENT_ORIGIN` | `https://your-client-name.onrender.com` |
  | `SUPER_ADMIN_EMAIL` | `admin@example.edu` |
  | `SUPER_ADMIN_PASSWORD` | *(strong password)* |
  | `SUPER_ADMIN_NAME` | `System Administrator` |
  | `SUPER_ADMIN_STAFF_ID` | `SA-0001` |

### 3. Create the client (Static Site)
- Dashboard → **New → Static Site**
- Connect this repo
- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:**

  | Key | Value |
  |---|---|
  | `VITE_API_BASE_URL` | `https://your-server-name.onrender.com/api/v1` |

- **Redirects/Rewrites:** Add a rewrite rule `/* → /index.html` (for SPA routing).

### 4. Update CORS
After both services are deployed, update the server's `CLIENT_ORIGIN` env var to match the actual client URL Render assigned (e.g. `https://exam-management-client.onrender.com`).

## Post-Deploy

1. **Run the seed** to create the first Super Admin:
   - In the Render dashboard, open the server web service → **Shell**.
   - Run: `npm run seed`
   - This creates the Super Admin from the `SUPER_ADMIN_*` env vars.

2. **Verify health:**
   - Visit `https://your-server-name.onrender.com/api/v1/health` — should return `{"success":true,"data":{"status":"ok"}}`.

3. **Log in** at the client URL with the Super Admin credentials.

## Notes

- **Free plan limitations:** Web services spin down after 15 min of inactivity (first request after spin-down takes ~30s). PostgreSQL free tier expires after 90 days.
- **WebSockets (Socket.IO):** Supported on Render's paid plans. On the free plan, WebSocket connections may be interrupted during spin-down cycles.
- **Custom domains:** Add via Render dashboard → Settings → Custom Domains.
