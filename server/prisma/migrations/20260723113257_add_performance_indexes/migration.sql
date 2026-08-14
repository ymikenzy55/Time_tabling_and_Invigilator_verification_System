-- CreateTable
CREATE TABLE "CourseLevel" (
    "id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "label" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseLevel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseLevel_departmentId_value_idx" ON "CourseLevel"("departmentId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "CourseLevel_departmentId_value_key" ON "CourseLevel"("departmentId", "value");

-- CreateIndex
CREATE INDEX "Course_createdById_status_idx" ON "Course"("createdById", "status");

-- CreateIndex
CREATE INDEX "Course_createdById_updatedAt_idx" ON "Course"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "Course_departmentId_semesterId_idx" ON "Course"("departmentId", "semesterId");

-- CreateIndex
CREATE INDEX "Course_semesterId_status_idx" ON "Course"("semesterId", "status");

-- CreateIndex
CREATE INDEX "Invigilation_invigilatorId_scheduledAt_idx" ON "Invigilation"("invigilatorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Invigilation_examinationSessionId_scheduledAt_idx" ON "Invigilation"("examinationSessionId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Invigilation_courseId_idx" ON "Invigilation"("courseId");

-- CreateIndex
CREATE INDEX "RegistrationWindow_opensAt_closesAt_idx" ON "RegistrationWindow"("opensAt", "closesAt");

-- CreateIndex
CREATE INDEX "User_departmentId_idx" ON "User"("departmentId");

-- AddForeignKey
ALTER TABLE "CourseLevel" ADD CONSTRAINT "CourseLevel_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
