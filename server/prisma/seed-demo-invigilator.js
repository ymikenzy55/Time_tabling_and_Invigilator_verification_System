/**
 * Seed script: Creates a demo invigilator with isDemo=true and assigns them
 * to a few venues in the most recent examination session.
 *
 * Demo invigilators can scan at any time (no exam period or time window check),
 * but they must still be assigned to the venue they scan.
 *
 * Run with: node --env-file=.env server/prisma/seed-demo-invigilator.js
 *
 * Prerequisites:
 *   - At least one examination session exists (with venue assignments or without)
 *   - At least one venue exists
 *
 * Credentials:
 *   Email: demo.invigilator@uenr.edu.gh
 *   Password: Demo@2026
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo.invigilator@uenr.edu.gh';
const DEMO_PASSWORD = 'Demo@2026';

async function main() {
  console.log('[seed-demo-invigilator] Starting...');

  // 1. Find or create the demo invigilator
  let demoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  if (!demoUser) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    demoUser = await prisma.user.create({
      data: {
        email: DEMO_EMAIL,
        passwordHash,
        fullName: 'Demo Invigilator',
        staffId: 'DEMO-INV-001',
        role: 'INVIGILATOR',
        status: 'ACTIVE',
        isDemo: true,
        approvedAt: new Date(),
      },
    });
    console.log(`[seed-demo-invigilator] Created demo invigilator: ${demoUser.fullName} (${demoUser.email})`);
  } else {
    // Ensure isDemo is set if user already exists
    if (!demoUser.isDemo) {
      demoUser = await prisma.user.update({
        where: { id: demoUser.id },
        data: { isDemo: true, status: 'ACTIVE', role: 'INVIGILATOR' },
      });
      console.log(`[seed-demo-invigilator] Updated existing user to demo invigilator: ${demoUser.email}`);
    } else {
      console.log(`[seed-demo-invigilator] Demo invigilator already exists: ${demoUser.email}`);
    }
  }

  // 2. Find the most recent examination session
  const session = await prisma.examinationSession.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  if (!session) {
    console.log('[seed-demo-invigilator] No examination session found. Skipping venue assignments.');
    console.log('[seed-demo-invigilator] The demo invigilator can still log in, but has no assignments yet.');
    console.log('\n[seed-demo-invigilator] Summary:');
    console.log(`  - Demo invigilator: ${demoUser.fullName}`);
    console.log(`  - Email: ${DEMO_EMAIL}`);
    console.log(`  - Password: ${DEMO_PASSWORD}`);
    console.log('  - No venue assignments (no examination session exists)');
    return;
  }

  console.log(`[seed-demo-invigilator] Using examination session: ${session.name}`);

  // 3. Find venues in this session (from existing assignments), or any active venue
  const existingAssignments = await prisma.venueAssignment.findMany({
    where: { examinationSessionId: session.id },
    select: { venueId: true },
    distinct: ['venueId'],
  });

  let venueIds = existingAssignments.map((a) => a.venueId);

  // If no venues assigned yet, pick up to 3 active venues
  if (venueIds.length === 0) {
    const venues = await prisma.venue.findMany({
      where: { isActive: true },
      take: 3,
      orderBy: { name: 'asc' },
    });
    venueIds = venues.map((v) => v.id);
  }

  if (venueIds.length === 0) {
    console.log('[seed-demo-invigilator] No venues found. Skipping venue assignments.');
    return;
  }

  console.log(`[seed-demo-invigilator] Found ${venueIds.length} venue(s) to assign.`);

  // 4. Create venue assignments for the demo invigilator
  // Assign 3 venues per day for 5 days (or until end of exam session)
  // This gives the demo user enough venues to demonstrate scanning to the professor
  const today = new Date();
  const sessionEndDate = new Date(session.endDate);
  
  // Determine how many days to generate assignments for
  // Use the earlier of: 5 days from today OR the session end date
  const maxDays = 5;
  const daysUntilSessionEnd = Math.ceil((sessionEndDate - today) / (24 * 60 * 60 * 1000));
  const numDays = Math.min(maxDays, Math.max(1, daysUntilSessionEnd));
  
  console.log(`[seed-demo-invigilator] Generating assignments for ${numDays} day(s)...`);

  const timeSlotHours = [8, 11, 14]; // 8:00 AM, 11:00 AM, 2:00 PM
  let assignedCount = 0;
  let skippedCount = 0;

  // For each day
  for (let dayOffset = 0; dayOffset < numDays; dayOffset++) {
    const currentDate = new Date(Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + dayOffset
    ));

    console.log(`[seed-demo-invigilator] Generating assignments for day ${dayOffset + 1}: ${currentDate.toISOString().split('T')[0]}`);

    // For each time slot (8 AM, 11 AM, 2 PM)
    for (let slotIndex = 0; slotIndex < timeSlotHours.length; slotIndex++) {
      // Pick a venue (cycle through available venues)
      const venueIndex = (dayOffset * timeSlotHours.length + slotIndex) % venueIds.length;
      const venueId = venueIds[venueIndex];

      // Create the slot time
      const slotAt = new Date(currentDate.getTime() + timeSlotHours[slotIndex] * 60 * 60 * 1000);

      // Check if assignment already exists
      const existing = await prisma.venueAssignment.findUnique({
        where: {
          examinationSessionId_venueId_slotAt_invigilatorId: {
            examinationSessionId: session.id,
            venueId,
            slotAt,
            invigilatorId: demoUser.id,
          },
        },
      });

      if (existing) {
        console.log(`[seed-demo-invigilator] Assignment already exists for venue ${venueId} on ${slotAt.toISOString()}`);
        skippedCount++;
        continue;
      }

      // Get venue name for logging
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        select: { name: true },
      });

      await prisma.venueAssignment.create({
        data: {
          examinationSessionId: session.id,
          venueId,
          invigilatorId: demoUser.id,
          slotAt,
        },
      });
      
      const timeStr = slotAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      console.log(`[seed-demo-invigilator] ✓ Assigned ${venue?.name || venueId} at ${timeStr}`);
      assignedCount++;
    }
  }

  console.log(`[seed-demo-invigilator] Assigned demo invigilator to ${assignedCount} venue(s), skipped ${skippedCount} existing.`);

  console.log('\n[seed-demo-invigilator] Summary:');
  console.log(`  - Demo invigilator: ${demoUser.fullName}`);
  console.log(`  - Email: ${DEMO_EMAIL}`);
  console.log(`  - Password: ${DEMO_PASSWORD}`);
  console.log(`  - Examination session: ${session.name}`);
  console.log(`  - Total venue assignments: ${assignedCount} (across ${numDays} day(s), 3 venues per day)`);
  console.log('  - Demo mode: can scan at any time, but must be at an assigned venue');
  console.log('\n[seed-demo-invigilator] Demo invigilator is ready for demonstration!');
}

main()
  .catch((err) => {
    console.error('[seed-demo-invigilator] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
