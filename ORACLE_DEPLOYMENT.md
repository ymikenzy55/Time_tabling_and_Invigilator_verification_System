# Oracle Cloud Deployment Guide

Complete step-by-step guide to host the Examination Management System on Oracle Cloud Always Free tier with Neon PostgreSQL.

## Architecture

```
[User Browser] → [Oracle VM (Nginx)] → Static files (frontend)
                                      → Reverse proxy /api → Node.js (backend, port 4000)
                                      → WebSocket /socket.io → Node.js
[Node.js backend] → [Neon PostgreSQL]
```

---

## Prerequisites

- An Oracle Cloud account (https://cloud.oracle.com)
- A GitHub account with your repo pushed
- A Neon account (https://neon.tech) for PostgreSQL

---

## Step 1: Set Up Neon PostgreSQL (Database)

1. Go to https://neon.tech and sign up (free)
2. Click **New Project** → name it `exam-management`
3. Select a region close to your Oracle VM region (e.g., `AWS ap-south-1` if Oracle is in Mumbai)
4. Copy the **Connection String** — it looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/exam_management?sslmode=require
   ```
5. Save this — you'll need it as `DATABASE_URL` later

---

## Step 2: Create Oracle Cloud Account

1. Go to https://cloud.oracle.com → click **Sign Up**
2. Fill in your details (need a credit card for verification — **you will NOT be charged**)
3. Choose a **Home Region** — pick one close to your users (e.g., `Mumbai` for Ghana/West Africa, or `US East` for general use)
4. Wait for the account to be approved (can take minutes to days)

> **Note:** If your signup is rejected, try again with a different card or region. Oracle's fraud detection can be strict.

---

## Step 3: Create a Compute Instance (VM)

1. In the Oracle Cloud Console, go to **Compute → Instances**
2. Click **Create Instance**
3. Configure:
   - **Name:** `exam-server`
   - **Image:** Canonical Ubuntu 22.04 (click "Change image" if it's not Ubuntu)
   - **Shape:** Click "Change shape" → **Ampere** → **VM.Standard.A1.Flex**
     - Set **OCPU count:** 2
     - Set **Memory:** 12 GB
     - (This is within the always-free limit of 4 OCPU / 24 GB)
   - **Networking:** Leave default (new VCN + public subnet)
   - **Add SSH keys:** Click "Save private key" and "Save public key"
     - **IMPORTANT:** Save these keys somewhere safe — you need them to SSH in
     - If you already have SSH keys, paste your public key
4. Click **Create**

5. Wait for the instance status to turn **Green (Running)**

6. Note the **Public IP Address** — you'll use this to connect

---

## Step 4: Open Firewall Ports

### 4a. Oracle Security List (VCN level)

1. Go to **Networking → Virtual Cloud Networks** → click your VCN
2. Click **Security Lists** → click the default security list
3. Click **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`
   - IP Protocol: `TCP`
   - Destination Port Range: `80`
   - Click **Add Ingress Rule**
4. Repeat for port `443` (HTTPS)
5. Repeat for port `22` (SSH — should already exist)

### 4b. Ubuntu Firewall (iptables)

Once you SSH in (Step 5), run:
```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

---

## Step 5: SSH Into the VM

### On Windows (PowerShell)
```powershell
ssh -i <path-to-your-private-key.key> ubuntu@<your-vm-public-ip>
```

### On Mac/Linux
```bash
chmod 400 <path-to-your-private-key>
ssh -i <path-to-your-private-key> ubuntu@<your-vm-public-ip>
```

> If your key is a `.key` file, rename it or use it directly. If you get "UNPROTECTED PRIVATE KEY FILE", run `chmod 400` on it.

---

## Step 6: Install Dependencies on the VM

Run these commands one by one:

### 6a. System updates
```bash
sudo apt update && sudo apt upgrade -y
```

### 6b. Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify:
```bash
node -v   # should show v20.x.x
npm -v    # should show 10.x.x
```

### 6c. Install Nginx
```bash
sudo apt install -y nginx
```

### 6d. Install PM2 (process manager for Node.js)
```bash
sudo npm install -g pm2
```

### 6e. Install Git
```bash
sudo apt install -y git
```

### 6f. Install Certbot (for HTTPS)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 7: Clone Your Project

```bash
cd /home/ubuntu
git clone https://github.com/ymikenzy55/Time_tabling_and_Invigilator_verification_System.git exam-management
cd exam-management
```

> If your repo is private, you'll need to set up SSH keys or use a personal access token.

---

## Step 8: Set Up the Backend

### 8a. Install backend dependencies
```bash
cd /home/ubuntu/exam-management/server
npm install
```

### 8b. Generate Prisma client
```bash
npx prisma generate
```

### 8c. Run database migrations
```bash
# You need the DATABASE_URL from Neon (Step 1)
export DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/exam_management?sslmode=require"
npx prisma migrate deploy
```

> If you get an SSL error, add `&sslmode=require` to the end of your DATABASE_URL (Neon requires SSL).

### 8d. Create the .env file
```bash
nano /home/ubuntu/exam-management/server/.env
```

Paste the following (replace values with your actual secrets):

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/exam_management?sslmode=require

# Generate a random 32+ char string: openssl rand -hex 32
JWT_SECRET=replace_with_random_32_char_string
JWT_EXPIRES_IN=1d

# Your frontend URL (will be your VM's IP or domain)
CLIENT_ORIGIN=http://YOUR_VM_PUBLIC_IP

# Super Admin credentials (for initial admin account)
SUPER_ADMIN_EMAIL=admin@uenr.edu.gh
SUPER_ADMIN_PASSWORD=YourStrongPassword123
SUPER_ADMIN_NAME=System Administrator
SUPER_ADMIN_STAFF_ID=SA-0001

# QR signing secret: openssl rand -hex 32
QR_SIGNING_SECRET=replace_with_random_32_char_string

# SMTP (optional — for email notifications)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# SMTP_FROM="Exams <noreply@uenr.edu.gh>"
```

Save with `Ctrl+O`, `Enter`, then `Ctrl+X` to exit.

### 8e. Generate random secrets
```bash
openssl rand -hex 32
```
Run this twice — use one output for `JWT_SECRET` and the other for `QR_SIGNING_SECRET`. Paste them into the `.env` file.

### 8f. Seed the database (creates super admin)
```bash
npm run seed
```

### 8g. Start the backend with PM2
```bash
cd /home/ubuntu/exam-management/server
pm2 start src/index.js --name exam-api
pm2 save
pm2 startup
```

Follow the instructions PM2 prints (it will ask you to run a `sudo env ...` command — copy and run it). This ensures the backend restarts automatically if the VM reboots.

### 8h. Verify the backend is running
```bash
curl http://localhost:4000/api/v1/health
```

Should return: `{"success":true,"data":{"status":"ok"}}`

---

## Step 9: Build the Frontend

### 9a. Install frontend dependencies
```bash
cd /home/ubuntu/exam-management/client
npm install
```

### 9b. Create the frontend .env file
```bash
nano /home/ubuntu/exam-management/client/.env
```

Paste:
```env
VITE_API_BASE_URL=http://YOUR_VM_PUBLIC_IP/api/v1
```

> Replace `YOUR_VM_PUBLIC_IP` with your actual VM public IP.
> If you plan to use a domain name, use that instead (e.g., `https://exams.yourdomain.com/api/v1`).

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

### 9c. Build the frontend
```bash
npm run build
```

This creates a `dist/` folder with the static files.

### 9d. Copy build to Nginx directory
```bash
sudo mkdir -p /var/www/exam-frontend
sudo cp -r /home/ubuntu/exam-management/client/dist/* /var/www/exam-frontend/
sudo chown -R www-data:www-data /var/www/exam-frontend
```

---

## Step 10: Configure Nginx

### 10a. Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/exam-management
```

Paste the following (replace `YOUR_VM_PUBLIC_IP` with your actual IP, or use your domain name):

```nginx
server {
    listen 80;
    server_name YOUR_VM_PUBLIC_IP;  # or your domain name

    # Frontend static files
    root /var/www/exam-frontend;
    index index.html;

    # SPA routing — redirect all non-file requests to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket proxy
    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    gzip_min_length 1000;
}
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

### 10b. Enable the site
```bash
sudo ln -s /etc/nginx/sites-available/exam-management /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 10c. Verify
Open your browser and go to `http://YOUR_VM_PUBLIC_IP` — you should see the login page.

---

## Step 11: Set Up HTTPS (Optional but Recommended)

### If you have a domain name:

1. Point your domain's A record to your VM's public IP (in your DNS provider — Cloudflare is free)
2. Run:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
3. Follow the prompts — Certbot will auto-configure HTTPS and redirect HTTP to HTTPS
4. Update your `.env` files:
   - Backend `CLIENT_ORIGIN=https://yourdomain.com`
   - Frontend `VITE_API_BASE_URL=https://yourdomain.com/api/v1`
5. Rebuild frontend and restart backend:
```bash
cd /home/ubuntu/exam-management/client
npm run build
sudo cp -r dist/* /var/www/exam-frontend/
sudo chown -R www-data:www-data /var/www/exam-frontend
pm2 restart exam-api
```

### If you don't have a domain:
You can use the VM's public IP with HTTP. HTTPS on a bare IP requires a self-signed cert (browsers will show a warning). For a university project, HTTP via IP is fine for testing.

---

## Step 12: Update CORS for Production

After deploying, make sure your backend `.env` has the correct `CLIENT_ORIGIN`:

```bash
nano /home/ubuntu/exam-management/server/.env
```

Set `CLIENT_ORIGIN` to match your frontend URL:
- With domain: `CLIENT_ORIGIN=https://yourdomain.com`
- Without domain: `CLIENT_ORIGIN=http://YOUR_VM_PUBLIC_IP`

Then restart:
```bash
pm2 restart exam-api
```

---

## Step 13: Verify Everything Works

1. **Frontend:** Visit `http://YOUR_VM_PUBLIC_IP` — should show login page
2. **Backend health:** Visit `http://YOUR_VM_PUBLIC_IP/api/v1/health` — should return `{"success":true,"data":{"status":"ok"}}`
3. **Login:** Use your super admin credentials (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`)
4. **Socket.IO:** Log in and check if notifications work in real-time

---

## Step 14: Set Up Auto-Deploy from GitHub (Optional)

If you want automatic deploys when you push to GitHub:

### 14a. Create a deploy script
```bash
nano /home/ubuntu/exam-management/deploy.sh
```

Paste:
```bash
#!/bin/bash
set -e

cd /home/ubuntu/exam-management
git pull origin main

# Backend
cd server
npm install
npx prisma generate
npx prisma migrate deploy
pm2 restart exam-api

# Frontend
cd ../client
npm install
npm run build
sudo cp -r dist/* /var/www/exam-frontend/
sudo chown -R www-data:www-data /var/www/exam-frontend

echo "Deploy complete at $(date)"
```

Make it executable:
```bash
chmod +x /home/ubuntu/exam-management/deploy.sh
```

### 14b. Set up a GitHub webhook (optional)
1. Go to your GitHub repo → Settings → Webhooks → Add webhook
2. Payload URL: `http://YOUR_VM_PUBLIC_IP:9000/webhook`
3. Content type: `application/json`
4. You'd need a small webhook listener — or just SSH in and run `./deploy.sh` manually when you push updates

### Manual deploy (simpler):
Whenever you push changes to GitHub, just SSH in and run:
```bash
cd /home/ubuntu/exam-management
./deploy.sh
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `pm2 status` | Check if backend is running |
| `pm2 logs exam-api` | View backend logs |
| `pm2 restart exam-api` | Restart backend |
| `pm2 stop exam-api` | Stop backend |
| `sudo systemctl status nginx` | Check Nginx status |
| `sudo systemctl restart nginx` | Restart Nginx |
| `sudo nginx -t` | Test Nginx config |
| `npx prisma studio` | Visual database browser (run on VM, access via port 5555) |

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs exam-api --lines 50
```
Common issues:
- Missing env vars → check `.env` file
- Database connection failed → check `DATABASE_URL` and Neon is accessible
- Port already in use → `pm2 restart exam-api`

### Frontend shows blank page
- Check Nginx is running: `sudo systemctl status nginx`
- Check files exist: `ls /var/www/exam-frontend/`
- Check Nginx config: `sudo nginx -t`
- Check browser console for errors

### Socket.IO not connecting
- Make sure Nginx is proxying `/socket.io/` with WebSocket upgrade headers
- Check `CLIENT_ORIGIN` in backend `.env` matches your frontend URL exactly
- Check browser console for connection errors

### Database connection issues
- Verify Neon is not suspended (free tier auto-suspends after inactivity)
- Check `DATABASE_URL` includes `?sslmode=require`
- Test connection: `npx prisma db pull` (should list tables without error)

### Can't access the site
- Check Oracle security list has ports 80 and 443 open
- Check Ubuntu iptables: `sudo iptables -L -n`
- Check Nginx is listening: `sudo ss -tlnp | grep :80`

---

## Cost Summary

| Service | Cost |
|---------|------|
| Oracle VM (2 OCPU, 12 GB RAM) | **Free** (always free tier) |
| Neon PostgreSQL (0.5 GB) | **Free** |
| Nginx | Free (open source) |
| PM2 | Free (open source) |
| Certbot / Let's Encrypt SSL | Free |
| **Total** | **$0/month** |

---

## File Locations on the VM

| Path | Description |
|------|-------------|
| `/home/ubuntu/exam-management/` | Project root (git repo) |
| `/home/ubuntu/exam-management/server/` | Backend code |
| `/home/ubuntu/exam-management/client/` | Frontend code |
| `/home/ubuntu/exam-management/server/.env` | Backend environment variables |
| `/home/ubuntu/exam-management/client/.env` | Frontend environment variables |
| `/var/www/exam-frontend/` | Built frontend (served by Nginx) |
| `/etc/nginx/sites-available/exam-management` | Nginx config |
| `/home/ubuntu/exam-management/deploy.sh` | Deploy script |
