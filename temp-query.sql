SELECT DISTINCT sku, brand, model, diameter, width, bolt_pattern, offset_mm
FROM wheels 
WHERE diameter = 15 
AND bolt_pattern LIKE '%5x127%'
LIMIT 20;