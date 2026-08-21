-- Clean legacy test movements and test transactions to start with fresh zero-state
-- Physical products, product variants, stock, SKUs, and categories remain completely intact

DELETE FROM public.payment_proofs;
DELETE FROM public.payments;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.inventory_movements;
