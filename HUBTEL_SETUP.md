# Hubtel SMS Setup Guide - Step by Step

## About Hubtel

- 🇬🇭 **Ghana's most established** (20+ years)
- ✅ **Very reliable** - Used by banks and big companies
- 💳 **Pay-as-you-go** - No monthly fees
- 📱 **Mobile Money** - Easy top-up
- 🔒 **Trusted** - Most professional option

---

## Cost

- **Per SMS**: Similar to others (~GH₵0.05-0.10)
- **Minimum top-up**: Usually GH₵10-20
- **No hidden fees**: Pay only for SMS sent

---

## What You Need

1. ✅ Email address
2. ✅ Phone number (Ghana)
3. ✅ Organization name (UENR)
4. ✅ Mobile Money account (for payment)

---

## Setup Steps (15-20 minutes)

### Step 1: Create Hubtel Account

1. **Go to**: https://hubtel.com
2. **Click**: "Sign Up" or "Get Started" or "Developers"
3. **Look for**: "Create Account" or "Register"

### Step 2: Choose Account Type

- Select **"Business"** or **"Developer"** account
- Fill in:
  - Organization: UENR
  - Your name
  - Email
  - Phone number
  - Password

### Step 3: Verify Your Account

1. **Check email** for verification link
2. **Click link** to verify
3. **Verify phone** (may send SMS code)
4. **Log in** to your new account

### Step 4: Access Developer/API Section

After logging in:

1. Go to **Dashboard**
2. Look for:
   - **"Developers"** or
   - **"API"** or
   - **"Integrations"** or
   - **"SMS API"**

### Step 5: Get Your API Credentials

You need **2 things**:

1. **Client ID** (also called "Account ID" or "App ID")
   - Looks like: `hxxxxxxx` or a long string
   
2. **Client Secret** (also called "API Key" or "Secret Key")
   - Looks like: Long alphanumeric string
   - **Keep this SECRET!**

**Where to find them:**
- Dashboard → **API Settings**
- Dashboard → **Developer** → **API Keys**
- Dashboard → **Account** → **API Credentials**

**If you can't find them:**
- Look for "Create API Key" or "Generate Credentials"
- Click to generate new credentials
- Copy and save them securely

### Step 6: Register Sender ID (Optional but Recommended)

Your SMS will show as from "Hubtel" by default. To use "UENR":

1. Go to **SMS** → **Sender IDs**
2. Click **"Register New Sender ID"**
3. Enter: `UENR`
4. Provide required documents (may need):
   - Business registration
   - ID/Authorization letter
5. Submit for approval (takes 24-48 hours)

**For now**: You can skip this and use default sender ID for testing

### Step 7: Top Up Your Account

1. Go to **Billing** or **Wallet** or **Top Up**
2. Choose amount: **GH₵20** (recommended to start)
3. Select payment method: **Mobile Money**
4. Choose network:
   - MTN Mobile Money
   - Vodafone Cash
   - AirtelTigo Money
5. Enter your number
6. **Approve payment** on your phone
7. Wait for confirmation

### Step 8: Configure Your App

Add to `server/.env`:

```bash
# Hubtel SMS
HUBTEL_CLIENT_ID="your_client_id_here"
HUBTEL_CLIENT_SECRET="your_client_secret_here"
HUBTEL_SENDER_ID="UENR"
```

**Important:**
- Replace with your actual credentials
- Keep the quotes
- No spaces around =

### Step 9: Restart Your Server

```bash
cd server
npm run dev
```

### Step 10: Test!

```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "0201234567",
    "message": "Test SMS from UENR via Hubtel!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "message": "SMS sent successfully",
  "provider": "hubtel",
  "to": "+233201234567"
}
```

**Check your phone!** 📱

---

## Troubleshooting

### Can't Find API Credentials?

**Try these locations:**
1. Dashboard → Developer
2. Dashboard → Settings → API
3. Dashboard → Account → Keys
4. Dashboard → Integrations

**Still can't find?**
- Contact Hubtel support
- Check their documentation
- Look for "How to get API credentials"

### Invalid Credentials Error?

1. ✅ Check Client ID is correct
2. ✅ Check Client Secret is correct
3. ✅ No extra spaces in `.env`
4. ✅ Restart server after changing `.env`

### Insufficient Balance?

1. Check wallet balance in dashboard
2. Top up with Mobile Money
3. Wait 2-5 minutes for credit to reflect

### SMS Not Delivered?

1. ✅ Check phone number format (+233XXXXXXXXX)
2. ✅ Check balance in Hubtel dashboard
3. ✅ Check delivery report in dashboard
4. ✅ Verify phone number is active

---

## Usage in Your App

Once configured, just use:

```javascript
await createNotification({
  userId: student.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Your exam is at 9 AM in Room 301',
  sendSms: true,  // ← Hubtel handles it automatically!
});
```

---

## Monitoring

### Check Balance:
Log into Hubtel dashboard → View wallet

### View SMS History:
Dashboard → SMS → Reports

### Check Delivery:
Dashboard → SMS → Delivery Reports

### In Your App:
```bash
grep "\[sms\]" logs/app.log
```

---

## Cost Management

### Your Estimated Usage:
- 500 SMS/semester = ~GH₵25-50
- 20 SMS/month = ~GH₵1-2
- **Total/semester**: ~GH₵30-60

### Top-Up Strategy:
- Start with GH₵20
- Top up when balance < GH₵10
- Set up low balance alerts in Hubtel

---

## Support

### Hubtel Support:
- **Website**: https://hubtel.com
- **Email**: support@hubtel.com
- **Phone**: Check website
- **Live Chat**: Usually available on website

### Documentation:
- Developer docs: https://developers.hubtel.com
- API reference: Check dashboard

---

## Security

✅ Keep Client Secret secure  
✅ Never commit `.env` to git  
✅ Add `.env` to `.gitignore`  
✅ Use environment variables in production  
✅ Rotate credentials if compromised  

---

## Summary

### What You Need:
1. ✅ Hubtel account (free signup)
2. ✅ Client ID + Client Secret
3. ✅ GH₵20 credit (Mobile Money)

### Total Time: 15-20 minutes
### Total Cost: GH₵20 startup (~$1.20)
### Result: SMS working for 6+ months! ✅

---

## Quick Checklist

- [ ] Sign up at hubtel.com
- [ ] Verify email and phone
- [ ] Get Client ID from dashboard
- [ ] Get Client Secret from dashboard
- [ ] Top up GH₵20 with Mobile Money
- [ ] Add credentials to `server/.env`
- [ ] Restart server
- [ ] Test with `/api/test-sms`
- [ ] Send test SMS to your phone
- [ ] Confirm SMS received
- [ ] Done! 🎉

---

**Ready to start?** Go to https://hubtel.com and sign up!

**Need help?** Check Hubtel documentation or contact their support.
