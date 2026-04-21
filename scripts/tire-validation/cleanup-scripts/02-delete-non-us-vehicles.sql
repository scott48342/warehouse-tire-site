-- ============================================================
-- PHASE 1B: DELETE NON-US MARKET VEHICLES
-- JDM, China, Europe, Asia-only models never sold in the US
-- ============================================================

BEGIN;

-- Count before deletion
SELECT 'BEFORE DELETION - Non-US Vehicle Counts:' as status;
SELECT make, model, COUNT(*) as records
FROM vehicle_fitments
WHERE model ILIKE ANY(ARRAY[
  -- Toyota JDM
  'Allex', 'Altezza', 'Altezza Gita', 'Aristo', 'Avensis%', 'Blade', 'Caldina',
  'Celsior', 'Century', 'Chaser', 'Corona', 'Corolla Axio', 'Corolla Fielder',
  'Corolla Rumion', 'Corolla Runx', 'Corolla Spacio', 'Crown', 'Duet',
  'Estima', 'Funcargo', 'Gaia', 'Grand HiAce', 'Harrier', 'Hilux Surf',
  'Ipsum', 'Isis', 'Ist', 'JPN Taxi', 'Kluger', 'Land Cruiser Cygnus',
  'Lite Ace%', 'Mark II%', 'Mark X', 'Mega Cruiser', 'MR-S', 'MR2 Roadster',
  'Nadia', 'Noah', 'Opa', 'Origin', 'Passo', 'Picnic', 'Platz', 'Porte',
  'Premio', 'Proace%', 'Probox', 'Pronard', 'Ractis', 'Raize', 'Raum',
  'Regius', 'Roomy', 'Rush', 'Sai', 'Sienta', 'Soarer', 'Spade', 'Starlet%',
  'Succeed', 'Tank', 'TownAce%', 'Touring HiAce', 'Vellfire', 'Verossa',
  'Vista%', 'Vitz', 'Voxy', 'Will%', 'Windom', 'Wish', 'Yaris Cross',
  -- Toyota Asia/Other
  'Avanza', 'Calya', 'C-Pod', 'Fortuner', 'Glanza', 'Hilux Champ',
  'Hilux Rangga', 'Hilux Stout', 'Innova%', 'Kijang%', 'Nav1', 'Quantum',
  'Rukus', 'Tamaraw', 'Urban Cruiser', 'Veloz', 'Wigo', 'Yaris Ativ',
  'Yaris Heykers', 'Yaris R', 'Zelas', 'Zenix',
  -- Volkswagen Non-US
  'Amarok', 'Arteon SR', 'Bora', 'Clasico', 'Cross Lavida', 'Cross Santana',
  'CrossPolo', 'Fox', 'Gol', 'ID.4 Crozz', 'ID.4 X', 'ID Unyx', 'ID.3',
  'Jetta City', 'Jetta King', 'Jetta Pioneer', 'Jetta VS5', 'Jetta VS7',
  'Lamando', 'Lavida', 'Lupo', 'Magotan', 'Nivus', 'Parati', 'Phaeton',
  'Pointer', 'Polo%', 'Sagitar', 'Santana', 'Saveiro', 'Scirocco', 'Sedan',
  'Sharan', 'SpaceFox', 'Sportvan', 'Suran', 'T-Cross', 'T-Roc', 'Tacqua',
  'Taigo', 'Tayron%', 'Teramont', 'Tharu%', 'Touran', 'Up', 'Vento', 'Voyage',
  -- Volvo Non-US
  'V40%', 'C30', 'S40',
  -- Kia Non-US
  'Avella', 'Besta', 'Carens', 'Carstar', 'Ceed', 'Cerato', 'Enterprise',
  'Grand Carnival', 'K3', 'K7', 'K9', 'Lotze', 'Magentis', 'Morning',
  'Opirus', 'Pegas', 'Picanto', 'Pride', 'ProCeed', 'Quoris', 'Ray',
  'Rio X', 'Shuma', 'Sonet', 'Stonic', 'Venga', 'XCeed',
  -- Hyundai Non-US (if present)
  'Atos', 'Bayon', 'Casper', 'Creta', 'Getz', 'Grand i10', 'i10', 'i20',
  'i30', 'i40', 'ix20', 'ix35', 'Matrix', 'Verna', 'Venue'
])
GROUP BY make, model
ORDER BY make, model;

-- Perform deletion
DELETE FROM vehicle_fitments
WHERE model ILIKE ANY(ARRAY[
  -- Toyota JDM
  'Allex', 'Altezza', 'Altezza Gita', 'Aristo', 'Avensis%', 'Blade', 'Caldina',
  'Celsior', 'Century', 'Chaser', 'Corona', 'Corolla Axio', 'Corolla Fielder',
  'Corolla Rumion', 'Corolla Runx', 'Corolla Spacio', 'Crown', 'Duet',
  'Estima', 'Funcargo', 'Gaia', 'Grand HiAce', 'Harrier', 'Hilux Surf',
  'Ipsum', 'Isis', 'Ist', 'JPN Taxi', 'Kluger', 'Land Cruiser Cygnus',
  'Lite Ace%', 'Mark II%', 'Mark X', 'Mega Cruiser', 'MR-S', 'MR2 Roadster',
  'Nadia', 'Noah', 'Opa', 'Origin', 'Passo', 'Picnic', 'Platz', 'Porte',
  'Premio', 'Proace%', 'Probox', 'Pronard', 'Ractis', 'Raize', 'Raum',
  'Regius', 'Roomy', 'Rush', 'Sai', 'Sienta', 'Soarer', 'Spade', 'Starlet%',
  'Succeed', 'Tank', 'TownAce%', 'Touring HiAce', 'Vellfire', 'Verossa',
  'Vista%', 'Vitz', 'Voxy', 'Will%', 'Windom', 'Wish', 'Yaris Cross',
  -- Toyota Asia/Other
  'Avanza', 'Calya', 'C-Pod', 'Fortuner', 'Glanza', 'Hilux Champ',
  'Hilux Rangga', 'Hilux Stout', 'Innova%', 'Kijang%', 'Nav1', 'Quantum',
  'Rukus', 'Tamaraw', 'Urban Cruiser', 'Veloz', 'Wigo', 'Yaris Ativ',
  'Yaris Heykers', 'Yaris R', 'Zelas', 'Zenix',
  -- Volkswagen Non-US
  'Amarok', 'Arteon SR', 'Bora', 'Clasico', 'Cross Lavida', 'Cross Santana',
  'CrossPolo', 'Fox', 'Gol', 'ID.4 Crozz', 'ID.4 X', 'ID Unyx', 'ID.3',
  'Jetta City', 'Jetta King', 'Jetta Pioneer', 'Jetta VS5', 'Jetta VS7',
  'Lamando', 'Lavida', 'Lupo', 'Magotan', 'Nivus', 'Parati', 'Phaeton',
  'Pointer', 'Polo%', 'Sagitar', 'Santana', 'Saveiro', 'Scirocco', 'Sedan',
  'Sharan', 'SpaceFox', 'Sportvan', 'Suran', 'T-Cross', 'T-Roc', 'Tacqua',
  'Taigo', 'Tayron%', 'Teramont', 'Tharu%', 'Touran', 'Up', 'Vento', 'Voyage',
  -- Volvo Non-US
  'V40%', 'C30',
  -- Kia Non-US
  'Avella', 'Besta', 'Carens', 'Carstar', 'Ceed', 'Cerato', 'Enterprise',
  'Grand Carnival', 'K3', 'K7', 'K9', 'Lotze', 'Magentis', 'Morning',
  'Opirus', 'Pegas', 'Picanto', 'Pride', 'ProCeed', 'Quoris', 'Ray',
  'Rio X', 'Shuma', 'Sonet', 'Stonic', 'Venga', 'XCeed',
  -- Hyundai Non-US (if present)
  'Atos', 'Bayon', 'Casper', 'Creta', 'Getz', 'Grand i10', 'i10', 'i20',
  'i30', 'i40', 'ix20', 'ix35', 'Matrix', 'Verna', 'Venue'
]);

SELECT 'Non-US vehicles deleted' as status, COUNT(*) as remaining_records FROM vehicle_fitments;

COMMIT;
