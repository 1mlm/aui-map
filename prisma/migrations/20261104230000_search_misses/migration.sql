-- CreateTable
CREATE TABLE "SearchMiss" (
    "query" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchMiss_pkey" PRIMARY KEY ("query")
);

-- CreateIndex
CREATE INDEX "SearchMiss_count_idx" ON "SearchMiss"("count");
