-- AlterTable
ALTER TABLE "Panorama" ADD COLUMN     "spherical" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "spherical" BOOLEAN NOT NULL DEFAULT false;
