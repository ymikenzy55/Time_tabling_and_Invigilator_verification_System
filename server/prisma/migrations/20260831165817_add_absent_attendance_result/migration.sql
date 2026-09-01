-- AlterEnum
ALTER TYPE "AttendanceResult" ADD VALUE 'ABSENT';

-- CreateIndex
CREATE INDEX "Attendance_invigilationId_idx" ON "Attendance"("invigilationId");

-- CreateIndex
CREATE INDEX "Attendance_userId_idx" ON "Attendance"("userId");

-- CreateIndex
CREATE INDEX "Attendance_scannedAt_idx" ON "Attendance"("scannedAt");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "Course_status_semesterId_idx" ON "Course"("status", "semesterId");

-- CreateIndex
CREATE INDEX "Course_level_idx" ON "Course"("level");

-- CreateIndex
CREATE INDEX "Invigilation_examinationSessionId_venueId_scheduledAt_idx" ON "Invigilation"("examinationSessionId", "venueId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "VenueAssignment_invigilatorId_examinationSessionId_slotAt_idx" ON "VenueAssignment"("invigilatorId", "examinationSessionId", "slotAt");

-- CreateIndex
CREATE INDEX "VenueAssignment_examinationSessionId_venueId_slotAt_idx" ON "VenueAssignment"("examinationSessionId", "venueId", "slotAt");

-- CreateIndex
CREATE INDEX "VenueScan_examinationSessionId_venueId_scannedAt_idx" ON "VenueScan"("examinationSessionId", "venueId", "scannedAt");

-- CreateIndex
CREATE INDEX "VenueScan_venueId_scannedAt_idx" ON "VenueScan"("venueId", "scannedAt");
