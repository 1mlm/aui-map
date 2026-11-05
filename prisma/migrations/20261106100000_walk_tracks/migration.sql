CREATE TABLE "WalkTrack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" JSONB NOT NULL,
    "marks" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "WalkTrack_pkey" PRIMARY KEY ("id")
);
