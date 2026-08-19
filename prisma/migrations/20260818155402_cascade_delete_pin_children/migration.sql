-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_pinId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoSubmission" DROP CONSTRAINT "PhotoSubmission_pinId_fkey";

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSubmission" ADD CONSTRAINT "PhotoSubmission_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
