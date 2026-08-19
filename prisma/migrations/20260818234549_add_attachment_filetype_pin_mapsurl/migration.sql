-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "Pin" ADD COLUMN     "mapsUrl" TEXT;
