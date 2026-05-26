SELECT o.id, o."orderNumber", o.status, o."createdAt", so."supplierOrderNumber", so."trackingNumber", so.status as supplier_status 
FROM orders o 
LEFT JOIN supplier_orders so ON o.id = so."orderId" 
WHERE LOWER(o."customerEmail") LIKE '%rastello%' OR LOWER(o."customerName") LIKE '%laura%' 
ORDER BY o."createdAt" DESC LIMIT 5;
