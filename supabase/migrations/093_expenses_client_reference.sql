-- The single-expense form has always had a "Client / Trip Reference"
-- field (label, placeholder, a table column showing it, an edit form) but
-- the expenses table never had a backing column — every add/edit expense
-- submission was failing outright on "Could not find the 'clientReference'
-- column of 'expenses'". Confirmed live via PostgREST's schema introspection
-- that the column has never existed under any name. Adding it now rather
-- than removing the UI, since the feature was clearly intended.
alter table expenses add column if not exists client_reference text;

NOTIFY pgrst, 'reload schema';
