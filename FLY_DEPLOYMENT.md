# Deploying to Fly.io - Complete Guide

This guide walks you through deploying the Examination Management System to Fly.io with your existing Neon PostgreSQL database.

## Prerequisites

- ✅ Neon PostgreSQL database (already set up)
- ✅ GitHub account with this repository pushed
- ✅ Credit card (required for Fly.io verification, but free tier is truly free)
- ✅ Terminal/Command Prompt access

---

## Part 1: Install Fly.io CLI

### On Windows (PowerShell - Run as Administrator):
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### On Mac/Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

### Verify installation:
```bash
flyctl version
```

---

## Part 2: Sign Up & Login to Fly.io

### 1. Create account and login:
```bash
flyctl auth signup
# OR if you already have an account:
flyctl auth login
```

### 2. Add payment method:
- Follow the prompts in the browser
- Required for verification (even for free tier)
- **You won't be charged** unless you exceed free tier limits

---

## Part 3: Deploy Backend (Server)

### 1. Navigate to server directory:
```bash
cd server
```

### 2. Create the Fly.io app:
```bash
flyctl launch --no-deploy
```

When prompted:
- **App name**: Press Enter to accept `exam-management-server` (or choose your own)
- **Region**: Choose closest to your users:
  - `iad` - Virginia, USA (default)
  - `ams` - Amsterdam, Netherlands (Europe)
  - `jnb` - Johannesburg, South Africa (Africa)
- **Would you like to set up a PostgreSQL database?**: Type `N` (No - you're using Neon)
- **Would you like to set up a Redis database?**: Type `N` (No)
- **Would you like to deploy now?**: Type `N` (No - we need to set secrets first)

### 3. Set environment secrets:
```bash
# Your Neon database URL
flyctl secrets set DATABASE_URL="postgresql://neondb_owner:npg_xb4FQ2cqkWaj@ep-restless-bonus-athsv6i9-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30"

# Generate new JWT secret (use the command below or your own 64-char string)
# On Mac/Linux: openssl rand -hex 32
# On Windows PowerShell: -join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
flyctl secrets set JWT_SECRET="your-64-character-random-string-here"

# Generate new QR signing secret (different from JWT_SECRET)
flyctl secrets set QR_SIGNING_SECRET="another-64-character-random-string-here"

# Super admin credentials (for first login after seeding)
flyctl secrets set SUPER_ADMIN_EMAIL="admin@youruniversity.edu"
flyctl secrets set SUPER_ADMIN_PASSWORD="YourSecurePassword123!"
flyctl secrets set SUPER_ADMIN_NAME="System Administrator"
flyctl secrets set SUPER_ADMIN_STAFF_ID="SA-0001"

# Client origin (we'll update this after frontend deployment)
flyctl secrets set CLIENT_ORIGIN="http://localhost:5173"

# Optional: Email settings (leave blank to disable email features)
flyctl secrets set SMTP_HOST=""
flyctl secrets set SMTP_USER=""
flyctl secrets set SMTP_PASS=""
flyctl secrets set SMTP_FROM=""
```

### 4. Deploy the backend:
```bash
flyctl deploy
```

**Wait 5-10 minutes** for the first build to complete.

### 5. Get your backend URL:
```bash
flyctl info
```

Look for the **Hostname** (e.g., `exam-management-server.fly.dev`)

Your API will be at: `https://exam-management-server.fly.dev/api/v1`

### 6. Verify backend is running:
```bash
# Check health endpoint
curl https://exam-management-server.fly.dev/api/v1/health

# Should return: {"success":true,"data":{"status":"ok"}}
```

### 7. Seed the database:
```bash
flyctl ssh console
npm run seed
exit
```

---

## Part 4: Deploy Frontend (Client)

### 1. Navigate to client directory:
```bash
cd ../client
```

### 2. Create the Fly.io app:
```bash
flyctl launch --no-deploy
```

When prompted:
- **App name**: Press Enter to accept `exam-management-client` (or choose your own)
- **Region**: Choose the **SAME** region as your backend
- **Would you like to set up a PostgreSQL database?**: Type `N`
- **Would you like to set up a Redis database?**: Type `N`
- **Would you like to deploy now?**: Type `N`

### 3. Deploy the frontend with API URL:
```bash
flyctl deploy --build-arg VITE_API_BASE_URL=https://exam-management-server.fly.dev/api/v1
```

**Wait 5-10 minutes** for the build to complete.

### 4. Get your frontend URL:
```bash
flyctl info
```

Look for the **Hostname** (e.g., `exam-management-client.fly.dev`)

---

## Part 5: Update Backend CORS Settings

Now that you have the frontend URL, update the backend:

### 1. Navigate back to server directory:
```bash
cd ../server
```

### 2. Update CLIENT_ORIGIN:
```bash
flyctl secrets set CLIENT_ORIGIN="https://exam-management-client.fly.dev"
```

This will automatically restart your backend.

---

## Part 6: Verify Everything Works

### 1. Open your frontend:
```
https://exam-management-client.fly.dev
```

### 2. Test login:
- Email: `admin@youruniversity.edu` (or what you set)
- Password: `YourSecurePassword123!` (or what you set)

### 3. Check for errors:
- Open browser DevTools (F12) → Console
- Should see no CORS errors
- Check Network tab for API calls

### 4. Test real-time features:
- Check notification bell (should show connected)
- Navigate around the app

---

## Part 7: Set Up GitHub Auto-Deploy (Optional but Recommended)

### 1. Get your Fly.io API token:
```bash
flyctl auth token
```

Copy the token that appears.

### 2. Add to GitHub Secrets:
1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Name | Value |
|------|-------|
| `FLY_API_TOKEN` | (paste the token from step 1) |
| `VITE_API_BASE_URL` | `https://exam-management-server.fly.dev/api/v1` |

### 3. Test auto-deploy:
```bash
# Make a small change
echo "# Test" >> README.md
git add .
git commit -m "Test auto-deploy"
git push origin main
```

### 4. Watch deployment:
- Go to GitHub → **Actions** tab
- You'll see the workflow running
- Both backend and frontend will deploy automatically

---

## Common Commands Reference

### View logs:
```bash
# Backend logs
cd server
flyctl logs

# Frontend logs
cd client
flyctl logs
```

### SSH into server:
```bash
cd server
flyctl ssh console
```

### Check app status:
```bash
flyctl status
```

### Update a secret:
```bash
flyctl secrets set SECRET_NAME="new-value"
```

### View all secrets (names only, not values):
```bash
flyctl secrets list
```

### Redeploy:
```bash
flyctl deploy
```

### Scale (if you need more resources later):
```bash
flyctl scale memory 512  # Increase to 512MB
flyctl scale count 2     # Run 2 instances
```

---

## Troubleshooting

### Backend won't start:
```bash
cd server
flyctl logs
```
Check for missing environment variables or database connection issues.

### Frontend shows CORS errors:
```bash
# Make sure CLIENT_ORIGIN is set correctly
cd server
flyctl secrets set CLIENT_ORIGIN="https://exam-management-client.fly.dev"
```

### Database connection fails:
- Verify your Neon database is active
- Check the connection string includes `?sslmode=require`
- Ensure you're using the **pooled** connection string (with `-pooler`)

### Prisma migrations fail:
```bash
cd server
flyctl ssh console
npx prisma migrate deploy
```

### "Out of memory" errors:
```bash
# Upgrade to 512MB (still within free tier limits)
flyctl scale memory 512
```

### Frontend doesn't update after code changes:
```bash
# Clear build cache
cd client
flyctl deploy --no-cache
```

---

## Cost Monitoring

### Check your usage:
```bash
flyctl dashboard
```

Or visit: https://fly.io/dashboard

### Free tier limits:
- Up to 3 shared-cpu-1x VMs
- 256MB RAM per VM (can increase to 512MB)
- 3GB persistent storage
- 160GB outbound data transfer

Your setup uses:
- **Backend**: 1 VM, 256MB RAM (always on)
- **Frontend**: 1 VM, 256MB RAM (can spin down)
- **Database**: On Neon (not using Fly storage)

**Total cost**: FREE (well within limits)

---

## Custom Domains (Optional)

### Add a custom domain:
```bash
# For frontend
cd client
flyctl certs create yourdomain.com

# Follow DNS instructions shown
```

### Update backend CORS:
```bash
cd server
flyctl secrets set CLIENT_ORIGIN="https://exam-management-client.fly.dev,https://yourdomain.com"
```

---

## Backup & Rollback

### View deployment history:
```bash
flyctl releases
```

### Rollback to previous version:
```bash
flyctl releases rollback
```

---

## Need Help?

- **Fly.io Docs**: https://fly.io/docs/
- **Community Forum**: https://community.fly.io/
- **Your logs**: `flyctl logs` (most issues show up here)

---

## Quick Reference Card

```bash
# Deploy changes
git push origin main  # Auto-deploys via GitHub Actions

# Manual deploy
cd server && flyctl deploy
cd client && flyctl deploy

# View logs
flyctl logs

# SSH into server
flyctl ssh console

# Update secrets
flyctl secrets set VAR_NAME="value"

# Check status
flyctl status

# Scale up (if needed)
flyctl scale memory 512
```

---

## Summary

You now have:
✅ Backend deployed on Fly.io (always-on, Socket.IO working)
✅ Frontend deployed on Fly.io (fast static serving)
✅ Connected to your Neon PostgreSQL database
✅ GitHub auto-deploy configured
✅ CORS configured correctly
✅ Real-time features working

**Your app is live!** 🚀

Main URL: `https://exam-management-client.fly.dev`
API URL: `https://exam-management-server.fly.dev/api/v1`
