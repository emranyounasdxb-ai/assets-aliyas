begin;
alter table public.documents drop constraint documents_category_check;
alter table public.documents add constraint documents_category_check check(category in ('Photo','Floor plan','Passport','Emirates ID','Bank statement','Trade licence','Contract','Other'));
-- The existing RLS still restricts business licences and contracts to finance roles.
notify pgrst,'reload schema';
commit;
