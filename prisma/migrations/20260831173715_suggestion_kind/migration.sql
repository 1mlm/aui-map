-- CreateEnum
CREATE TYPE "SuggestionKind" AS ENUM ('BUG', 'FEATURE');

-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN     "kind" "SuggestionKind" NOT NULL DEFAULT 'FEATURE';
