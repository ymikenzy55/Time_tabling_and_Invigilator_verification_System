import { prisma } from '../utils/prisma.js';

const VENUE_NAMES = [
  'A1', 'A2', 'A3', 'A4', 'A5',
  'B1', 'B2', 'B3', 'B4', 'B5',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'D3', 'D4', 'D5',
  'E1', 'E2', 'E3', 'E4', 'E5',
  'F1', 'F2', 'F3', 'F4', 'F5',
  'G1', 'G2', 'G3', 'G4', 'G5',
  'H1', 'H2', 'H3', 'H4', 'H5',
  'J1', 'J2', 'J3', 'J4', 'J5',
  'K1', 'K2', 'K3', 'K4', 'K5',
];

const LOCATIONS = ['Main Campus', 'South Campus', 'North Campus', 'East Wing', 'West Wing'];

async function main() {
  const existing = await prisma.venue.findMany({
    where: { name: { in: VENUE_NAMES, mode: 'insensitive' } },
    select: { name: true },
  });
  const existingNames = new Set(existing.map((v) => v.name.toLowerCase()));

  const toCreate = VENUE_NAMES
    .filter((name) => !existingNames.has(name.toLowerCase()))
    .map((name, i) => ({
      name,
      capacity: 80 + (i % 5) * 40, // 80, 120, 160, 200, 240
      location: LOCATIONS[i % LOCATIONS.length],
      isActive: true,
    }));

  if (toCreate.length === 0) {
    console.log('All venues already exist. Nothing to seed.');
    return;
  }

  const created = await prisma.$transaction(
    toCreate.map((v) => prisma.venue.create({ data: v }))
  );

  console.log(`Seeded ${created.length} venues:`);
  for (const v of created) {
    console.log(`  ${v.name} — capacity ${v.capacity} — ${v.location}`);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
