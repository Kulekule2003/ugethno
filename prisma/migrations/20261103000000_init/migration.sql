CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONTRIBUTOR');
CREATE TYPE "ColumnType" AS ENUM ('TEXT', 'NUMBER', 'CHOICE', 'DATE', 'BOOLEAN', 'LINK');
CREATE TYPE "EntityType" AS ENUM ('IMAGE', 'SPECIES', 'USER', 'COLUMN');

CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT, "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR', "disabledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Species" (
  "id" TEXT NOT NULL, "category" TEXT NOT NULL, "canonicalName" TEXT NOT NULL, "shortName" TEXT NOT NULL,
  "localNames" JSONB NOT NULL DEFAULT '[]', "features" JSONB NOT NULL DEFAULT '{}', "habitat" TEXT NOT NULL DEFAULT '',
  "lookalikes" JSONB NOT NULL DEFAULT '[]', "notes" TEXT NOT NULL DEFAULT '', "custom" JSONB NOT NULL DEFAULT '{}',
  "version" INTEGER NOT NULL DEFAULT 1, "deletedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Species_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ImageRecord" (
  "id" TEXT NOT NULL, "category" TEXT NOT NULL, "canonicalName" TEXT NOT NULL, "shortName" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL, "originalFileName" TEXT NOT NULL, "question" TEXT NOT NULL DEFAULT 'What fish is this?',
  "source" TEXT NOT NULL DEFAULT '', "origin" TEXT NOT NULL DEFAULT '', "creator" TEXT NOT NULL DEFAULT '', "license" TEXT NOT NULL DEFAULT '',
  "uploaderId" TEXT NOT NULL, "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "speciesId" TEXT,
  "custom" JSONB NOT NULL DEFAULT '{}', "phash" TEXT, "version" INTEGER NOT NULL DEFAULT 1, "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImageRecord_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ColumnDefinition" (
  "id" TEXT NOT NULL, "entity" "EntityType" NOT NULL, "key" TEXT NOT NULL, "label" TEXT NOT NULL,
  "type" "ColumnType" NOT NULL, "choices" JSONB NOT NULL DEFAULT '[]', "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ColumnDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AuditEntry" (
  "id" TEXT NOT NULL, "actorId" TEXT NOT NULL, "entity" "EntityType" NOT NULL, "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL, "field" TEXT, "oldValue" JSONB, "newValue" JSONB, "undoneAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "LoginThrottle" (
  "key" TEXT NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("key")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Species_canonicalName_key" ON "Species"("canonicalName");
CREATE INDEX "ImageRecord_canonicalName_deletedAt_idx" ON "ImageRecord"("canonicalName", "deletedAt");
CREATE INDEX "ImageRecord_phash_idx" ON "ImageRecord"("phash");
CREATE UNIQUE INDEX "ColumnDefinition_entity_key_key" ON "ColumnDefinition"("entity", "key");
CREATE INDEX "AuditEntry_entity_entityId_idx" ON "AuditEntry"("entity", "entityId");
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");
ALTER TABLE "ImageRecord" ADD CONSTRAINT "ImageRecord_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImageRecord" ADD CONSTRAINT "ImageRecord_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
