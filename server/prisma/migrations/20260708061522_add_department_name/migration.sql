-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_userId_fkey";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invigilation" DROP CONSTRAINT "Invigilation_invigilatorId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- AlterTable
ALTER TABLE "Attendance" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invigilation" ALTER COLUMN "invigilatorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "departmentId" TEXT,
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "departmentName" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Invitation_departmentId_idx" ON "Invitation"("departmentId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invigilation" ADD CONSTRAINT "Invigilation_invigilatorId_fkey" FOREIGN KEY ("invigilatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
