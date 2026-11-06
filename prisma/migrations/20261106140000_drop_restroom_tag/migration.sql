-- restrooms are not going on the map, only printers. The category goes unless some pin already uses it
DELETE FROM "Tag" WHERE "id" = 'restroom' AND NOT EXISTS (SELECT 1 FROM "Pin" WHERE "tagId" = 'restroom');
