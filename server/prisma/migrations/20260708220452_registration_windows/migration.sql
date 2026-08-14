/*
  Warnings:

  - The values [INVITED] on the enum `UserStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserStatus_new" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'REJECTED');
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus_new" USING ("status"::text::"UserStatus_new");
ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "UserStatus_old";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_usedByUserId_fkey";

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

-- DropTable
DROP TABLE "Invitation";

-- DropEnum
DROP TYPE "InvitationStatus";

-- CreateTable
CREATE TABLE "RegistrationWindow" (
    "role" "Role" NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "RegistrationWindow_pkey" PRIMARY KEY ("role")
);
