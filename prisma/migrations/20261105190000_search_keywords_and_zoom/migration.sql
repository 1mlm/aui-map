-- AlterTable
ALTER TABLE "Pin" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "minZoom" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Starting keywords for the places people most often look for by what they need rather than by
-- name. Editable (and extendable) in /admin/pins and /admin/tags. A pin that doesn't exist is
-- simply skipped by these updates.
UPDATE "Pin" SET "keywords" = ARRAY['doctor','doctors','nurse','sick','ill','medical','medicine','clinic','pharmacy','hospital','infirmary','pain','injury','medecin','sante','malade'] WHERE "id" = 'health-center';
UPDATE "Pin" SET "keywords" = ARRAY['money','cash','bank','withdraw','withdrawal','card','argent','banque','guichet','distributeur'] WHERE "id" = 'atms';
UPDATE "Pin" SET "keywords" = ARRAY['money','cash','fees','tuition','payment','pay','wallet','cash wallet','card','balance','receipt','bank','argent','frais'] WHERE "id" = 'business-office';
UPDATE "Pin" SET "keywords" = ARRAY['print','printer','printing','wifi','internet','computer','laptop','password','network','tech','support','email','imprimer'] WHERE "id" = 'its';
UPDATE "Pin" SET "keywords" = ARRAY['study','studying','read','reading','quiet','books','research','bibliotheque','livres'] WHERE "id" = 'm6l';
UPDATE "Pin" SET "keywords" = ARRAY['book','books','textbook','textbooks','buy','stationery','supplies','notebook','magasin'] WHERE "id" = 'bookstore';
UPDATE "Pin" SET "keywords" = ARRAY['buy','store','supermarket','grocery','groceries','snacks','drinks','superette'] WHERE "id" = 'shop';
UPDATE "Pin" SET "keywords" = ARRAY['pray','prayer','prayers','salat','salah','masjid','muslim','mosquee','priere'] WHERE "id" = 'mosque';
UPDATE "Pin" SET "keywords" = ARRAY['mail','post','package','parcel','letter','send','stamp','colis','poste'] WHERE "id" = 'post-office';
UPDATE "Pin" SET "keywords" = ARRAY['register','registration','enroll','enrollment','transcript','records','certificate','paperwork','inscription','scolarite','grades'] WHERE "id" = 'registrar';
UPDATE "Pin" SET "keywords" = ARRAY['club','clubs','activities','student life','association','associations'] WHERE "id" = 'sao';
UPDATE "Pin" SET "keywords" = ARRAY['events','event','conference','talk','performance'] WHERE "id" = 'event-room';
UPDATE "Pin" SET "keywords" = ARRAY['gate','entrance','entry','exit','leave','security','arrive','porte','entree','sortie','guard'] WHERE "id" = 'main-gate';
UPDATE "Pin" SET "keywords" = ARRAY['laundry','wash','washing','clothes','laverie','linge'] WHERE "id" = 'laundry';
UPDATE "Pin" SET "keywords" = ARRAY['swim','swimming','piscine'] WHERE "id" = 'pool';
UPDATE "Pin" SET "keywords" = ARRAY['workout','exercise','fitness','muscu','weights','cardio'] WHERE "id" = 'gym';
UPDATE "Pin" SET "keywords" = ARRAY['handball','volleyball','basketball','graduation'] WHERE "id" = 'new-gym';
UPDATE "Pin" SET "keywords" = ARRAY['car','cars','voiture','garage'] WHERE "id" = 'main-parking';
UPDATE "Tag" SET "keywords" = ARRAY['eat','food','hungry','hunger','lunch','dinner','breakfast','restaurant','cafe','coffee','snack','meal','faim','manger','resto'] WHERE "id" = 'food';
UPDATE "Tag" SET "keywords" = ARRAY['dorm','dorms','housing','sleep','residence','room','apartment','logement','chambre'] WHERE "id" = 'unknownHousing';
UPDATE "Tag" SET "keywords" = ARRAY['sport','sports','football','soccer','basketball','tennis','padel','run','running'] WHERE "id" = 'sports';
UPDATE "Tag" SET "keywords" = ARRAY['car','park','voiture'] WHERE "id" = 'parking';
UPDATE "Tag" SET "keywords" = ARRAY['amphitheater','presentation','graduation','conference','theater'] WHERE "id" = 'auditorium';
UPDATE "Tag" SET "keywords" = ARRAY['class','classes','classroom','lecture','lab','labs','office','offices','professor','cours','salle'] WHERE "id" = 'building';
