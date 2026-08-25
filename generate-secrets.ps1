# PowerShell script to generate secrets for Fly.io deployment
# Run this in PowerShell: .\generate-secrets.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Fly.io Secrets Generator" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Generating JWT_SECRET..." -ForegroundColor Yellow
$JWT_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "JWT_SECRET=$JWT_SECRET" -ForegroundColor Green
Write-Host ""

Write-Host "Generating QR_SIGNING_SECRET..." -ForegroundColor Yellow
$QR_SECRET = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object {[char]$_})
Write-Host "QR_SIGNING_SECRET=$QR_SECRET" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Copy these commands to set secrets:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "cd server" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set DATABASE_URL=`"YOUR_NEON_CONNECTION_STRING`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set JWT_SECRET=`"$JWT_SECRET`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set QR_SIGNING_SECRET=`"$QR_SECRET`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SUPER_ADMIN_EMAIL=`"admin@youruniversity.edu`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SUPER_ADMIN_PASSWORD=`"ChangeMe123!`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SUPER_ADMIN_NAME=`"System Administrator`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SUPER_ADMIN_STAFF_ID=`"SA-0001`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set CLIENT_ORIGIN=`"http://localhost:5173`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SMTP_HOST=`"`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SMTP_USER=`"`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SMTP_PASS=`"`"" -ForegroundColor White
Write-Host ""
Write-Host "flyctl secrets set SMTP_FROM=`"`"" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Secrets saved to: fly-secrets.txt" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Save to file
$output = @"
# Fly.io Secrets for Exam Management System
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

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
"@

$output | Out-File -FilePath "fly-secrets.txt" -Encoding UTF8

Write-Host ""
Write-Host "✅ Secrets saved! Open fly-secrets.txt to copy commands." -ForegroundColor Green
