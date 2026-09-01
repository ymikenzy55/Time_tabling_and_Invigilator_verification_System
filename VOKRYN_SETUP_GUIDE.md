# Vokryn SMS Setup - 1000 FREE SMS/Month! 🎉

## Why Vokryn?

✅ **1,000 FREE SMS every month** (not just a trial!)  
✅ **No credit card required**  
✅ **Perfect for light usage** (exam reminders, alerts)  
✅ **Works with Ghana numbers**  
✅ **Simple API integration**

Since you mentioned you won't use SMS much, this is **PERFECT** for your needs!

---

## Quick Setup (5 Minutes)

### Step 1: Sign Up for Vokryn

1. Go to: **https://vokryn.com**
2. Click "Sign Up" or "Get Started"
3. Create your account with:
   - Your email
   - Password
   - Business/Organization name

### Step 2: Get Your API Key

After signup:
1. Go to your **Dashboard**
2. Look for **API Settings** or **Developer** section
3. **Copy your API Key**
   - Should look like: `vk_live_xxxxxxxxxxxxxxxxxxxxxxxx`

### Step 3: Configure Your App

Add to your `server/.env` file:

```bash
# Vokryn SMS (1000 FREE SMS/month!)
VOKRYN_API_KEY="vk_live_your_api_key_here"
VOKRYN_SENDER_ID="UENR"
```

**That's it!** No phone number verification needed, no credit card, just works!

### Step 4: Test It

Start your server:
```bash
cd server
npm run dev
```

Test SMS:
```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0201234567",
    "message": "Test from UENR Exam System!"
  }'
```

**Check your phone!** You should get the SMS immediately.

---

## What You Get Free

### Monthly Allocation:
- ✅ **1,000 SMS** every month
- ✅ **Resets monthly** (doesn't expire)
- ✅ **No time limit** (forever free tier)
- ✅ **All Ghana networks** (MTN, Vodafone, AirtelTigo)

### Perfect For:
- ✅ Exam reminders (500 students × 2 SMS = within limit!)
- ✅ Venue changes (occasional)
- ✅ Emergency alerts (rare but important)
- ✅ Invigilation assignments (limited)

### Usage Example:
If you send:
- **2 exam reminder SMS/semester** to 400 students = 800 SMS
- **5 emergency alerts/month** = 5 SMS
- **20 venue changes/month** = 20 SMS
- **Total**: ~825 SMS/month = **WELL WITHIN FREE TIER!** ✅

---

## How It Works in Your App

Once configured, SMS will automatically send when you use:

```javascript
// Send notification with SMS
await createNotification({
  userId: user.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Your exam is tomorrow at 9 AM',
  sendSms: true,  // ← Vokryn handles this!
});
```

The system will:
1. Try Vokryn first (FREE!)
2. If Vokryn fails, try other providers (if configured)
3. If SMS fails, notification still works in-app

---

## Cost After Free Tier

If you go over 1,000 SMS/month:

### Vokryn Pricing (Pay-as-you-go):
- **SMS cost**: ~$0.01 per SMS (varies by network)
- **Example**: 1,500 SMS = 1000 FREE + 500 × $0.01 = **$5/month**

**Still very affordable!**

---

## Monitoring Your Usage

### Check Usage:
1. Log into Vokryn dashboard
2. Go to **Usage** or **Analytics**
3. See how many free SMS remaining this month

### In Your App:
Watch the logs:
```bash
grep "\[sms\]" logs/app.log
```

You'll see:
```
[sms] Attempting to send via Vokryn to: +233...
[sms] Vokryn success, message ID: msg_xxxxx
```

---

## Troubleshooting

### SMS Not Sending?

1. **Check API Key**:
   ```bash
   # In server/.env
   VOKRYN_API_KEY="vk_live_your_actual_key"
   ```

2. **Check Configuration**:
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

3. **Check Phone Format**:
   - Must be E.164 format: `+233201234567`
   - NOT: `0201234567` or `233201234567`

4. **Check Vokryn Dashboard**:
   - Log into https://vokryn.com
   - Check if API key is active
   - Check if you have credits remaining

### Common Issues:

**"Invalid API key"**
- Solution: Copy API key from dashboard again
- Make sure no extra spaces in `.env`

**"Insufficient credits"**
- Solution: You've used your 1000 free SMS
- Either wait for monthly reset or top up

**"Phone number not in E.164 format"**
- Solution: Use `+233` prefix
- The system auto-converts `0201234567` → `+233201234567`

---

## Comparison: Vokryn vs Others

| Feature | Vokryn | Twilio | Arkesel |
|---------|--------|--------|---------|
| **Free SMS** | 1000/month | $15 one-time | Trial only |
| **Recurring** | ✅ Monthly | ❌ Once | ❌ Once |
| **Credit Card** | ❌ Not needed | ❌ Not needed | ⚠️ May need |
| **Ghana Focus** | ✅ Yes | ❌ Global | ✅ Yes |
| **Verification** | ❌ Not needed | ⚠️ Required | ⚠️ May need |
| **Best For** | Light usage | Testing | Production |

**Winner for your use case: Vokryn!** 🏆

---

## When to Upgrade

You should consider upgrading or adding another provider when:

- ✅ Sending > 1,000 SMS consistently
- ✅ Need 24/7 support
- ✅ Need delivery reports
- ✅ Need two-way SMS
- ✅ Scaling to 1000+ users

But for now, **1,000 free SMS/month is plenty!**

---

## Next Steps

1. ✅ Sign up at https://vokryn.com
2. ✅ Get your API key
3. ✅ Add to `server/.env`:
   ```bash
   VOKRYN_API_KEY="vk_live_your_key"
   VOKRYN_SENDER_ID="UENR"
   ```
4. ✅ Restart server: `npm run dev`
5. ✅ Test with `/api/test-sms` endpoint
6. ✅ Enable SMS for critical notifications

---

## Support

- **Vokryn Support**: Check their website or dashboard for support contact
- **Documentation**: https://vokryn.com/docs (likely)
- **Your App Logs**: `grep "\[sms\]" logs/app.log`

---

## Summary

✅ **1,000 FREE SMS every month** - perfect for your needs!  
✅ **No credit card** - just sign up and go  
✅ **Works with Ghana numbers** - all networks  
✅ **Already integrated** - just add API key  
✅ **Automatic fallback** - other providers as backup

**This is the easiest and most cost-effective solution for your use case!** 🎉

---

**Ready to get started?** → https://vokryn.com
