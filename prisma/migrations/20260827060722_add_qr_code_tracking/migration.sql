-- CreateEnum
CREATE TYPE "QrCodeEventType" AS ENUM ('CREATED', 'RENAMED', 'SCANNED');

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "label" TEXT,
    "pinId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCodeEvent" (
    "id" TEXT NOT NULL,
    "qrCodeId" TEXT NOT NULL,
    "type" "QrCodeEventType" NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCodeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QrCodeEvent_createdAt_idx" ON "QrCodeEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCodeEvent" ADD CONSTRAINT "QrCodeEvent_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QrCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
