# Arkesel SMS Setup Guide - Best for Ghana 🇬🇭

## Why Arkesel?

✅ **Ghana-based company** - Local support  
✅ **Very cheap** - ~GH₵0.05 per SMS (~$0.003 USD)  
✅ **No verification needed** - Send to any number immediately  
✅ **Pay with Mobile Money** - Easy top-up  
✅ **Direct carrier connections** - MTN, Vodafone, AirtelTigo  
✅ **Already integrated** - Just add API key!

---

## Cost Breakdown

### SMS Pricing:
- **Per SMS**: GH₵0.05 (~$0.003 USD)
- **100 SMS**: GH₵5 (~$0.30)
- **500 SMS**: GH₵25 (~$1.50)
- **1000 SMS**: GH₵50 (~$3.00)

### Your Estimated Usage:
```
Exam reminders: 500 SMS/semester = GH₵25 ($1.50)
Venue changes: 20 SMS/month = GH₵1 ($0.06)
Emergency alerts: 5 SMS/month = GH₵0.25 ($0.015)

Total per semester: ~GH₵27 ($1.65)
Total per year: ~GH₵55 ($3.30)
```

**Less than a lunch per year!** 🍕

---

## Quick Setup (10 Minutes)

### Step 1: Create Arkesel Account

1. **Go to**: https://arkesel.com
2. **Click**: "Sign Up" or "Get Started"
3. **Fill in**:
   - Your email
   - Password
   - Organization name (UENR)
   - Phone number

### Step 2: Verify Your Account

1. **Check email** for verification link
2. **Click link** to verify
3. **Log in** to your account

### Step 3: Get Your API Key

After logging in:

1. Go to **Settings** or **API** section
2. Look for **API Key** or **Developer Settings**
3. **Copy your API key**
   - Should look like: `ark_live_xxxxxxxxxxxxxxxxxxxxxxxx`
4. **Save it securely!**

### Step 4: Top Up Credits (Optional for Testing)

Arkesel may give you small trial credits. If not:

1. Go to **Billing** or **Top Up**
2. Select amount (minimum GH₵10)
3. Choose payment method:
   - **Mobile Money** (MTN, Vodafone, AirtelTigo)
   - **Card** (Visa, Mastercard)
4. Complete payment

### Step 5: Configure Your App

Add to `server/.env`:

```bash
# Arkesel SMS (Ghana)
ARKESEL_API_KEY="ark_live_your_api_key_here"
ARKESEL_SENDER_ID="UENR"
```

**Important**: 
- Replace `ark_live_your_api_key_here` with your actual API key
- `ARKESEL_SENDER_ID` can be your brand name (e.g., "UENR", "UENRExams")

### Step 6: Restart Server

```bash
cd server
npm run dev
```

### Step 7: Test It!

Send a test SMS:

```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0201234567",
    "message": "Test SMS from UENR Exam System!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "provider": "arkesel",
  "to": "+233201234567"
}
```

**Check your phone!** 📱

---

## Usage Examples

### Send Notification with SMS

```javascript
import { createNotification } from './modules/notifications/notifications.service.js';

// Exam reminder
await createNotification({
  userId: student.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Your Mathematics exam is tomorrow at 9 AM in Room 301',
  link: '/timetable',
  sendSms: true,  // ← Uses Arkesel!
});
```

### Notify All Lecturers

```javascript
import { notifyRole } from './modules/notifications/notifications.service.js';

await notifyRole('LECTURER', {
  type: 'TIMETABLE_UPDATE',
  title: 'Schedule Changed',
  message: 'The exam schedule has been updated',
  link: '/timetable',
  sendSms: true,  // ← All lecturers get SMS
});
```

---

## Sender ID (Brand Name)

Your SMS will show as coming from your **Sender ID** (e.g., "UENR").

### To Register a Custom Sender ID:

1. Log into Arkesel dashboard
2. Go to **Sender IDs**
3. Request new sender ID (e.g., "UENR", "UENRExams")
4. Provide:
   - Organization details
   - Registration documents (may be required)
5. Wait for approval (usually 24-48 hours)

**Until approved**, you can use:
- Default sender IDs
- Or a generic one

---

## Monitoring Usage

### Check Balance in Arkesel Dashboard:

1. Log into https://arkesel.com
2. View **Balance** on dashboard
3. See **SMS Usage** statistics
4. Check **Delivery Reports**

### Check in Your App:

View SMS logs:
```bash
grep "\[sms\]" logs/app.log
```

You'll see:
```
[sms] Attempting to send via Arkesel to: +233...
[sms] Arkesel success
```

---

## Topping Up Credits

### Via Mobile Money (Easiest):

1. Log into Arkesel
2. Go to **Top Up** or **Billing**
3. Enter amount (e.g., GH₵20)
4. Select Mobile Money
5. Choose network (MTN, Vodafone, AirtelTigo)
6. Complete payment on your phone

### Via Card:

1. Same steps as above
2. Select **Card Payment**
3. Enter card details
4. Complete payment

---

## Troubleshooting

### SMS Not Sending?

**1. Check API Key:**
```bash
# In server/.env
ARKESEL_API_KEY="ark_live_your_actual_key_here"
```

**2. Check Configuration:**
```bash
curl http://localhost:4000/api/test-sms/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Should return:
```json
{
  "smsConfigured": true,
  "message": "SMS service is configured and ready"
}
```

**3. Check Balance:**
- Log into Arkesel dashboard
- Verify you have credits

**4. Check Phone Format:**
- Must be E.164: `+233201234567`
- NOT: `0201234567` (but system auto-converts)

**5. Check Logs:**
```bash
grep "\[sms\]" logs/app.log
```

### Common Errors:

**"Invalid API Key"**
- Solution: Copy API key from dashboard again
- Ensure no extra spaces in `.env` file

**"Insufficient balance"**
- Solution: Top up credits in dashboard

**"Invalid phone number"**
- Solution: Ensure number is valid Ghana number
- Format: +233XXXXXXXXX

**"Sender ID not approved"**
- Solution: Use default sender ID while waiting for approval
- Or update `ARKESEL_SENDER_ID` to approved one

---

## Best Practices

### 1. Keep Messages Short
```javascript
// ✅ Good - 60 chars
"Exam tomorrow 9 AM, Room 301"

// ❌ Bad - 200 chars
"Dear student, this is to inform you that your examination..."
```

### 2. Monitor Credits
- Check balance weekly
- Set up low-balance alerts in Arkesel
- Top up before running low

### 3. Use SMS for Important Events Only
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

### 4. Test Before Bulk Sending
- Always test with 1-2 numbers first
- Verify delivery
- Check message format
- Then send to all users

---

## Cost Management Tips

### 1. Strategic SMS Usage
Only enable SMS for critical notifications:
```javascript
// High priority - Enable SMS
await createNotification({
  type: 'EXAM_REMINDER',
  sendSms: true,  // ✅
});

// Low priority - No SMS
await createNotification({
  type: 'GENERAL_ANNOUNCEMENT',
  sendSms: false,  // ❌
});
```

### 2. Batch Notifications
Send one SMS to many users at once (cheaper than individual):
```javascript
await notifyRole('STUDENT', {
  message: 'Exam schedule published',
  sendSms: true,
});
```

### 3. Use Templates
Create message templates to ensure consistency and brevity:
```javascript
const TEMPLATES = {
  EXAM_REMINDER: (course, time) => `Exam: ${course} at ${time}`,
  VENUE_CHANGE: (oldVenue, newVenue) => `Venue changed: ${oldVenue} → ${newVenue}`,
};
```

---

## Support

### Arkesel Support:
- **Website**: https://arkesel.com
- **Email**: support@arkesel.com (check their website)
- **Phone**: Check website for support number

### Your App:
- **Test Endpoint**: `POST /api/test-sms`
- **Check Status**: `GET /api/test-sms/status`
- **View Logs**: `grep "\[sms\]" logs/app.log`

---

## Security

### Protect Your API Key:
1. ✅ Keep in `.env` file (never commit)
2. ✅ Add `.env` to `.gitignore`
3. ✅ Don't share API key
4. ✅ Rotate key if compromised
5. ✅ Use environment variables in production

### In Production:
```bash
# Set environment variables on your server
export ARKESEL_API_KEY="ark_live_your_key"
export ARKESEL_SENDER_ID="UENR"
```

---

## Summary

✅ **Arkesel** = Best for Ghana  
💰 **Cost** = GH₵0.05/SMS (~$0.003)  
🚀 **Setup** = 10 minutes  
📱 **No verification** = Send to any number  
💳 **Payment** = Mobile Money or Card  
⚡ **Already integrated** = Just add API key  

**Total yearly cost for your usage: ~GH₵55 ($3.30)**

---

## Quick Start Checklist

- [ ] Sign up at https://arkesel.com
- [ ] Verify your email
- [ ] Get your API key
- [ ] Top up GH₵10-20 (optional for testing)
- [ ] Add API key to `server/.env`
- [ ] Restart server
- [ ] Test with `/api/test-sms` endpoint
- [ ] Send test SMS to your phone
- [ ] Enable SMS for critical notifications
- [ ] Monitor usage in dashboard

---

**You're all set!** 🎉

Start sending SMS notifications to your users for less than the cost of lunch! 🍕
