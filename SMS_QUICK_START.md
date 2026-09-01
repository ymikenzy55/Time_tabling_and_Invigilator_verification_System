# SMS Quick Start - Get SMS Working in 15 Minutes!

## The Simplest Path Forward 🎯

**Stop overthinking. Follow these 3 steps:**

---

## Step 1: Pick a Provider (2 minutes)

Try them in this order until one works:

### Option A: Hubtel (Most Reliable)
- Go to: **https://hubtel.com**
- Sign up
- Works? → Continue with Hubtel ✅
- Doesn't work? → Try Option B

### Option B: mNotify (Easiest Setup)
- Go to: **https://www.mnotify.com**
- Sign up
- Works? → Continue with mNotify ✅
- Doesn't work? → Contact me for alternatives

---

## Step 2: Get Credentials (5 minutes)

### If Using Hubtel:
1. Log into dashboard
2. Find **API** or **Developer** section
3. Copy these 2 things:
   - ✅ **Client ID**
   - ✅ **Client Secret**
4. Top up **GH₵20** with Mobile Money

### If Using mNotify:
1. Log into dashboard
2. Find **API** or **Settings**
3. Copy this 1 thing:
   - ✅ **API Key**
4. Top up **GH₵20** with Mobile Money

---

## Step 3: Configure & Test (8 minutes)

### Add to `server/.env`:

**For Hubtel:**
```bash
HUBTEL_CLIENT_ID="paste_your_client_id_here"
HUBTEL_CLIENT_SECRET="paste_your_secret_here"
HUBTEL_SENDER_ID="UENR"
```

**For mNotify:**
```bash
MNOTIFY_API_KEY="paste_your_api_key_here"
MNOTIFY_SENDER_ID="UENR"
```

### Restart server:
```bash
cd server
npm run dev
```

### Test:
```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0201234567","message":"Test!"}'
```

### Check your phone!
✅ SMS received? **Done!** 🎉  
❌ SMS not received? Check logs: `grep "\[sms\]" logs/app.log`

---

## That's It!

**Total time:** 15 minutes  
**Total cost:** GH₵20 (~$1.20)  
**Result:** SMS working! ✅

---

## What's Involved?

### Money:
- **GH₵20** top-up (~$1.20)
- Gets you **400 SMS**
- Lasts **6+ months** for your usage
- **Less than lunch!** 🍕

### Time:
- **15 minutes** total setup
- **5 minutes** signup
- **5 minutes** get credentials
- **5 minutes** configure & test

### Technical Difficulty:
- ⭐⭐☆☆☆ (Very Easy)
- Copy/paste credentials
- No coding required
- Just follow steps

### What You Need:
- ✅ Email address
- ✅ Ghana phone number
- ✅ Mobile Money account
- ✅ GH₵20 (~$1.20)

---

## Common Questions

### Q: Do I need to pay monthly?
**A:** No! Only pay for SMS sent. GH₵20 lasts 6+ months.

### Q: Which provider should I choose?
**A:** Doesn't matter much. Try Hubtel first (most reliable), if doesn't work try mNotify (easier).

### Q: What if neither works?
**A:** Your code supports 7 providers. We'll find one that works!

### Q: Is it hard to set up?
**A:** No! Just copy/paste credentials. 15 minutes total.

### Q: Will it work with all Ghana numbers?
**A:** Yes! MTN, Vodafone, AirtelTigo all supported.

### Q: Can I test before paying?
**A:** Some providers give small trial credits. But GH₵20 is so cheap, just pay and be done!

---

## Detailed Guides Available

If you need more help:

- **Hubtel**: Read `HUBTEL_SETUP.md`
- **mNotify**: Read `MNOTIFY_SETUP.md`
- **Compare**: Read `HUBTEL_VS_MNOTIFY.md`
- **All options**: Read `PICK_ANY_SMS_PROVIDER.md`

---

## Troubleshooting

### Can't sign up?
→ Try the other provider

### Can't find credentials?
→ Check dashboard → Settings/API/Developer

### SMS not sending?
→ Check logs: `grep "\[sms\]" logs/app.log`

### Need help?
→ Contact provider support or check their docs

---

## Bottom Line

**Don't overthink this!**

1. Pick Hubtel or mNotify
2. Sign up (5 min)
3. Get credentials (5 min)
4. Configure (5 min)
5. Done!

**Total: 15 minutes, GH₵20, and you're set for 6 months!**

---

## Ready? Let's Go! 🚀

**Right now:**
1. Open https://hubtel.com or https://www.mnotify.com
2. Click "Sign Up"
3. Follow the steps above
4. In 15 minutes, you'll be sending SMS!

**Stop reading. Start doing!** ✅

---

**Good luck!** You got this! 💪
