# SMS Quick Reference Card

## 🚀 Getting Started (5 Minutes)

### 1. Sign Up for Twilio (Free $15 Credit)
```
https://www.twilio.com/try-twilio
```

### 2. Add to `.env`
```bash
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_token_here"
TWILIO_PHONE_NUMBER="+15551234567"
```

### 3. Test
```bash
curl -X POST http://localhost:4000/api/test-sms \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"0201234567","message":"Test"}'
```

---

## 📝 Common Code Patterns

### Send Notification + SMS
```javascript
await createNotification({
  userId: user.id,
  type: 'EXAM_REMINDER',
  title: 'Exam Tomorrow',
  message: 'Your exam is tomorrow at 9 AM',
  sendSms: true,  // ← Add this
});
```

### Notify Role + SMS
```javascript
await notifyRole('LECTURER', {
  type: 'UPDATE',
  title: 'Timetable Updated',
  message: 'Please check the new schedule',
  sendSms: true,  // ← Add this
});
```

### Direct SMS (No Notification)
```javascript
import { sendSMS } from './utils/sms.js';

await sendSMS({
  to: '+233201234567',
  message: 'Your code is: 123456'
});
```

---

## 🔧 Utility Functions

### Format Ghana Phone Number
```javascript
import { formatGhanaPhone } from './utils/sms.js';

formatGhanaPhone('0201234567');    // → +233201234567
formatGhanaPhone('233201234567');  // → +233201234567
formatGhanaPhone('+233201234567'); // → +233201234567
```

### Check if SMS is Configured
```javascript
import { isSMSConfigured } from './utils/sms.js';

if (isSMSConfigured()) {
  // Send SMS
} else {
  // Skip SMS
}
```

---

## 🎯 When to Use SMS

### ✅ DO Send SMS For:
- Exam in 24 hours
- Venue changes
- Emergency alerts
- Critical assignments
- Password reset codes

### ❌ DON'T Send SMS For:
- General announcements
- Minor updates
- Read receipts
- Reminders > 7 days out
- Routine notifications

---

## 🔍 Test Endpoints

### Check Status
```bash
GET /api/test-sms/status
Authorization: Bearer <SUPER_ADMIN_TOKEN>

Response:
{
  "smsConfigured": true,
  "message": "SMS service is configured and ready"
}
```

### Send Test SMS
```bash
POST /api/test-sms
Authorization: Bearer <SUPER_ADMIN_TOKEN>
Content-Type: application/json

{
  "phoneNumber": "0201234567",
  "message": "Test message"
}

Response:
{
  "success": true,
  "message": "SMS sent successfully",
  "provider": "twilio",
  "to": "+233201234567"
}
```

---

## 🐛 Troubleshooting

### SMS Not Sending?

1. **Check Configuration**
   ```bash
   curl http://localhost:4000/api/test-sms/status
   ```

2. **Check Logs**
   ```bash
   grep "\[sms\]" logs/app.log
   ```

3. **Common Fixes**
   - Invalid phone → Use +233... format
   - No provider → Set .env variables
   - No phone in DB → Update user records
   - Insufficient funds → Top up account

---

## 📊 SMS Providers

| Provider | Setup Link | Best For |
|----------|-----------|----------|
| **Twilio** | [twilio.com/try-twilio](https://www.twilio.com/try-twilio) | Testing, Global |
| **Africa's Talking** | [africastalking.com](https://africastalking.com) | Africa, Production |
| **Termii** | [termii.com](https://termii.com) | West Africa |

### Environment Variables

**Twilio:**
```bash
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

**Africa's Talking:**
```bash
AFRICASTALKING_USERNAME=""
AFRICASTALKING_API_KEY=""
AFRICASTALKING_SENDER_ID=""  # Optional
```

**Termii:**
```bash
TERMII_API_KEY=""
TERMII_SENDER_ID=""
```

---

## 💰 Cost Calculator

### Twilio (Ghana)
- **Per SMS**: $0.0075
- **100 SMS**: $0.75
- **500 SMS**: $3.75
- **1000 SMS**: $7.50

### Keep Costs Low
1. SMS only for critical events
2. Keep messages < 160 chars
3. Add user opt-out settings
4. Monitor usage in dashboard

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `SMS_SETUP_GUIDE.md` | Quick start guide |
| `server/docs/SMS_INTEGRATION.md` | Complete documentation |
| `server/docs/SMS_EXAMPLES.md` | Code examples |
| `server/docs/SMS_ARCHITECTURE.md` | System architecture |
| `SMS_QUICK_REFERENCE.md` | This file |

---

## 🔐 Security Checklist

- ✅ Credentials in .env (never in code)
- ✅ Phone numbers validated (E.164)
- ✅ Message length limited (500 chars)
- ✅ Test endpoint (SUPER_ADMIN only)
- ✅ Error handling (graceful degradation)
- ✅ Logs (no PII)

---

## 📱 Phone Number Format

```
❌ Wrong:          ✅ Correct:
0201234567         +233201234567
233201234567       +233201234567
020-123-4567       +233201234567
(020) 123 4567     +233201234567
```

**Use the helper:**
```javascript
const formatted = formatGhanaPhone(userInput);
```

---

## 🎓 Learning Path

1. ✅ Read `SMS_SETUP_GUIDE.md`
2. ✅ Set up one provider (Twilio)
3. ✅ Test with `/test-sms` endpoint
4. ✅ Read `SMS_EXAMPLES.md`
5. ✅ Enable SMS for one event
6. ✅ Monitor logs and costs
7. ✅ Gradually enable more events

---

## 💡 Pro Tips

1. **Start Small**: Enable SMS for one critical event first
2. **Test Thoroughly**: Use your own phone number
3. **Monitor Costs**: Check provider dashboard daily
4. **User Preferences**: Plan to add opt-out feature
5. **Message Templates**: Keep messages consistent
6. **Delivery Tracking**: Monitor success rates
7. **Fallback Providers**: Configure 2+ providers

---

## 🆘 Quick Help

**SMS not working?**
→ Check logs: `grep "\[sms\]" logs/app.log`

**Invalid phone error?**
→ Use E.164 format: `+233201234567`

**No SMS provider configured?**
→ Add credentials to `.env` file

**Insufficient funds?**
→ Top up in provider dashboard

**Need more help?**
→ See full docs in `server/docs/SMS_INTEGRATION.md`

---

## 📞 Support

- **Twilio**: [support.twilio.com](https://support.twilio.com)
- **Africa's Talking**: support@africastalking.com
- **Termii**: [termii.com/contact](https://termii.com/contact)

---

**Quick Links:**
- Dashboard: Provider console (check deliveries)
- Logs: `grep "\[sms\]" logs/app.log`
- Test: `POST /api/test-sms`
- Docs: `server/docs/`
