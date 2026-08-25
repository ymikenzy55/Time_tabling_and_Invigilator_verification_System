# 🚀 Quick Start - Deploy to Fly.io in 10 Steps

**Time needed**: 30-40 minutes (including build times)

---

## Step 1: Install Fly.io CLI (5 minutes)

### Windows (PowerShell - Run as Administrator):
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

### Verify:
```bash
flyctl version
```

---

## Step 2: Sign Up & Login (5 minutes)

```bash
flyctl auth signup
```

- Complete signup in browser
- Add credit card (required, but **FREE tier is truly free**)
- Return to terminal

---

## Step 3: Deploy Backend (15 minutes)

```bash
# Navigate to server
cd server

# Create app (don't deploy yet)
flyctl launch --no-deploy

# Answer prompts:
# - App name: Press ENTER (exam-management-server)
# - Region: Choose closest (iad/ams/jnb)
# - PostgreSQL: N (No - using Neon)
# - Redis: N (No)
# - Deploy now: N (No)
```

---

## Step 4: Set Backend Secrets (5 minutes)

**IMPORTANT**: Replace the placeholder values below with your actual values!

```bash
# Your Neon database URL (use your actual connection string from .env)
flyctl secrets set DATABASE_URL="postgresql://neondb_owner:npg_xb4FQ2cqkWaj@ep-restless-bonus-athsv6i9-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=30"

# Generate NEW secrets (don't use dev secrets in production!)
# Windows PowerShell: -join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
# Mac/Linux: openssl rand -hex 32

flyctl secrets set JWT_SECRET="PASTE_YOUR_64_CHAR_RANDOM_STRING_HERE"
flyctl secrets set QR_SIGNING_SECRET="PASTE_ANOTHER_64_CHAR_RANDOM_STRING_HERE"

# Super Admin credentials
flyctl secrets set SUPER_ADMIN_EMAIL="admin@youruniversity.edu"
flyctl secrets set SUPER_ADMIN_PASSWORD="ChangeThisPassword123!"
flyctl secrets set SUPER_ADMIN_NAME="System Administrator"
flyctl secrets set SUPER_ADMIN_STAFF_ID="SA-0001"

# Temporary CLIENT_ORIGIN (will update after frontend deployment)
flyctl secrets set CLIENT_ORIGIN="http://localhost:5173"

# Optional: Email (leave blank to disable)
flyctl secrets set SMTP_HOST=""
flyctl secrets set SMTP_USER=""
flyctl secrets set SMTP_PASS=""
flyctl secrets set SMTP_FROM=""
```

---

## Step 5: Deploy Backend (10 minutes build time)

```bash
flyctl deploy
```

**Wait for build to complete...**

Get your backend URL:
```bash
flyctl info
```

Look for **Hostname** (e.g., `exam-management-server.fly.dev`)

**Your API URL is**: `https://exam-management-server.fly.dev/api/v1`

---

## Step 6: Seed Database (2 minutes)

```bash
flyctl ssh console
npm run seed
exit
```

---

## Step 7: Deploy Frontend (15 minutes)

```bash
# Navigate to client
cd ../client

# Create app (don't deploy yet)
flyctl launch --no-deploy

# Answer prompts:
# - App name: Press ENTER (exam-management-client)
# - Region: SAME as backend
# - PostgreSQL: N
# - Redis: N
# - Deploy now: N
```

---

## Step 8: Deploy Frontend with API URL (10 minutes build time)

**Replace with YOUR backend URL from Step 5!**

```bash
flyctl deploy --build-arg VITE_API_BASE_URL=https://exam-management-server.fly.dev/api/v1
```

**Wait for build to complete...**

Get your frontend URL:
```bash
flyctl info
```

Look for **Hostname** (e.g., `exam-management-client.fly.dev`)

---

## Step 9: Update Backend CORS (1 minute)

**Replace with YOUR frontend URL from Step 8!**

```bash
# Go back to server directory
cd ../server

# Update CLIENT_ORIGIN with your actual frontend URL
flyctl secrets set CLIENT_ORIGIN="https://exam-management-client.fly.dev"
```

---

## Step 10: Test Your App! (2 minutes)

1. Open: `https://exam-management-client.fly.dev`
2. Login with your Super Admin credentials
3. Check browser console (F12) for errors
4. Test navigation and real-time features

---

## ✅ Done! Your App is Live!

**Frontend**: `https://exam-management-client.fly.dev`  
**Backend API**: `https://exam-management-server.fly.dev/api/v1`  
**Database**: Your existing Neon PostgreSQL

---

## 🎁 BONUS: GitHub Auto-Deploy

### 1. Get Fly.io API Token:
```bash
flyctl auth token
```

Copy the token.

### 2. Add to GitHub:
1. Go to your repo on GitHub
2. Settings → Secrets and variables → Actions
3. New repository secret:
   - Name: `FLY_API_TOKEN`
   - Value: (paste token)
4. New repository secret:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://exam-management-server.fly.dev/api/v1`

### 3. Push to Deploy:
```bash
git add .
git commit -m "Add Fly.io deployment"
git push origin main
```

**Now every push to `main` branch auto-deploys!** 🎉

---

## 📱 Useful Commands

```bash
# View logs
flyctl logs

# SSH into server
flyctl ssh console

# Check status
flyctl status

# Update a secret
flyctl secrets set SECRET_NAME="new-value"

# Redeploy
flyctl deploy

# Dashboard
flyctl dashboard
```

---

## ❓ Troubleshooting

**Can't connect to database?**
- Check your DATABASE_URL includes `?sslmode=require`
- Verify Neon database is active
- Ensure you used the **pooled** connection string

**CORS errors?**
```bash
cd server
flyctl secrets set CLIENT_ORIGIN="https://YOUR-FRONTEND-URL.fly.dev"
```

**Build fails?**
- Check `flyctl logs`
- Try: `flyctl deploy --no-cache`

**Out of memory?**
```bash
flyctl scale memory 512
```

---

## 📖 Full Documentation

See `FLY_DEPLOYMENT.md` for complete guide with troubleshooting, custom domains, and advanced configuration.

---

## 💰 Cost

**Your Setup**: 100% FREE
- Backend: 1 VM (256MB) - always on
- Frontend: 1 VM (256MB) - auto-sleep when idle
- Database: On Neon (not counted against Fly limits)

**Free tier limits**: 3 VMs, 3GB storage, 160GB transfer/month

---

**Need help?** Check `FLY_DEPLOYMENT.md` or visit https://fly.io/docs/
