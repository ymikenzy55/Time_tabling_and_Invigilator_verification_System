# Arkesel Quick Start - 5 Steps ⚡

## Why Arkesel?
- ✅ **GH₵0.05/SMS** (~$0.003) - Very cheap!
- ✅ **No verification** - Send to anyone
- ✅ **Ghana company** - Local support
- ✅ **Mobile Money** - Easy payment

---

## Setup in 5 Steps

### 1️⃣ Sign Up
Go to: **https://arkesel.com**  
Create account with your email

### 2️⃣ Get API Key
Dashboard → Settings/API → Copy API Key  
Looks like: `ark_live_xxxxxxxxxx`

### 3️⃣ Top Up (Optional)
Billing → Top Up → GH₵10-20  
Payment: Mobile Money or Card

### 4️⃣ Configure
Add to `server/.env`:
```bash
ARKESEL_API_KEY="ark_live_your_key_here"
ARKESEL_SENDER_ID="UENR"
```

### 5️⃣ Test
```bash
cd server
npm run dev

# Test SMS
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0201234567","message":"Test!"}'
```

**Done!** 🎉

---

## Usage in Code

```javascript
// Send notification + SMS
await createNotification({
  userId: user.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Your exam is at 9 AM',
  sendSms: true,  // ← Arkesel handles this!
});
```

---

## Cost Examples

| Usage | Cost (GH₵) | Cost (USD) |
|-------|------------|------------|
| 100 SMS | GH₵5 | $0.30 |
| 500 SMS | GH₵25 | $1.50 |
| 1000 SMS | GH₵50 | $3.00 |

**Your yearly estimate: ~GH₵55 ($3.30)** 💰

---

## Troubleshooting

### Not sending?
1. Check API key in `.env`
2. Check balance in Arkesel dashboard
3. Check logs: `grep "\[sms\]" logs/app.log`

### Need help?
- **Full guide**: `ARKESEL_SETUP_GUIDE.md`
- **Arkesel support**: https://arkesel.com

---

**That's it! Simple, cheap, and works!** ✅
