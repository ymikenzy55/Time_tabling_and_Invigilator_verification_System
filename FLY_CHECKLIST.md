# ✅ Fly.io Deployment Checklist

Use this checklist to track your deployment progress.

---

## 📋 Pre-Deployment

- [ ] Neon PostgreSQL database is active and accessible
- [ ] Connection string copied from Neon dashboard (pooled connection)
- [ ] GitHub repository is pushed with latest code
- [ ] Credit card ready for Fly.io verification (free tier, no charges)

---

## 🔧 Setup Phase

- [ ] **Install Fly.io CLI**
  ```bash
  # Windows PowerShell (as Administrator)
  powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
  
  # Verify
  flyctl version
  ```

- [ ] **Generate Secrets**
  ```bash
  # Windows
  .\generate-secrets.ps1
  
  # Mac/Linux
  chmod +x generate-secrets.sh && ./generate-secrets.sh
  ```
  - [ ] Secrets generated and saved to `fly-secrets.txt`

- [ ] **Sign up & Login to Fly.io**
  ```bash
  flyctl auth signup
  # OR
  flyctl auth login
  ```
  - [ ] Account created
  - [ ] Payment method added (verification only)
  - [ ] Logged in successfully

---

## 🖥️ Backend Deployment

### Create Backend App
- [ ] Navigate to server directory: `cd server`
- [ ] Run: `flyctl launch --no-deploy`
- [ ] Answered prompts:
  - [ ] App name accepted (exam-management-server)
  - [ ] Region selected: __________ (write it down!)
  - [ ] Declined PostgreSQL (using Neon)
  - [ ] Declined Redis
  - [ ] Declined immediate deploy

### Set Backend Secrets
Open `fly-secrets.txt` and copy commands one by one:

- [ ] `DATABASE_URL` set (your Neon connection string)
- [ ] `JWT_SECRET` set
- [ ] `QR_SIGNING_SECRET` set
- [ ] `SUPER_ADMIN_EMAIL` set
- [ ] `SUPER_ADMIN_PASSWORD` set
- [ ] `SUPER_ADMIN_NAME` set
- [ ] `SUPER_ADMIN_STAFF_ID` set
- [ ] `CLIENT_ORIGIN` set (temporary)
- [ ] `SMTP_HOST` set (empty if not using email)
- [ ] `SMTP_USER` set (empty if not using email)
- [ ] `SMTP_PASS` set (empty if not using email)
- [ ] `SMTP_FROM` set (empty if not using email)

### Deploy Backend
- [ ] Run: `flyctl deploy`
- [ ] Build completed successfully (wait 5-10 minutes)
- [ ] Run: `flyctl info`
- [ ] Backend URL noted: ______________________________

### Verify Backend
- [ ] Health check works: `https://YOUR-BACKEND.fly.dev/api/v1/health`
- [ ] Returns: `{"success":true,"data":{"status":"ok"}}`

### Seed Database
- [ ] Run: `flyctl ssh console`
- [ ] Run: `npm run seed`
- [ ] Seed completed successfully
- [ ] Exit: `exit`

---

## 🎨 Frontend Deployment

### Create Frontend App
- [ ] Navigate to client directory: `cd ../client`
- [ ] Run: `flyctl launch --no-deploy`
- [ ] Answered prompts:
  - [ ] App name accepted (exam-management-client)
  - [ ] Same region as backend selected
  - [ ] Declined PostgreSQL
  - [ ] Declined Redis
  - [ ] Declined immediate deploy

### Deploy Frontend
- [ ] Replace URL below with YOUR backend URL!
  ```bash
  flyctl deploy --build-arg VITE_API_BASE_URL=https://YOUR-BACKEND.fly.dev/api/v1
  ```
- [ ] Build completed successfully (wait 5-10 minutes)
- [ ] Run: `flyctl info`
- [ ] Frontend URL noted: ______________________________

---

## 🔗 Connect Frontend & Backend

### Update Backend CORS
- [ ] Navigate back to server: `cd ../server`
- [ ] Replace URL below with YOUR frontend URL!
  ```bash
  flyctl secrets set CLIENT_ORIGIN="https://YOUR-FRONTEND.fly.dev"
  ```
- [ ] Backend restarted automatically

---

## ✅ Verification

### Test Application
- [ ] Open frontend URL in browser
- [ ] Login page loads correctly
- [ ] Logged in with Super Admin credentials
- [ ] Dashboard loads
- [ ] No CORS errors in browser console (F12)
- [ ] Notification bell shows connected status
- [ ] Navigation works
- [ ] QR scan page requests camera permission

### Test Real-time Features
- [ ] Open two browser tabs with your app
- [ ] Test notifications or live updates
- [ ] Both tabs receive updates

---

## 🤖 GitHub Auto-Deploy (Optional but Recommended)

- [ ] Run: `flyctl auth token`
- [ ] Token copied
- [ ] Go to GitHub repo → Settings → Secrets and variables → Actions
- [ ] Added secret: `FLY_API_TOKEN` = (your token)
- [ ] Added secret: `VITE_API_BASE_URL` = `https://YOUR-BACKEND.fly.dev/api/v1`
- [ ] Test push:
  ```bash
  git add .
  git commit -m "Add Fly.io deployment"
  git push origin main
  ```
- [ ] GitHub Actions workflow runs successfully
- [ ] Both services deployed automatically

---

## 📊 Final Checks

- [ ] Frontend URL works: https://_______________________
- [ ] Backend API works: https://_______________________/api/v1/health
- [ ] Database connected (can login and see data)
- [ ] Real-time notifications working
- [ ] No errors in logs: `flyctl logs`
- [ ] Both services show "healthy" status

---

## 📝 Save Your URLs

**Production URLs** (write these down or bookmark):
- Frontend: https://_______________________
- Backend API: https://_______________________/api/v1

**Admin Credentials**:
- Email: _______________________
- Password: _______________________

---

## 🎉 You're Done!

Your Examination Management System is now live on Fly.io!

### Quick Commands for Future Use:
```bash
# View logs
flyctl logs

# SSH into server
flyctl ssh console

# Check status
flyctl status

# Redeploy manually
flyctl deploy

# Dashboard
flyctl dashboard
```

### Need Help?
- Full guide: See `FLY_DEPLOYMENT.md`
- Quick reference: See `QUICK_START_FLY.md`
- Fly.io docs: https://fly.io/docs/

---

**Congratulations! 🚀 Your app is deployed and running!**
