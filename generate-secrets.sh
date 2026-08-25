#!/bin/bash
# Bash script to generate secrets for Fly.io deployment
# Run this: chmod +x generate-secrets.sh && ./generate-secrets.sh

echo "========================================"
echo "  Fly.io Secrets Generator"
echo "========================================"
echo ""

echo "Generating JWT_SECRET..."
JWT_SECRET=$(openssl rand -hex 32)
echo "JWT_SECRET=$JWT_SECRET"
echo ""

echo "Generating QR_SIGNING_SECRET..."
QR_SECRET=$(openssl rand -hex 32)
echo "QR_SIGNING_SECRET=$QR_SECRET"
echo ""

echo "========================================"
echo "  Copy these commands to set secrets:"
echo "========================================"
echo ""

cat << EOF
cd server

flyctl secrets set DATABASE_URL="YOUR_NEON_CONNECTION_STRING"

flyctl secrets set JWT_SECRET="$JWT_SECRET"

flyctl secrets set QR_SIGNING_SECRET="$QR_SECRET"

flyctl secrets set SUPER_ADMIN_EMAIL="admin@youruniversity.edu"

flyctl secrets set SUPER_ADMIN_PASSWORD="ChangeMe123!"

flyctl secrets set SUPER_ADMIN_NAME="System Administrator"

flyctl secrets set SUPER_ADMIN_STAFF_ID="SA-0001"

flyctl secrets set CLIENT_ORIGIN="http://localhost:5173"

flyctl secrets set SMTP_HOST=""

flyctl secrets set SMTP_USER=""

flyctl secrets set SMTP_PASS=""

flyctl secrets set SMTP_FROM=""
EOF

echo ""
echo "========================================"
echo "  Secrets saved to: fly-secrets.txt"
echo "========================================"

# Save to file
cat > fly-secrets.txt << EOF
# Fly.io Secrets for Exam Management System
# Generated: $(date)

JWT_SECRET=$JWT_SECRET
QR_SIGNING_SECRET=$QR_SECRET

# Copy these commands to your terminal:

cd server

flyctl secrets set DATABASE_URL="YOUR_NEON_CONNECTION_STRING"

flyctl secrets set JWT_SECRET="$JWT_SECRET"

flyctl secrets set QR_SIGNING_SECRET="$QR_SECRET"

flyctl secrets set SUPER_ADMIN_EMAIL="admin@youruniversity.edu"

flyctl secrets set SUPER_ADMIN_PASSWORD="ChangeMe123!"

flyctl secrets set SUPER_ADMIN_NAME="System Administrator"

flyctl secrets set SUPER_ADMIN_STAFF_ID="SA-0001"

flyctl secrets set CLIENT_ORIGIN="http://localhost:5173"

flyctl secrets set SMTP_HOST=""

flyctl secrets set SMTP_USER=""

flyctl secrets set SMTP_PASS=""

flyctl secrets set SMTP_FROM=""

# After frontend deployment, update CLIENT_ORIGIN:
# flyctl secrets set CLIENT_ORIGIN="https://YOUR-FRONTEND-URL.fly.dev"
EOF

echo ""
echo "✅ Secrets saved! Open fly-secrets.txt to copy commands."
