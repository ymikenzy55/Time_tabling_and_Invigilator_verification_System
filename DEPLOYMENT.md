# Deploying to Render (with Neon PostgreSQL)

This guide covers deploying the full stack to Render, using **Neon** for the
database instead of Render's managed PostgreSQL (Render's free database is
deleted after 90 days; Neon's free tier has no such expiry).

## Architecture

| Component | Platform | Free tier notes |
|---|---|---|
| Frontend (React/Vite) | Render **Static Site** | Always on, CDN-served |
| Backend (Express + Socket.IO) | Render **Web Service** | Spins down after 15 min idle |
| Database (PostgreSQL) | **Neon** | Auto-suspends, wakes in ~1s |

## Prerequisites

- A [Render](https://render.com) account
- A [Neon](https://neon.tech) account
- This repo pushed to GitHub

## No third-party API keys required

There are **no external client IDs or API keys** in this project. QR codes are
signed JWTs using your own `QR_SIGNING_SECRET`, and QR scanning uses the
browser's built-in camera API. The only optional external credential is SMTP.

---

## Step 1 — Create the Neon database

1. Sign in at [neon.tech](https://neon.tech) → **New Project**.
2. Name it `exam-management`. Pick the region closest to your Render region
   (Render's Frankfurt → Neon `eu-central-1`, Render's Oregon → `us-west-2`).
3. Open **Connection Details** and copy the **Pooled connection** string:

   ```
   postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```

   Use the **pooled** (`-pooler`) host — it handles many short-lived connections
   far better than the direct host.

4. Save this string. It becomes `DATABASE_URL`.

> The app appends `connection_limit=20&pool_timeout=30` to this URL
> automatically (see `server/src/utils/prisma.js`), so you don't need to add
> pool parameters yourself.

---

## Step 2 — Generate your secrets

You need two random strings, each at least 16 characters:

```bash
openssl rand -hex 32   # run twice
```

On Windows PowerShell:

```powershell
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
```

Use one for `JWT_SECRET` and the other for `QR_SIGNING_SECRET`.

> Keep `QR_SIGNING_SECRET` stable. Rotating it invalidates every printed venue
> QR code, because those tokens are signed with it.

---

## Step 3 — Deploy via Blueprint (recommended)

1. Go to **Render Dashboard → New → Blueprint**.
2. Select this GitHub repository. Render reads `render.yaml` and creates:
   - **Web Service** for the server (`exam-management-server`)
   - **Static Site** for the client (`exam-management-client`)
3. Before clicking **Apply**, fill in the variables marked `sync: false`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon pooled connection string from Step 1 |
   | `JWT_SECRET` | random 32+ char string from Step 2 |
   | `QR_SIGNING_SECRET` | random 32+ char string from Step 2 |
   | `SUPER_ADMIN_EMAIL` | `admin@example.edu` |
   | `SUPER_ADMIN_PASSWORD` | strong password (min 8 chars) |
   | `SUPER_ADMIN_NAME` | `System Administrator` |
   | `SUPER_ADMIN_STAFF_ID` | `SA-0001` |
   | `SMTP_HOST` | *(optional, e.g. `smtp.gmail.com`)* |
   | `SMTP_USER` | *(optional)* |
   | `SMTP_PASS` | *(optional — Gmail App Password, not your login password)* |
   | `SMTP_FROM` | *(optional, e.g. `"Exams <noreply@example.edu>"`)* |

4. Click **Apply**. Render builds and deploys both services.
5. Once deployed, note the two URLs Render assigned, then continue to Step 5 to
   reconcile them.

## Step 4 — Manual setup (alternative to the Blueprint)

### 4a. Create the server (Web Service)
- Dashboard → **New → Web Service**
- Connect this repo
- **Root Directory:** `server`
- **Runtime:** Node
- **Build Command:** `npm install && npx prisma generate`
- **Start Command:** `npx prisma migrate deploy && npm start`
- **Health Check Path:** `/api/v1/health`
- **Environment Variables:**

  | Key | Value |
  |---|---|
  | `NODE_ENV` | `production` |
  | `PORT` | `4000` |
  | `DATABASE_URL` | *(Neon pooled URL from Step 1)* |
  | `JWT_SECRET` | *(random 32+ chars)* |
  | `QR_SIGNING_SECRET` | *(random 32+ chars)* |
  | `CLIENT_ORIGIN` | `https://your-client-name.onrender.com` |
  | `SUPER_ADMIN_EMAIL` | `admin@example.edu` |
  | `SUPER_ADMIN_PASSWORD` | *(strong password)* |
  | `SUPER_ADMIN_NAME` | `System Administrator` |
  | `SUPER_ADMIN_STAFF_ID` | `SA-0001` |

### 4b. Create the client (Static Site)
- Dashboard → **New → Static Site**
- Connect this repo
- **Root Directory:** `client`
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- **Environment Variables:**

  | Key | Value |
  |---|---|
  | `VITE_API_BASE_URL` | `https://your-server-name.onrender.com/api/v1` |

- **Redirects/Rewrites:** add a **Rewrite** rule `/*` → `/index.html` for SPA routing.

---

## Step 5 — Reconcile the two URLs

Render assigns the real URLs only after the first deploy, so the placeholders in
`render.yaml` will usually be wrong. Fix both sides:

1. **Server** → Environment → set `CLIENT_ORIGIN` to the static site URL
   (e.g. `https://exam-management-client.onrender.com`). Save — this restarts
   the service.
2. **Static site** → Environment → set `VITE_API_BASE_URL` to the server URL
   **including `/api/v1`**, then trigger **Manual Deploy → Clear build cache &
   deploy**.

> `VITE_API_BASE_URL` is inlined into the JavaScript bundle at **build time**.
> Changing it requires a **rebuild**, not just a restart.

### Multiple origins

`CLIENT_ORIGIN` accepts a comma-separated list, which is useful once you add a
custom domain:

```
CLIENT_ORIGIN=https://exam-management-client.onrender.com,https://exams.uenr.edu.gh
```

The **first** entry is treated as the canonical public URL and is used to build
QR-code scan links and password-reset emails. Put your preferred domain first.

---

## Step 6 — Seed the first Super Admin

Migrations run automatically on every deploy via `prisma migrate deploy` in the
start command. Seeding is a one-time manual step:

1. Open the server web service → **Shell** tab.
2. Run:
   ```bash
   npm run seed
   ```
3. This creates the Super Admin from the `SUPER_ADMIN_*` variables.

> The Shell tab requires the service to be awake. If it's spun down, hit the
> health endpoint first to wake it.

---

## Step 7 — Verify

| Check | How |
|---|---|
| **API health** | Visit `https://your-server.onrender.com/api/v1/health` → `{"success":true,"data":{"status":"ok"}}` |
| **Frontend loads** | Visit the static site URL → login page appears |
| **Login works** | Sign in with the Super Admin credentials |
| **No CORS errors** | Open DevTools → Console → should be clean |
| **Realtime works** | Log in and confirm the notification bell shows a connected state |
| **QR scanning** | Open `/scan` → browser prompts for camera permission |

---

## Free-plan behaviour

### Backend spin-down
The web service sleeps after **15 minutes** of inactivity. The next request
takes **~30–50 seconds** while it wakes. The static frontend never sleeps, so
the UI loads instantly and only API calls are delayed.

To keep it warm, ping the health endpoint every ~10 minutes with a free service
such as [cron-job.org](https://cron-job.org):

```
https://your-server.onrender.com/api/v1/health
```

### Socket.IO
Both client and server allow `websocket` **and** `polling` transports, and the
client retries indefinitely with backoff. Realtime therefore survives
spin-down cycles: it falls back to polling while the service wakes, then
upgrades to WebSocket automatically.

### Neon auto-suspend
Neon suspends an idle database and wakes it on the next query (~1s). The first
query after suspension may be slightly slow; nothing needs configuring.

### Resource limits
512 MB RAM and 0.1 CPU on the free web service. The in-memory caches
(`server/src/utils/cache.js`, the auth cache, and the rate limiter) are
per-instance, which is fine because the free plan runs a single instance. If
you ever scale to multiple instances, move these to Redis.

---

## Custom domains

Add via **Settings → Custom Domains** on each service. Render issues TLS
certificates automatically. Afterwards:

1. Add the new domain to `CLIENT_ORIGIN` (comma-separated, listed first).
2. Update `VITE_API_BASE_URL` if the API domain changed, then rebuild the
   static site.

---

## Troubleshooting

**Server exits immediately on deploy**
Environment validation failed. `server/src/config/env.js` prints the offending
fields to the log and calls `process.exit(1)`. Check that `DATABASE_URL` is
present, `JWT_SECRET` is 16+ characters, and `CLIENT_ORIGIN` is a full URL
including `https://`.

**CORS errors in the browser**
`CLIENT_ORIGIN` must match the frontend origin exactly — scheme included, no
trailing path. Trailing slashes are stripped automatically.

**Frontend calls `localhost:4000`**
`VITE_API_BASE_URL` was missing at build time. Set it, then redeploy with
**Clear build cache & deploy**.

**`prisma migrate deploy` fails**
Confirm the Neon URL ends with `?sslmode=require` and that you used the pooled
(`-pooler`) host.

**Camera does not open on `/scan`**
Browsers only expose the camera on secure origins. Render serves HTTPS by
default, so verify you are not on a plain-HTTP URL and that permission was
granted.

**Realtime notifications never arrive**
Usually a CORS mismatch on the Socket.IO handshake. `CLIENT_ORIGIN` must
include the exact frontend origin.
