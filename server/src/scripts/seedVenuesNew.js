import { prisma } from '../utils/prisma.js';

const NEW_VENUES = [
  { name: 'APP LAB 1', capacity: 60 },
  { name: 'APP LAB 3', capacity: 60 },
  { name: 'APP LAB 5', capacity: 60 },
  { name: 'APP LAB 6', capacity: 60 },
  { name: 'APP LAB 7', capacity: 60 },
  { name: 'APP LAB 8', capacity: 60 },
  { name: 'APP LAB 9', capacity: 60 },
  { name: 'BASIC SCH R 1', capacity: 80 },
  { name: 'BASIC SCH R 2', capacity: 80 },
  { name: 'BASIC SCH R 3', capacity: 80 },
  { name: 'BASIC SCH R 4', capacity: 80 },
  { name: 'BASIC SCH R 5', capacity: 80 },
  { name: 'BASIC SCH R 6', capacity: 80 },
  { name: 'BASIC SCH R 7', capacity: 80 },
  { name: 'BASIC SCH R 8', capacity: 80 },
  { name: 'BASIC SCH R 9', capacity: 80 },
  { name: 'CHEM LAB (4 SESSIONS)', capacity: 60 },
  { name: 'CHEMISTRY LAB', capacity: 60 },
  { name: 'LIB FF 2', capacity: 60 },
  { name: 'LIB FF 3', capacity: 60 },
  { name: 'LIB GF 1', capacity: 60 },
  { name: 'LIB GF 2', capacity: 60 },
  { name: 'LT 1', capacity: 150 },
  { name: 'LT 10', capacity: 150 },
  { name: 'LT 11', capacity: 150 },
  { name: 'LT 12', capacity: 150 },
  { name: 'LT 2', capacity: 150 },
  { name: 'LT 4', capacity: 150 },
  { name: 'LT 5', capacity: 150 },
  { name: 'LT 7A', capacity: 100 },
  { name: 'LT 7B', capacity: 100 },
  { name: 'LT 8A', capacity: 100 },
  { name: 'LT 8B', capacity: 100 },
  { name: 'LT 9A', capacity: 100 },
  { name: 'LT 9B', capacity: 100 },
  { name: 'LTS 1', capacity: 200 },
  { name: 'LTS 2', capacity: 200 },
  { name: 'LTS 3', capacity: 200 },
  { name: 'NEW AUD', capacity: 500 },
  { name: 'NEW AUD-CR 1', capacity: 80 },
  { name: 'NEW AUD-CR 2', capacity: 80 },
  { name: 'NEW AUD-CR 3', capacity: 80 },
  { name: 'OLD AUD', capacity: 400 },
  { name: 'P-LAB', capacity: 60 },
  { name: 'PAV 1', capacity: 200 },
  { name: 'SH 1', capacity: 80 },
  { name: 'SH 2', capacity: 80 },
  { name: 'SH 3', capacity: 80 },
  { name: 'SH 4', capacity: 80 },
  { name: 'SH 5', capacity: 80 },
  { name: 'SH 6', capacity: 80 },
  { name: 'SH 7', capacity: 80 },
  { name: 'SH 8', capacity: 80 },
  { name: 'SKILLS LAB', capacity: 60 },
];

async function main() {
  console.log(`Clearing existing venues and seeding ${NEW_VENUES.length} new venues...`);

  // 1. Null out venueId on Invigilation records (non-cascade relation)
  const invigilationsWithVenue = await prisma.invigilation.updateMany({
    where: { venueId: { not: null } },
    data: { venueId: null },
  });
  console.log(`  Disconnected ${invigilationsWithVenue.count} invigilation(s) from venues.`);

  // 2. Delete all existing venues (VenueAssignment and VenueScan cascade automatically)
  const deleted = await prisma.venue.deleteMany({});
  console.log(`  Deleted ${deleted.count} existing venue(s).`);

  // 3. Create new venues
  const created = await prisma.$transaction(
    NEW_VENUES.map((v) =>
      prisma.venue.create({
        data: {
          name: v.name,
          capacity: v.capacity,
          isActive: true,
        },
      })
    )
  );

  console.log(`\nSeeded ${created.length} venues:`);
  for (const v of created) {
    console.log(`  ${v.name} — capacity ${v.capacity}`);
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
