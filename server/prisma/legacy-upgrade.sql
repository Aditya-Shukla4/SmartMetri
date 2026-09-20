-- SmartMetri additive upgrade for the existing pre-Prisma-migration database.
-- Review/back up the database before applying. Do not run through Prisma migrate
-- until the baseline procedure in MIGRATION.md has been completed.

BEGIN;

ALTER TABLE "Instrument" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "Instrument" ADD COLUMN IF NOT EXISTS "previousVerificationDate" TIMESTAMP(3);
ALTER TABLE "Instrument" ADD COLUMN IF NOT EXISTS "nextDueDate" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "applicationType" TEXT NOT NULL DEFAULT 'VERIFICATION';
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);

-- Reinspection requires more than one assignment for an application.
ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_applicationId_key";
CREATE INDEX IF NOT EXISTS "Assignment_applicationId_idx" ON "Assignment"("applicationId");
CREATE INDEX IF NOT EXISTS "Assignment_lmoId_scheduledDate_idx" ON "Assignment"("lmoId", "scheduledDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Assignment_applicationId_lmoId_scheduledDate_key" ON "Assignment"("applicationId", "lmoId", "scheduledDate");

CREATE TABLE IF NOT EXISTS "ApplicationStatusHistory" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fromStatus" "ApplicationStatus",
  "toStatus" "ApplicationStatus" NOT NULL,
  "changedById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_applicationId_createdAt_idx" ON "ApplicationStatusHistory"("applicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ApplicationStatusHistory_toStatus_createdAt_idx" ON "ApplicationStatusHistory"("toStatus", "createdAt");

CREATE TABLE IF NOT EXISTS "ChecklistTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "instrumentType" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ChecklistItem" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "expectedCondition" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InspectionChecklistResult" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "checklistItemId" TEXT NOT NULL,
  "observedValue" TEXT,
  "passed" BOOLEAN NOT NULL,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InspectionChecklistResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InspectionChecklistResult_inspectionId_checklistItemId_key"
  ON "InspectionChecklistResult"("inspectionId", "checklistItemId");
CREATE INDEX IF NOT EXISTS "InspectionChecklistResult_checklistItemId_idx"
  ON "InspectionChecklistResult"("checklistItemId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx"
  ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx"
  ON "Notification"("createdAt");

DO $$ BEGIN
  ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "InspectionChecklistResult" ADD CONSTRAINT "InspectionChecklistResult_inspectionId_fkey"
    FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "InspectionChecklistResult" ADD CONSTRAINT "InspectionChecklistResult_checklistItemId_fkey"
    FOREIGN KEY ("checklistItemId") REFERENCES "ChecklistItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
