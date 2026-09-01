# SMS Architecture & Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Your Application                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌─────────────────────┐          │
│  │  Event Triggers  │────────▶│  Notification       │          │
│  │                  │         │  Service            │          │
│  │ • Exam Reminder  │         │                     │          │
│  │ • Venue Change   │         │  createNotification │          │
│  │ • Assignment     │         │  notifyRole         │          │
│  │ • Emergency      │         │                     │          │
│  └──────────────────┘         └──────────┬──────────┘          │
│                                           │                      │
│                                           │ sendSms=true         │
│                                           ▼                      │
│                               ┌─────────────────────┐           │
│                               │   SMS Service       │           │
│                               │   (utils/sms.js)    │           │
│                               │                     │           │
│                               │  • sendSMS()        │           │
│                               │  • formatPhone()    │           │
│                               │  • isSMSConfigured  │           │
│                               └──────────┬──────────┘           │
│                                          │                      │
│                                          │ Try providers        │
│                                          │ in order             │
│                                          ▼                      │
│                           ┌──────────────────────────┐         │
│                           │   Provider Selection     │         │
│                           │                          │         │
│                           │   1. Twilio              │         │
│                           │   2. Africa's Talking    │         │
│                           │   3. Termii              │         │
│                           └──────────┬───────────────┘         │
└────────────────────────────────────┼─────────────────────────┘
                                     │
                                     │ SMS API Call
                                     ▼
                    ┌────────────────────────────────┐
                    │   External SMS Providers       │
                    ├────────────────────────────────┤
                    │                                │
                    │  ┌──────────────────────┐     │
                    │  │  Twilio              │     │
                    │  │  • Global coverage   │     │
                    │  │  • Most reliable     │     │
                    │  └──────────────────────┘     │
                    │                                │
                    │  ┌──────────────────────┐     │
                    │  │  Africa's Talking    │     │
                    │  │  • Africa-focused    │     │
                    │  │  • Good pricing      │     │
                    │  └──────────────────────┘     │
                    │                                │
                    │  ┌──────────────────────┐     │
                    │  │  Termii              │     │
                    │  │  • West Africa       │     │
                    │  │  • Local support     │     │
                    │  └──────────────────────┘     │
                    └────────────┬───────────────────┘
                                 │
                                 │ SMS Delivery
                                 ▼
                         ┌──────────────┐
                         │   User's     │
                         │   Phone      │
                         └──────────────┘
```

## Notification Flow

### Step-by-Step Process

```
1. Event Occurs
   └─▶ Exam scheduled, venue changed, etc.

2. Notification Created
   └─▶ createNotification({ ..., sendSms: true })

3. Database Record
   └─▶ Notification saved to database

4. WebSocket Broadcast
   └─▶ Real-time notification sent to user's browser

5. SMS Decision
   └─▶ If sendSms=true AND user has phone number

6. Phone Number Formatting
   └─▶ formatGhanaPhone("0201234567") → "+233201234567"

7. Provider Selection
   ├─▶ Try Twilio (if configured)
   │   └─▶ Success? → Done ✅
   │   └─▶ Failed? → Try next
   ├─▶ Try Africa's Talking (if configured)
   │   └─▶ Success? → Done ✅
   │   └─▶ Failed? → Try next
   └─▶ Try Termii (if configured)
       └─▶ Success? → Done ✅
       └─▶ Failed? → Log error, continue ⚠️

8. Application Continues
   └─▶ SMS failure doesn't break the notification
```

## Code Flow Example

### Exam Reminder Scenario

```javascript
// 1. Cron job runs at 9 AM daily
cron.schedule('0 9 * * *', async () => {
  
  // 2. Find exams happening tomorrow
  const exams = await findExamsTomorrow();
  
  // 3. For each exam
  for (const exam of exams) {
    
    // 4. For each enrolled student
    for (const student of exam.students) {
      
      // 5. Create notification with SMS
      await createNotification({
        userId: student.id,
        type: 'EXAM_REMINDER',
        title: 'Exam Tomorrow',
        message: `${exam.course} exam at ${exam.time}`,
        sendSms: true,  // ← Triggers SMS flow
      });
      
      // 6. Inside createNotification():
      //    a. Save to database
      //    b. Broadcast to WebSocket
      //    c. If sendSms=true:
      //       - Get user's phone number
      //       - Format to E.164
      //       - Call sendSMS()
      //    d. Return (SMS happens async)
    }
  }
});
```

### SMS Service Internal Flow

```javascript
// sendSMS({ to: "+233201234567", message: "..." })

1. Validate phone number
   if (!to.startsWith('+')) → Error

2. Truncate message to 500 chars
   message = message.substring(0, 500)

3. Try Twilio
   if (TWILIO configured) {
     try { send via Twilio } 
     catch { continue to next }
   }

4. Try Africa's Talking
   if (AFRICASTALKING configured) {
     try { send via Africa's Talking }
     catch { continue to next }
   }

5. Try Termii
   if (TERMII configured) {
     try { send via Termii }
     catch { return error }
   }

6. No provider configured
   return { success: false, skipped: true }
```

## Database Schema

### User Model (Required Fields)

```prisma
model User {
  id          String  @id @default(cuid())
  email       String  @unique
  phoneNumber String? // ← Required for SMS (E.164 format)
  name        String
  role        Role
  status      Status
  
  notifications Notification[]
}
```

### Notification Model

```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  message   String
  link      String?
  data      Json?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id])
}
```

## Configuration Flow

```
Environment Variables (.env)
    │
    ├─▶ TWILIO_ACCOUNT_SID ─────┐
    ├─▶ TWILIO_AUTH_TOKEN ──────┤
    ├─▶ TWILIO_PHONE_NUMBER ────┤
    │                            │
    ├─▶ AFRICASTALKING_USERNAME ┤
    ├─▶ AFRICASTALKING_API_KEY ─┤
    │                            │
    ├─▶ TERMII_API_KEY ─────────┤
    └─▶ TERMII_SENDER_ID ────────┤
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  env.js          │
                        │  (Zod Validation)│
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  SMS Service     │
                        │  (Check config)  │
                        └────────┬─────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Provider Setup  │
                        │  • Twilio Client │
                        │  • AT Client     │
                        │  • Termii API    │
                        └──────────────────┘
```

## Error Handling Strategy

```
┌───────────────────────────────────────────────────────┐
│              Error Handling Layers                     │
├───────────────────────────────────────────────────────┤
│                                                        │
│  Layer 1: Phone Number Validation                     │
│  ├─ Invalid format? → Return error immediately        │
│  └─ Valid? → Continue                                 │
│                                                        │
│  Layer 2: Provider Configuration Check                │
│  ├─ No provider configured? → Skip SMS, log warning   │
│  └─ Has provider? → Continue                          │
│                                                        │
│  Layer 3: Provider Execution                          │
│  ├─ Provider 1 fails? → Try Provider 2               │
│  ├─ Provider 2 fails? → Try Provider 3               │
│  └─ All fail? → Log error, return failure            │
│                                                        │
│  Layer 4: Notification Service                        │
│  ├─ SMS fails? → Log error, notification still saved  │
│  └─ SMS succeeds? → Log success                       │
│                                                        │
│  Layer 5: Application Logic                           │
│  ├─ Notification fails? → Log, don't break request   │
│  └─ Continue application flow                         │
│                                                        │
└───────────────────────────────────────────────────────┘

Result: Application NEVER breaks due to SMS failure ✅
```

## Provider Comparison Matrix

```
┌──────────────┬──────────┬────────────┬───────────┬──────────┐
│   Feature    │  Twilio  │ Africa's T │   Termii  │   Notes  │
├──────────────┼──────────┼────────────┼───────────┼──────────┤
│ Global       │    ✅    │     ❌     │    ❌     │          │
│ Africa       │    ✅    │     ✅     │    ✅     │          │
│ Ghana        │    ✅    │     ✅     │    ✅     │          │
│ Free Trial   │   $15    │    Yes     │    Yes    │          │
│ Setup Time   │  15 min  │   20 min   │  15 min   │          │
│ Reliability  │  ⭐⭐⭐⭐⭐ │   ⭐⭐⭐⭐    │   ⭐⭐⭐   │          │
│ Docs Quality │  ⭐⭐⭐⭐⭐ │   ⭐⭐⭐⭐    │   ⭐⭐⭐   │          │
│ Cost (Ghana) │  $0.0075 │ Competitive│  Local    │  per SMS │
│ Support      │  24/7    │   Email    │   Email   │          │
└──────────────┴──────────┴────────────┴───────────┴──────────┘
```

## Security Layers

```
┌─────────────────────────────────────────────────────┐
│              Security Measures                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Environment Variables                           │
│     ├─ Credentials never in code                    │
│     └─ Validated by Zod schema                      │
│                                                      │
│  2. Phone Number Validation                         │
│     ├─ Must be E.164 format                         │
│     └─ Country code required                        │
│                                                      │
│  3. Message Length Limits                           │
│     ├─ Max 500 characters                           │
│     └─ Prevents excessive charges                   │
│                                                      │
│  4. Test Endpoint Access Control                    │
│     ├─ SUPER_ADMIN only                             │
│     └─ JWT authentication required                  │
│                                                      │
│  5. Rate Limiting (Recommended)                     │
│     ├─ Limit SMS per user per hour                  │
│     └─ Prevent SMS bombing                          │
│                                                      │
│  6. Logging (No PII)                                │
│     ├─ Log user IDs, not phone numbers              │
│     └─ Track success/failure rates                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## Performance Considerations

```
┌─────────────────────────────────────────────────┐
│           Performance Optimization              │
├─────────────────────────────────────────────────┤
│                                                  │
│  Async Processing                               │
│  └─▶ SMS sent asynchronously                    │
│      └─▶ Doesn't block main request             │
│                                                  │
│  Batch Notifications                            │
│  └─▶ Promise.all() for multiple users           │
│      └─▶ Parallel execution                     │
│                                                  │
│  Provider Caching                               │
│  └─▶ Client instances reused                    │
│      └─▶ Reduces overhead                       │
│                                                  │
│  Graceful Degradation                           │
│  └─▶ SMS failure doesn't affect notification    │
│      └─▶ User still gets in-app notification    │
│                                                  │
│  Smart Retries                                  │
│  └─▶ Try multiple providers                     │
│      └─▶ Automatic fallback                     │
│                                                  │
└─────────────────────────────────────────────────┘
```

## Monitoring & Logging

```
Log Levels:
  [sms] Attempting to send via Twilio to: +233...  (INFO)
  [sms] Twilio success, SID: SM...                 (INFO)
  [sms] Twilio failed: Invalid phone number        (ERROR)
  [sms] No SMS service configured                  (WARN)
  [notification] No phone number for user: abc123  (WARN)
  [notification] SMS send failed: Insufficient...  (ERROR)

Dashboard Metrics (Recommended):
  • Total SMS sent today
  • Success rate per provider
  • Failed SMS count
  • Monthly cost
  • Average delivery time
  • User opt-out rate
```

## Integration Points

```
Your Application Code
    │
    ├─▶ Exam Management Module
    │   └─▶ createNotification({ sendSms: true })
    │
    ├─▶ Venue Management Module
    │   └─▶ notifyRole('STUDENT', { sendSms: true })
    │
    ├─▶ Invigilation Module
    │   └─▶ createNotification({ sendSms: true })
    │
    ├─▶ Emergency Broadcast
    │   └─▶ sendEmergencyBroadcast({ sendSms: true })
    │
    └─▶ Password Reset
        └─▶ sendSMS({ to, message })
```

## Testing Strategy

```
1. Unit Tests
   └─▶ Test formatGhanaPhone()
   └─▶ Test phone validation
   └─▶ Test provider selection logic

2. Integration Tests
   └─▶ Test with mock providers
   └─▶ Test error handling
   └─▶ Test fallback mechanism

3. Manual Testing
   └─▶ Send test SMS via /test-sms endpoint
   └─▶ Verify delivery
   └─▶ Check provider dashboard
   └─▶ Test with different phone formats

4. Production Testing
   └─▶ Start with small user group
   └─▶ Monitor logs
   └─▶ Track costs
   └─▶ Gather user feedback
```

---

For implementation details, see `SMS_INTEGRATION.md`
For code examples, see `SMS_EXAMPLES.md`
For quick setup, see `SMS_SETUP_GUIDE.md`
