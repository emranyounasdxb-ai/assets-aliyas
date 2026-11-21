begin;

-- Shops share the existing tenancy, ledger and private document controls.
alter table public.units drop constraint units_category_check;
alter table public.units add constraint units_category_check check(category in ('Studio','1 BHK','2 BHK','3 BHK','Shop'));
alter table public.units add column notes varchar(2000) not null default '';
alter table public.units drop constraint units_building_id_code_key;
create unique index units_building_type_code on public.units(building_id,(category='Shop'),code);
alter table public.tenants add column company_name varchar(160) not null default '';
alter table public.tenants add column trade_license varchar(120) not null default '';

create or replace function private.check_unit_floor() returns trigger language plpgsql set search_path='' as $$
declare floor_use text; floor_number integer;
begin
  select purpose,ordinal into floor_use,floor_number from public.floors
  where id=new.floor_id and workspace_id=new.workspace_id and building_id=new.building_id for update;
  if not found then raise exception 'Choose a floor in this property'; end if;
  if floor_use in ('parking','service') then raise exception 'Rental units cannot be added to parking or service floors'; end if;
  if new.category='Shop' and floor_number<>0 then raise exception 'Shops must be on the ground floor'; end if;
  if tg_op='UPDATE' and (
    new.floor_id is distinct from old.floor_id or new.building_id is distinct from old.building_id or
    (new.category='Shop') is distinct from (old.category='Shop')
  ) and exists(select 1 from public.leases where unit_id=new.id) then
    raise exception 'A unit with agreement history cannot change its property, floor or rental type';
  end if;
  return new;
end $$;
drop trigger unit_floor_use on public.units;
create trigger unit_floor_use before insert or update of floor_id,building_id,workspace_id,category on public.units for each row execute function private.check_unit_floor();

create or replace function private.check_floor_use() returns trigger language plpgsql set search_path='' as $$
begin
  if new.purpose in ('parking','service') and exists(select 1 from public.units where floor_id=new.id) then
    raise exception 'This floor has rental units. Move them before changing it to parking or services';
  end if;
  if new.purpose in ('residential','service') and exists(select 1 from public.parking_lots where floor_id=new.id) then
    raise exception 'This floor has parking lots. Move them before changing its use';
  end if;
  if new.ordinal<>0 and exists(select 1 from public.units where floor_id=new.id and category='Shop') then
    raise exception 'A floor with shops must remain the ground floor';
  end if;
  return new;
end $$;
drop trigger floor_use_change on public.floors;
create trigger floor_use_change before update of purpose,ordinal on public.floors for each row execute function private.check_floor_use();

create or replace function public.create_tenant(w uuid, details jsonb, opening bigint default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to add tenants'; end if;
  if abs(opening)>10000000000 then raise exception 'Opening balance is too large'; end if;
  insert into public.tenants(workspace_id,name,email,phone,nationality,notes,company_name,trade_license)
  values(w,details->>'name',coalesce(details->>'email',''),details->>'phone',coalesce(details->>'nationality',''),coalesce(details->>'notes',''),coalesce(details->>'company_name',''),coalesce(details->>'trade_license','')) returning id into t;
  if opening<>0 then insert into public.ledger(workspace_id,tenant_id,kind,amount,description) values(w,t,'opening',opening,'Opening balance carried forward'); end if;
  return t;
end $$;

create or replace function public.create_lease(w uuid, t uuid, u uuid, starts date, rent bigint, checks integer, ref text, bank_name text default '', notes_text text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid; finishes date; i integer; amount_part bigint;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to create agreements'; end if;
  if checks not in (1,2,3,4,6,12) or rent<1 or rent>10000000000 then raise exception 'Invalid rent or payment schedule'; end if;
  finishes := (starts+interval '1 year'-interval '1 day')::date;
  perform 1 from public.units where id=u and workspace_id=w and status='available' for update;
  if not found then raise exception 'Choose an available flat or shop from this workspace'; end if;
  if not exists(select 1 from public.tenants where id=t and workspace_id=w) then raise exception 'Tenant not found'; end if;
  if exists(select 1 from public.leases where unit_id=u and status='active' and starts<=end_date and finishes>=start_date) then raise exception 'This rental unit already has an agreement covering these dates'; end if;
  insert into public.leases(workspace_id,tenant_id,unit_id,reference,start_date,end_date,annual_rent,installments,notes)
  values(w,t,u,ref,starts,finishes,rent,checks,notes_text) returning id into l;
  insert into public.ledger(workspace_id,tenant_id,lease_id,kind,amount,description,entry_date)
  values(w,t,l,'rent',rent,'Annual rent · '||ref,starts);
  for i in 0..checks-1 loop
    amount_part := rent/checks + case when i=checks-1 then rent%checks else 0 end;
    if amount_part<1 then raise exception 'Rent is too small for this payment schedule'; end if;
    insert into public.cheques(workspace_id,tenant_id,lease_id,number,bank,amount,due_date)
    values(w,t,l,ref||'/'||(i+1),bank_name,amount_part,(starts+make_interval(months=>i*(12/checks)))::date);
  end loop;
  perform private.generate_reminders();
  return l;
end $$;

notify pgrst,'reload schema';
commit;
