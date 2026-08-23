-- KICKPOINT: establish the real starting point for inventory control.
-- The current catalog and physical stock are intentionally untouched.
-- At this point there are no real sales, so all legacy transaction history
-- from development/testing must not contaminate the admin dashboard or Kárdex.

DELETE FROM public.payment_proofs;
DELETE FROM public.payments;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.inventory_movements;
