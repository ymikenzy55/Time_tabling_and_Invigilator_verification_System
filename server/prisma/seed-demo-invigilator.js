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
  // Use today's date with standard exam time slots
  const today = new Date();
  const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const timeSlots = [
    new Date(todayDate.getTime() + 8 * 60 * 60 * 1000),   // 8:00 AM
    new Date(todayDate.getTime() + 11 * 60 * 60 * 1000),  // 11:00 AM
    new Date(todayDate.getTime() + 14 * 60 * 60 * 1000),  // 2:00 PM
  ];

  let assignedCount = 0;
  for (let i = 0; i < venueIds.length; i++) {
    const venueId = venueIds[i];
    const slotAt = timeSlots[i % timeSlots.length];

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
      console.log(`[seed-demo-invigilator] Assignment already exists for venue ${venueId} at ${slotAt.toISOString()}`);
      assignedCount++;
      continue;
    }

    await prisma.venueAssignment.create({
      data: {
        examinationSessionId: session.id,
        venueId,
        invigilatorId: demoUser.id,
        slotAt,
      },
    });
    assignedCount++;
  }

  console.log(`[seed-demo-invigilator] Assigned demo invigilator to ${assignedCount} venue(s).`);

  console.log('\n[seed-demo-invigilator] Summary:');
  console.log(`  - Demo invigilator: ${demoUser.fullName}`);
  console.log(`  - Email: ${DEMO_EMAIL}`);
  console.log(`  - Password: ${DEMO_PASSWORD}`);
  console.log(`  - Examination session: ${session.name}`);
  console.log(`  - Venue assignments: ${assignedCount}`);
  console.log('  - Demo mode: can scan at any time, but must be at an assigned venue');
}

main()
  .catch((err) => {
    console.error('[seed-demo-invigilator] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
