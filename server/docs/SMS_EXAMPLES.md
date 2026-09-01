# SMS Integration Examples

This document shows practical examples of where and how to add SMS notifications to your existing features.

## Table of Contents
1. [Exam Reminders](#exam-reminders)
2. [Venue Changes](#venue-changes)
3. [Invigilation Assignments](#invigilation-assignments)
4. [Timetable Updates](#timetable-updates)
5. [Emergency Notifications](#emergency-notifications)
6. [Password Reset](#password-reset)

---

## Exam Reminders

Send SMS to students 24 hours before their exam.

### Implementation:

```javascript
// In your exam reminder cron job or scheduled task
// server/src/jobs/examReminders.js

import { prisma } from '../utils/prisma.js';
import { createNotification } from '../modules/notifications/notifications.service.js';

export const sendExamReminders = async () => {
  // Get exams happening tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const upcomingExams = await prisma.examinationSession.findMany({
    where: {
      startDate: {
        gte: tomorrow,
        lte: tomorrowEnd,
      },
      status: 'SCHEDULED',
    },
    include: {
      course: {
        include: {
          enrolledStudents: {
            include: {
              student: true,
            },
          },
        },
      },
      venue: true,
    },
  });

  // Send notification to each student
  for (const exam of upcomingExams) {
    const examTime = exam.startDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const enrollment of exam.course.enrolledStudents) {
      await createNotification({
        userId: enrollment.student.id,
        type: 'EXAM_REMINDER',
        title: 'Exam Tomorrow',
        message: `${exam.course.name} exam tomorrow at ${examTime} in ${exam.venue?.name || 'TBA'}. Please arrive 15 minutes early.`,
        link: `/timetable`,
        data: {
          examId: exam.id,
          courseId: exam.courseId,
          venueId: exam.venueId,
        },
        sendSms: true,  // ✅ Send SMS for exam reminders
        sendEmail: false,
      });
    }
  }

  console.log(`Sent reminders for ${upcomingExams.length} exams`);
};
```

### Setup Cron Job:

```javascript
// server/src/index.js or server/src/jobs/index.js

import cron from 'node-cron';
import { sendExamReminders } from './jobs/examReminders.js';

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Running exam reminder job...');
  await sendExamReminders();
});
```

---

## Venue Changes

Notify students and invigilators when exam venue changes.

### Implementation:

```javascript
// In your venue update handler
// server/src/modules/examinationSessions/examinationSessions.service.js

export const updateExaminationSession = async (sessionId, updates) => {
  const oldSession = await prisma.examinationSession.findUnique({
    where: { id: sessionId },
    include: {
      venue: true,
      course: {
        include: {
          enrolledStudents: {
            include: { student: true },
          },
        },
      },
      invigilators: {
        include: { user: true },
      },
    },
  });

  const updatedSession = await prisma.examinationSession.update({
    where: { id: sessionId },
    data: updates,
    include: { venue: true },
  });

  // If venue changed, notify everyone
  if (updates.venueId && updates.venueId !== oldSession.venueId) {
    const oldVenue = oldSession.venue?.name || 'TBA';
    const newVenue = updatedSession.venue?.name || 'TBA';

    // Notify all enrolled students
    for (const enrollment of oldSession.course.enrolledStudents) {
      await createNotification({
        userId: enrollment.student.id,
        type: 'VENUE_CHANGE',
        title: 'Exam Venue Changed',
        message: `${oldSession.course.name} venue changed from ${oldVenue} to ${newVenue}`,
        link: `/timetable`,
        data: { sessionId, oldVenue, newVenue },
        sendSms: true,  // ✅ Critical - venue changes need SMS
        sendEmail: true,
      });
    }

    // Notify all invigilators
    for (const invigilation of oldSession.invigilators) {
      await createNotification({
        userId: invigilation.user.id,
        type: 'VENUE_CHANGE',
        title: 'Invigilation Venue Changed',
        message: `Your invigilation for ${oldSession.course.name} has moved from ${oldVenue} to ${newVenue}`,
        link: `/invigilator-assignments`,
        data: { sessionId, oldVenue, newVenue },
        sendSms: true,  // ✅ Critical for invigilators
        sendEmail: true,
      });
    }
  }

  return updatedSession;
};
```

---

## Invigilation Assignments

Notify invigilators when assigned to an exam.

### Implementation:

```javascript
// server/src/modules/invigilations/invigilations.service.js

export const assignInvigilator = async ({ sessionId, userId, role }) => {
  const session = await prisma.examinationSession.findUnique({
    where: { id: sessionId },
    include: {
      course: true,
      venue: true,
    },
  });

  const invigilation = await prisma.invigilation.create({
    data: {
      examinationSessionId: sessionId,
      userId,
      role,
    },
  });

  // Notify the invigilator
  const examDate = session.startDate.toLocaleDateString();
  const examTime = session.startDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  await createNotification({
    userId,
    type: 'INVIGILATION_ASSIGNED',
    title: 'New Invigilation Assignment',
    message: `You've been assigned as ${role} for ${session.course.name} on ${examDate} at ${examTime} in ${session.venue?.name || 'TBA'}`,
    link: `/invigilator-assignments`,
    data: {
      invigilationId: invigilation.id,
      sessionId,
      role,
    },
    sendSms: true,  // ✅ Important assignment notification
    sendEmail: true,
  });

  return invigilation;
};
```

---

## Timetable Updates

Notify users when the timetable is published or updated.

### Implementation:

```javascript
// server/src/modules/timetable/timetable.service.js

export const publishTimetable = async (semesterId) => {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    include: {
      academicYear: true,
    },
  });

  // Mark timetable as published
  await prisma.timetable.update({
    where: { semesterId },
    data: { published: true, publishedAt: new Date() },
  });

  // Get all students and lecturers for this semester
  const affectedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'STUDENT' },
        { role: 'LECTURER' },
        { role: 'INVIGILATOR' },
      ],
      status: 'ACTIVE',
    },
  });

  // Notify all users
  const message = `The examination timetable for ${semester.name} (${semester.academicYear.name}) has been published. Check the portal for your schedule.`;

  for (const user of affectedUsers) {
    await createNotification({
      userId: user.id,
      type: 'TIMETABLE_PUBLISHED',
      title: 'Exam Timetable Published',
      message,
      link: `/timetable`,
      data: { semesterId },
      sendSms: true,  // ✅ Important for all users
      sendEmail: true,
    });
  }

  console.log(`Notified ${affectedUsers.length} users about timetable publication`);
};
```

---

## Emergency Notifications

Broadcast emergency messages to all active users.

### Implementation:

```javascript
// server/src/modules/notifications/notifications.service.js

export const sendEmergencyBroadcast = async ({ title, message, link, senderId }) => {
  // Get all active users
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  // Log the emergency broadcast
  await prisma.auditLog.create({
    data: {
      userId: senderId,
      action: 'EMERGENCY_BROADCAST',
      entity: 'NOTIFICATION',
      details: { title, message, recipientCount: users.length },
    },
  });

  // Send to all users
  const results = await Promise.allSettled(
    users.map(user =>
      createNotification({
        userId: user.id,
        type: 'EMERGENCY',
        title,
        message,
        link,
        data: { senderId, timestamp: new Date() },
        sendSms: true,  // ✅ Emergency = SMS to everyone
        sendEmail: true,
      })
    )
  );

  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Emergency broadcast: ${successful}/${users.length} notifications sent`);

  return { total: users.length, successful };
};
```

### API Endpoint:

```javascript
// server/src/modules/notifications/notifications.controller.js

export const notificationsController = {
  // ... existing methods

  emergencyBroadcast: asyncHandler(async (req, res) => {
    // Only SUPER_ADMIN can send emergency broadcasts
    if (req.user.role !== 'SUPER_ADMIN') {
      throw new ApiError(403, 'Only super admins can send emergency broadcasts');
    }

    const { title, message, link } = req.body;

    if (!title || !message) {
      throw new ApiError(400, 'Title and message are required');
    }

    const result = await sendEmergencyBroadcast({
      title,
      message,
      link,
      senderId: req.user.id,
    });

    res.json({
      success: true,
      message: 'Emergency broadcast sent',
      data: result,
    });
  }),
};
```

---

## Password Reset

Send SMS with password reset code.

### Implementation:

```javascript
// server/src/modules/auth/auth.service.js

import { sendSMS, formatGhanaPhone } from '../../utils/sms.js';

export const requestPasswordReset = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Don't reveal if user exists
    return { success: true };
  }

  // Generate reset code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token: resetCode,
      expiresAt,
    },
  });

  // Send via email
  await sendEmail({
    to: user.email,
    subject: 'Password Reset Code',
    html: `Your password reset code is: <strong>${resetCode}</strong><br>Valid for 15 minutes.`,
  });

  // Send via SMS if phone number exists
  if (user.phoneNumber) {
    const phone = formatGhanaPhone(user.phoneNumber);
    if (phone) {
      await sendSMS({
        to: phone,
        message: `Your UENR Exam System password reset code is: ${resetCode}. Valid for 15 minutes. Do not share this code.`,
      });
    }
  }

  return { success: true };
};
```

---

## Best Practices

### 1. Always Include sendSms Parameter

```javascript
// ✅ Good - explicit control
await createNotification({
  userId,
  type: 'INFO',
  title: 'Update',
  message: 'Non-urgent update',
  sendSms: false,  // Explicit - don't send SMS
});

// ❌ Bad - unclear intention
await createNotification({
  userId,
  type: 'INFO',
  title: 'Update',
  message: 'Non-urgent update',
});
```

### 2. Keep SMS Messages Short

```javascript
// ✅ Good - concise
message: `Exam tomorrow at 9 AM in Room 301`

// ❌ Bad - too long
message: `Dear student, this is to inform you that your examination for the course Mathematics 101 has been scheduled for tomorrow at 9:00 AM in Room 301. Please ensure you arrive 15 minutes early...`
```

### 3. Use SMS for Time-Sensitive Info

```javascript
// ✅ Send SMS
- Exam in 24 hours
- Venue changed
- Emergency alerts
- Urgent assignments

// ❌ Don't send SMS
- General announcements
- Reminders > 7 days out
- Read receipts
- Minor updates
```

### 4. Handle Failures Gracefully

```javascript
try {
  await createNotification({
    userId,
    type: 'IMPORTANT',
    title: 'Title',
    message: 'Message',
    sendSms: true,
  });
} catch (error) {
  // Notification service catches SMS errors internally
  // This won't throw even if SMS fails
  console.log('Notification created (SMS may have failed)');
}
```

### 5. Test with Your Own Number First

```javascript
// Always test before mass sending
if (process.env.NODE_ENV === 'development') {
  // Override recipient in development
  const testPhone = '+233YOUR_NUMBER';
  await sendSMS({ to: testPhone, message: 'Test message' });
} else {
  // Production - send to real users
  await sendToAllUsers();
}
```

---

## Testing Checklist

Before deploying SMS to production:

- [ ] Test with your own phone number
- [ ] Verify phone numbers are in E.164 format
- [ ] Check SMS provider dashboard for delivery status
- [ ] Test with both Ghana and international numbers
- [ ] Verify message length (< 160 chars for single SMS)
- [ ] Test failure scenarios (invalid number, no credits)
- [ ] Check logs for errors
- [ ] Verify costs in provider dashboard
- [ ] Test all notification types
- [ ] Ensure graceful degradation if SMS fails

---

## Cost Monitoring

Track SMS usage:

```javascript
// Add SMS usage tracking
export const trackSmsUsage = async (userId, cost, provider) => {
  await prisma.smsLog.create({
    data: {
      userId,
      cost,
      provider,
      sentAt: new Date(),
    },
  });
};

// Monthly cost report
export const getMonthlySmsReport = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const logs = await prisma.smsLog.findMany({
    where: {
      sentAt: { gte: startOfMonth },
    },
  });

  const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
  const totalSent = logs.length;

  return { totalCost, totalSent, averageCost: totalCost / totalSent };
};
```

---

For more information, see `SMS_INTEGRATION.md`
