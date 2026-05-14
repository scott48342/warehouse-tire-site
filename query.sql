SELECT DISTINCT year, make, model, trim FROM vehicle_fitments 
WHERE year = 2024 AND make ILIKE 'Ford' AND model ILIKE '%escape%'
ORDER BY trim;

SELECT DISTINCT year, make, model, trim FROM vehicle_fitments 
WHERE year = 2024 AND make ILIKE 'Audi' AND model ILIKE '%S4%'
ORDER BY trim;

SELECT DISTINCT year, make, model, trim FROM vehicle_fitments 
WHERE year = 2024 AND make ILIKE 'Mercedes%' AND (model ILIKE '%C-Class%' OR model ILIKE '%C Class%')
ORDER BY model, trim;

SELECT DISTINCT year, make, model, trim FROM vehicle_fitments 
WHERE year = 2024 AND make ILIKE 'Honda' AND model ILIKE '%Accord%'
ORDER BY trim;

SELECT DISTINCT year, make, model, trim FROM vehicle_fitments 
WHERE year = 2024 AND make ILIKE 'Chevrolet' AND model ILIKE '%Bolt%'
ORDER BY model, trim;
