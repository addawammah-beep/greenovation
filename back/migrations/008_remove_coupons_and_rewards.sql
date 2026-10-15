DELETE FROM audit_events
WHERE entity_type = 'coupon'
   OR action LIKE 'COUPON%'
   OR action LIKE 'COUPONS_%';

DROP TABLE IF EXISTS coupon_events CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
