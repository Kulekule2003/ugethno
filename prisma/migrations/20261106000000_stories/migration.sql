ALTER TYPE "EntityType" ADD VALUE 'STORY';
CREATE TABLE "Story" (
  "id" TEXT NOT NULL, "speciesId" TEXT NOT NULL, "question" TEXT NOT NULL, "answer" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT '', "version" INTEGER NOT NULL DEFAULT 1, "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Story_speciesId_deletedAt_idx" ON "Story"("speciesId", "deletedAt");
ALTER TABLE "Story" ADD CONSTRAINT "Story_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "Species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
