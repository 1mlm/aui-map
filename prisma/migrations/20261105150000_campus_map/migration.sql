-- CreateTable
CREATE TABLE "CampusMap" (
    "id" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusMap_pkey" PRIMARY KEY ("id")
);
