# mNotify SMS Setup Guide - Step by Step

## About mNotify

- 🇬🇭 **Ghana company** - Local support
- ✅ **Good reputation** - Trusted by SMEs
- 💰 **Affordable** - ~GH₵0.05/SMS
- 📱 **Mobile Money** - Easy payment
- 🚀 **Developer-friendly** - Simple API

---

## Cost

- **Per SMS**: ~GH₵0.05 (~$0.003)
- **100 SMS**: ~GH₵5
- **500 SMS**: ~GH₵25
- **1000 SMS**: ~GH₵50

---

## What You Need

1. ✅ Email address
2. ✅ Phone number
3. ✅ Organization name (UENR)
4. ✅ Mobile Money account (for payment)

---

## Setup Steps (10-15 minutes)

### Step 1: Create mNotify Account

1. **Go to**: https://www.mnotify.com
2. **Look for**: "Sign Up" or "Register" or "Get Started"
3. **Click** to create account

### Step 2: Fill Registration Form

Enter:
- **Full Name**: Your name
- **Email**: Your email
- **Phone**: Your Ghana number (+233...)
- **Password**: Create strong password
- **Organization**: UENR (optional)

### Step 3: Verify Your Account

1. **Check email** for verification link
2. **Click link** to verify
3. **Log in** to your account

### Step 4: Navigate to API Section

After logging in:

1. Go to **Dashboard**
2. Look for:
   - **"API"** or
   - **"Developer"** or
   - **"API Settings"** or
   - **"Integrations"**

### Step 5: Get Your API Key

You need **1 thing**: **API Key**

**Where to find it:**
- Dashboard → **API Key** or
- Dashboard → **Settings** → **API** or
- Dashboard → **Developer** → **API Key**

**Looks like:**
- Long alphanumeric string
- Example: `mnotify_xxxxxxxxxxxxxxxxxxxxxxxx`

**If you can't see it:**
- Look for "Generate API Key" or "Show API Key"
- Click to reveal or generate
- **Copy it immediately** (may not show again)
- Save it securely!

### Step 6: Register Sender ID (Optional)

Your SMS will show from a default sender by default. To use "UENR":

1. Go to **SMS** → **Sender IDs** or **Manage Sender IDs**
2. Click **"Add New"** or **"Register Sender ID"**
3. Enter: `UENR`
4. Submit for approval (may take 24-48 hours)

**For testing**: Skip this step, use default sender ID

### Step 7: Top Up Your Account

1. Go to **Billing** or **Wallet** or **Buy Credits**
2. Choose amount: **GH₵20** (recommended)
3. Select payment: **Mobile Money**
4. Choose network:
   - MTN Mobile Money
   - Vodafone Cash
   - AirtelTigo Money
5. Enter your Mobile Money number
6. **Approve payment** on your phone (check for prompt)
7. Wait for confirmation (usually instant)

### Step 8: Configure Your App

Add to `server/.env`:

```bash
# mNotify SMS
MNOTIFY_API_KEY="your_api_key_here"
MNOTIFY_SENDER_ID="UENR"
```

**Important:**
- Replace `your_api_key_here` with actual API key
- Keep the quotes
- No spaces around `=`

### Step 9: Restart Server

```bash
cd server
npm run dev
```

### Step 10: Test!

Send test SMS:

```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0201234567",
    "message": "Test SMS from UENR via mNotify!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "provider": "mnotify",
  "to": "+233201234567"
}
```

**Check your phone!** 📱

---

## Troubleshooting

### Can't Find API Key?

**Try these:**
1. Dashboard → Settings → API
2. Dashboard → Developer Tools
3. Dashboard → Account → API Key
4. Profile → API Settings

**Still missing?**
- Contact mNotify support
- Check documentation
- May need to generate first

### "Invalid API Key" Error?

1. ✅ Copy API key again from dashboard
2. ✅ Check no extra spaces in `.env`
3. ✅ Ensure key is correct (long string)
4. ✅ Restart server after changing `.env`

### Insufficient Credits?

1. Check balance in mNotify dashboard
2. Top up via Mobile Money
3. Wait 2-5 minutes for credit

### SMS Not Sending?

1. ✅ Verify phone number format (+233...)
2. ✅ Check balance in dashboard
3. ✅ Check API key is active
4. ✅ View SMS history/logs in dashboard

### Payment Not Going Through?

1. Ensure Mobile Money has funds
2. Check for payment prompt on phone
3. Approve within time limit
4. Contact mNotify support if stuck

---

## Usage in Your App

Once configured, SMS sends automatically:

```javascript
// Exam reminder
await createNotification({
  userId: student.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Mathematics exam at 9 AM, Room 301',
  sendSms: true,  // ← mNotify handles this!
});

// Notify all lecturers
await notifyRole('LECTURER', {
  type: 'TIMETABLE_UPDATE',
  title: 'Schedule Updated',
  message: 'Exam schedule has been updated',
  sendSms: true,
});
```

---

## Monitoring

### Check Balance:
- Log into mNotify dashboard
- View wallet/credits balance

### View SMS History:
- Dashboard → SMS History
- Dashboard → Reports

### Check Delivery Status:
- Dashboard → SMS → Delivery Reports

### In Your App Logs:
```bash
grep "\[sms\]" logs/app.log
```

You'll see:
```
[sms] Attempting to send via mNotify to: +233...
[sms] mNotify success
```

---

## Cost Estimates

### Your Usage:
- **500 SMS/semester**: GH₵25
- **20 SMS/month**: GH₵1
- **Total/semester**: ~GH₵30
- **Total/year**: ~GH₵60

### Top-Up Strategy:
- Start: GH₵20
- Refill when < GH₵10
- Monitor monthly

---

## Best Practices

### 1. Keep Messages Short
```javascript
// ✅ Good (under 160 chars)
"Exam tomorrow 9 AM, Room 301"

// ❌ Bad (too long)
"Dear student, this is to inform you that..."
```

### 2. Test Before Bulk Send
- Send to 1-2 numbers first
- Verify delivery
- Then send to all

### 3. Monitor Credits
- Check balance weekly
- Set reminder to top up
- Don't let it run out during exams!

### 4. Use for Critical Messages Only
```javascript
// ✅ Send SMS
- Exam in 24 hours
- Venue changes
- Emergency alerts

// ❌ Don't send SMS
- General announcements
- Read receipts
- Minor updates
```

---

## Support

### mNotify Support:
- **Website**: https://www.mnotify.com
- **Email**: support@mnotify.com (check website)
- **Phone**: Check website for number
- **Live Chat**: May be available on website

### Documentation:
- Check mNotify dashboard for docs
- Developer section
- API reference

---

## Security Tips

✅ **Keep API key secret**  
✅ **Never commit `.env` to git**  
✅ **Add `.env` to `.gitignore`**  
✅ **Use environment variables in production**  
✅ **Rotate key if compromised**  
✅ **Don't share key with others**  

---

## Summary

### What You Get:
- ✅ Simple setup (1 API key)
- ✅ Affordable (GH₵0.05/SMS)
- ✅ Mobile Money payments
- ✅ Ghana-focused
- ✅ Good support

### What You Need:
1. mNotify account (free)
2. API Key (from dashboard)
3. GH₵20 credit (via Mobile Money)

### Total Time: 10-15 minutes
### Total Cost: GH₵20 (~$1.20)
### Result: 400 SMS ready to go! ✅

---

## Quick Checklist

- [ ] Sign up at mnotify.com
- [ ] Verify email
- [ ] Log in to dashboard
- [ ] Find and copy API key
- [ ] Top up GH₵20 via Mobile Money
- [ ] Add API key to `server/.env`
- [ ] Set sender ID to "UENR"
- [ ] Restart server (`npm run dev`)
- [ ] Test with `/api/test-sms` endpoint
- [ ] Send test SMS to your phone
- [ ] Confirm SMS received
- [ ] Done! 🎉

---

## Comparison: mNotify vs Hubtel

| Feature | mNotify | Hubtel |
|---------|---------|--------|
| **Setup** | Simpler (1 API key) | More complex (2 credentials) |
| **Cost** | ~GH₵0.05/SMS | Similar |
| **Reliability** | Good | Very high |
| **Age** | Newer | 20+ years |
| **Support** | Good | Excellent |
| **Best For** | Quick setup | Enterprise use |

**Both are good!** Pick whichever signup works for you.

---

**Ready?** Go to https://www.mnotify.com and sign up!

**Questions?** Contact mNotify support or check their documentation.

**Good luck!** 🚀
