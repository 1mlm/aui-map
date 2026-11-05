-- five colours instead of one per category: housing, general buildings, services and food (places you
-- pay or get something done), sports, and everything else. Categories stay separate in the filter
UPDATE "Tag" SET "color" = 'blue' WHERE "id" = 'unknownHousing';
UPDATE "Tag" SET "color" = 'grey' WHERE "id" IN ('building', 'auditorium', 'parking', 'restroom', 'printer');
UPDATE "Tag" SET "color" = 'orange' WHERE "id" IN ('service', 'food');
UPDATE "Tag" SET "color" = 'green' WHERE "id" = 'sports';
UPDATE "Tag" SET "color" = 'purple' WHERE "id" = 'other';
