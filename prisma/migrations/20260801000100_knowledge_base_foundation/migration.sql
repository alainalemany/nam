-- CreateEnum
CREATE TYPE "KnowledgeRecordLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeContentKind" AS ENUM ('FIELD_NOTE', 'TROUBLESHOOTING', 'PROCEDURE', 'SAFETY_REMINDER', 'REFERENCE');

-- CreateEnum
CREATE TYPE "KnowledgeTrust" AS ENUM ('UNVERIFIED', 'PERSONALLY_REVIEWED');

-- CreateEnum
CREATE TYPE "KnowledgeRevisionOrigin" AS ENUM ('INITIAL', 'REVISED', 'RESTORED');

-- CreateEnum
CREATE TYPE "KnowledgeContextKind" AS ENUM ('GENERAL', 'MINE', 'EQUIPMENT');

-- CreateTable
CREATE TABLE "KnowledgeRecord" (
    "id" UUID NOT NULL,
    "currentRevisionId" UUID,
    "lifecycle" "KnowledgeRecordLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    "createSubmissionKey" UUID NOT NULL,
    "createSubmissionFingerprint" CHAR(64) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeRecord_stateVersion_check"
      CHECK ("stateVersion" > 0),
    CONSTRAINT "KnowledgeRecord_lifecycle_archivedAt_check"
      CHECK (
        ("lifecycle" = 'ACTIVE' AND "archivedAt" IS NULL)
        OR ("lifecycle" = 'ARCHIVED' AND "archivedAt" IS NOT NULL)
      ),
    CONSTRAINT "KnowledgeRecord_fingerprint_check"
      CHECK ("createSubmissionFingerprint" ~ '^[0-9a-f]{64}$')
);

-- CreateTable
CREATE TABLE "KnowledgeRecordRevision" (
    "id" UUID NOT NULL,
    "knowledgeRecordId" UUID NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "origin" "KnowledgeRevisionOrigin" NOT NULL,
    "contentKind" "KnowledgeContentKind" NOT NULL,
    "trust" "KnowledgeTrust" NOT NULL DEFAULT 'UNVERIFIED',
    "title" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "safetyCaution" TEXT,
    "contextKind" "KnowledgeContextKind" NOT NULL DEFAULT 'GENERAL',
    "mineId" TEXT,
    "equipmentId" TEXT,
    "equipmentDisplayNameSnapshot" TEXT,
    "equipmentNumberSnapshot" TEXT,
    "equipmentCategorySnapshot" "EquipmentCategory",
    "mineNameSnapshot" TEXT,
    "cityNameSnapshot" TEXT,
    "cityStateSnapshot" TEXT,
    "changeSummary" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeRecordRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeRevision_number_check"
      CHECK ("revisionNumber" > 0),
    CONSTRAINT "KnowledgeRevision_title_check"
      CHECK (char_length("title") BETWEEN 1 AND 160 AND "title" ~ '[^[:space:]]'),
    CONSTRAINT "KnowledgeRevision_normalizedTitle_check"
      CHECK (char_length("normalizedTitle") BETWEEN 1 AND 160 AND "normalizedTitle" ~ '[^[:space:]]'),
    CONSTRAINT "KnowledgeRevision_body_check"
      CHECK (char_length("bodyMarkdown") BETWEEN 1 AND 50000 AND "bodyMarkdown" ~ '[^[:space:]]'),
    CONSTRAINT "KnowledgeRevision_caution_check"
      CHECK (
        "safetyCaution" IS NULL
        OR (char_length("safetyCaution") BETWEEN 1 AND 2000 AND "safetyCaution" ~ '[^[:space:]]')
      ),
    CONSTRAINT "KnowledgeRevision_changeSummary_length_check"
      CHECK (
        "changeSummary" IS NULL
        OR (char_length("changeSummary") BETWEEN 1 AND 500 AND "changeSummary" ~ '[^[:space:]]')
      ),
    CONSTRAINT "KnowledgeRevision_trust_reviewedAt_check"
      CHECK (
        ("trust" = 'UNVERIFIED' AND "reviewedAt" IS NULL)
        OR ("trust" = 'PERSONALLY_REVIEWED' AND "reviewedAt" IS NOT NULL)
      ),
    CONSTRAINT "KnowledgeRevision_origin_summary_check"
      CHECK (
        ("origin" = 'INITIAL' AND "revisionNumber" = 1 AND "changeSummary" IS NULL)
        OR ("origin" = 'REVISED' AND "revisionNumber" >= 2 AND "changeSummary" IS NOT NULL)
        OR ("origin" = 'RESTORED' AND "revisionNumber" >= 2 AND "changeSummary" IS NULL)
      ),
    CONSTRAINT "KnowledgeRevision_context_shape_check"
      CHECK (
        (
          "contextKind" = 'GENERAL'
          AND "mineId" IS NULL
          AND "equipmentId" IS NULL
          AND "equipmentDisplayNameSnapshot" IS NULL
          AND "equipmentNumberSnapshot" IS NULL
          AND "equipmentCategorySnapshot" IS NULL
          AND "mineNameSnapshot" IS NULL
          AND "cityNameSnapshot" IS NULL
          AND "cityStateSnapshot" IS NULL
        )
        OR (
          "contextKind" = 'MINE'
          AND "equipmentId" IS NULL
          AND "equipmentDisplayNameSnapshot" IS NULL
          AND "equipmentNumberSnapshot" IS NULL
          AND "equipmentCategorySnapshot" IS NULL
          AND "mineNameSnapshot" IS NOT NULL
          AND "mineNameSnapshot" ~ '[^[:space:]]'
          AND "cityNameSnapshot" IS NOT NULL
          AND "cityNameSnapshot" ~ '[^[:space:]]'
          AND ("cityStateSnapshot" IS NULL OR "cityStateSnapshot" ~ '[^[:space:]]')
        )
        OR (
          "contextKind" = 'EQUIPMENT'
          AND "equipmentDisplayNameSnapshot" IS NOT NULL
          AND "equipmentDisplayNameSnapshot" ~ '[^[:space:]]'
          AND ("equipmentNumberSnapshot" IS NULL OR "equipmentNumberSnapshot" ~ '[^[:space:]]')
          AND "equipmentCategorySnapshot" IS NOT NULL
          AND "mineNameSnapshot" IS NOT NULL
          AND "mineNameSnapshot" ~ '[^[:space:]]'
          AND "cityNameSnapshot" IS NOT NULL
          AND "cityNameSnapshot" ~ '[^[:space:]]'
          AND ("cityStateSnapshot" IS NULL OR "cityStateSnapshot" ~ '[^[:space:]]')
        )
      )
);

-- CreateTable
CREATE TABLE "KnowledgeRevisionExternalReference" (
    "id" UUID NOT NULL,
    "knowledgeRecordRevisionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeRevisionExternalReference_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "KnowledgeExternalReference_sequence_check"
      CHECK ("sequence" BETWEEN 1 AND 10),
    CONSTRAINT "KnowledgeExternalReference_label_check"
      CHECK (char_length("label") BETWEEN 1 AND 120 AND "label" ~ '[^[:space:]]'),
    CONSTRAINT "KnowledgeExternalReference_url_check"
      CHECK (
        char_length("url") BETWEEN 1 AND 2048
        AND "url" ~* '^https://[^[:space:]]+$'
      ),
    CONSTRAINT "KnowledgeExternalReference_normalizedUrl_check"
      CHECK (
        char_length("normalizedUrl") BETWEEN 1 AND 2048
        AND "normalizedUrl" ~ '^https://[^[:space:]]+$'
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRecord_submissionKey_key" ON "KnowledgeRecord"("createSubmissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRecord_current_owner_key" ON "KnowledgeRecord"("currentRevisionId", "id");

-- CreateIndex
CREATE INDEX "KnowledgeRecord_lifecycle_updated_idx" ON "KnowledgeRecord"("lifecycle", "updatedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRevision_record_number_key" ON "KnowledgeRecordRevision"("knowledgeRecordId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeRevision_id_record_key" ON "KnowledgeRecordRevision"("id", "knowledgeRecordId");

-- CreateIndex
CREATE INDEX "KnowledgeRevision_normalizedTitle_idx" ON "KnowledgeRecordRevision"("normalizedTitle");

-- CreateIndex
CREATE INDEX "KnowledgeRevision_mine_idx" ON "KnowledgeRecordRevision"("mineId");

-- CreateIndex
CREATE INDEX "KnowledgeRevision_equipment_idx" ON "KnowledgeRecordRevision"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeExternalReference_revision_sequence_key" ON "KnowledgeRevisionExternalReference"("knowledgeRecordRevisionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeExternalReference_revision_url_key" ON "KnowledgeRevisionExternalReference"("knowledgeRecordRevisionId", "normalizedUrl");

-- AddForeignKey
ALTER TABLE "KnowledgeRecordRevision"
ADD CONSTRAINT "KnowledgeRecordRevision_record_fkey"
FOREIGN KEY ("knowledgeRecordId") REFERENCES "KnowledgeRecord"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRecordRevision"
ADD CONSTRAINT "KnowledgeRecordRevision_mine_fkey"
FOREIGN KEY ("mineId") REFERENCES "Mine"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRecordRevision"
ADD CONSTRAINT "KnowledgeRecordRevision_equipment_fkey"
FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRevisionExternalReference"
ADD CONSTRAINT "KnowledgeExternalReference_revision_fkey"
FOREIGN KEY ("knowledgeRecordRevisionId") REFERENCES "KnowledgeRecordRevision"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeRecord"
ADD CONSTRAINT "KnowledgeRecord_currentRevision_owner_fkey"
FOREIGN KEY ("currentRevisionId", "id")
REFERENCES "KnowledgeRecordRevision"("id", "knowledgeRecordId")
ON DELETE RESTRICT ON UPDATE CASCADE;
