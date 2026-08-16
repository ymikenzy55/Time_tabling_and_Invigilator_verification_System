-- AlterEnum
ALTER TYPE "AttendanceResult" ADD VALUE 'REJECTED_VENUE_MISMATCH';

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isPractical" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invigilation" ADD COLUMN     "venueId" TEXT;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueAssignment" (
    "id" TEXT NOT NULL,
    "examinationSessionId" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "invigilatorId" TEXT NOT NULL,
    "slotAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueScan" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "examinationSessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "result" "AttendanceResult" NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VenueScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_name_key" ON "Venue"("name");

-- CreateIndex
CREATE INDEX "Venue_isActive_idx" ON "Venue"("isActive");

-- CreateIndex
CREATE INDEX "VenueAssignment_invigilatorId_slotAt_idx" ON "VenueAssignment"("invigilatorId", "slotAt");

-- CreateIndex
CREATE INDEX "VenueAssignment_examinationSessionId_venueId_idx" ON "VenueAssignment"("examinationSessionId", "venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueAssignment_examinationSessionId_venueId_slotAt_invigil_key" ON "VenueAssignment"("examinationSessionId", "venueId", "slotAt", "invigilatorId");

-- CreateIndex
CREATE INDEX "VenueScan_examinationSessionId_venueId_idx" ON "VenueScan"("examinationSessionId", "venueId");

-- CreateIndex
CREATE INDEX "VenueScan_userId_scannedAt_idx" ON "VenueScan"("userId", "scannedAt");

-- CreateIndex
CREATE INDEX "Invigilation_venueId_scheduledAt_idx" ON "Invigilation"("venueId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Invigilation" ADD CONSTRAINT "Invigilation_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_examinationSessionId_fkey" FOREIGN KEY ("examinationSessionId") REFERENCES "ExaminationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueAssignment" ADD CONSTRAINT "VenueAssignment_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueScan" ADD CONSTRAINT "VenueScan_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueScan" ADD CONSTRAINT "VenueScan_examinationSessionId_fkey" FOREIGN KEY ("examinationSessionId") REFERENCES "ExaminationSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueScan" ADD CONSTRAINT "VenueScan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
