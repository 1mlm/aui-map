-- tiny categories for small things inside buildings. A tiny pin (sizeScale 0.6) only shows once the
-- map is zoomed in a little, or always when its category is picked in the filter
INSERT INTO "Tag" ("id", "label", "icon", "color", "sizeScale", "keywords") VALUES
  ('restroom', 'Restrooms', 'Toilet01Icon', 'sky', 0.6, ARRAY['toilet', 'toilets', 'wc', 'bathroom', 'bathrooms', 'washroom', 'restroom', 'loo', 'toilette', 'toilettes', 'pee']),
  ('printer', 'Printers', 'PrinterIcon', 'grey', 0.6, ARRAY['print', 'printer', 'printing', 'photocopy', 'copy', 'copies', 'scan', 'scanner', 'impression', 'imprimante'])
ON CONFLICT ("id") DO NOTHING;
