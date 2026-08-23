-- Pin.id was the primary key AND the human-facing slug (?focus= links, admin display), which
-- meant it could never be renamed without breaking every Attachment/Submission pointing at it.
-- This introduces a hidden, immutable "uuid" as the real identity and demotes "id" to a plain
-- unique, freely-editable slug. Written by hand (not `prisma migrate dev`) because the differ
-- can't backfill a required column on an existing table — Pin already has rows.

-- 1. add the new identity column and backfill every existing row before it's required
ALTER TABLE "Pin" ADD COLUMN "uuid" TEXT;
UPDATE "Pin" SET "uuid" = gen_random_uuid()::text;
ALTER TABLE "Pin" ALTER COLUMN "uuid" SET NOT NULL;

-- 2. drop the old FKs before remapping child rows — they still point at Pin.id here
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_pinId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_pinId_fkey";

-- 3. repoint every child row from the old slug-based id to the pin's new uuid
UPDATE "Attachment" a SET "pinId" = p."uuid" FROM "Pin" p WHERE a."pinId" = p."id";
UPDATE "Submission" s SET "pinId" = p."uuid" FROM "Pin" p WHERE s."pinId" = p."id";

-- 4. swap Pin's primary key from id to uuid; id keeps a plain unique constraint
ALTER TABLE "Pin" DROP CONSTRAINT "Pin_pkey";
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_pkey" PRIMARY KEY ("uuid");
ALTER TABLE "Pin" ADD CONSTRAINT "Pin_id_key" UNIQUE ("id");

-- 5. re-add the FKs against the new identity column
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_pinId_fkey" FOREIGN KEY ("pinId") REFERENCES "Pin"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
