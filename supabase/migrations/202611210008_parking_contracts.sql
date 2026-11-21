begin;
alter table public.parking_allocations add column rate_amount bigint not null check(rate_amount between 1 and 10000000000);
alter table public.parking_allocations add column rate_period text not null check(rate_period in ('monthly','yearly'));
alter table public.parking_allocations add column annual_charge bigint not null check(annual_charge between 1 and 10000000000);
alter table public.parking_allocations add constraint parking_allocation_workspace unique(id,workspace_id);
alter table public.ledger drop constraint ledger_kind_check;
alter table public.ledger add constraint ledger_kind_check check(kind in ('opening','rent','parking','payment','adjustment'));
alter table public.ledger add column parking_allocation_id uuid;
alter table public.ledger add foreign key(parking_allocation_id,workspace_id) references public.parking_allocations(id,workspace_id);
create unique index parking_charge_once on public.ledger(parking_allocation_id) where kind='parking';
create index parking_by_lease on public.parking_allocations(lease_id);

create function private.reprice_parking_cheques(l uuid) returns void language plpgsql security definer set search_path='' as $$
declare lease_row public.leases; cheque_row public.cheques; total_amount bigint; position integer:=0;
begin
  select * into lease_row from public.leases where id=l for no key update;
  perform 1 from public.cheques where lease_id=l and purpose='rent' order by id for update;
  if exists(select 1 from public.cheques where lease_id=l and purpose='rent' and status<>'scheduled') then
    raise exception 'Parking charges cannot change after cheques have been received or processed. Add parking when creating or renewing the agreement';
  end if;
  if (select count(*) from public.cheques where lease_id=l and purpose='rent')<>lease_row.installments then
    raise exception 'This agreement does not have a complete cheque schedule';
  end if;
  select lease_row.annual_rent+coalesce(sum(annual_charge),0) into total_amount from public.parking_allocations where lease_id=l and status='active';
  if total_amount>10000000000 then raise exception 'The combined contract amount exceeds the supported limit'; end if;
  for cheque_row in select * from public.cheques where lease_id=l and purpose='rent' order by due_date,id loop
    position:=position+1;
    update public.cheques set amount=total_amount/lease_row.installments+case when position=lease_row.installments then total_amount%lease_row.installments else 0 end where id=cheque_row.id;
  end loop;
end $$;

create function private.assign_parking(l uuid,lot_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare lease_row public.leases; lot public.parking_lots; lot_id uuid; property_id uuid; allocation_id uuid; annual_fee bigint; label text; property_name text;
begin
  select * into lease_row from public.leases where id=l for no key update;
  if not found or not private.can_manage(lease_row.workspace_id) then raise exception 'Agreement not found or permission denied'; end if;
  if lease_row.status<>'active' or lease_row.end_date<(now() at time zone 'Asia/Dubai')::date then raise exception 'Choose an active or upcoming agreement'; end if;
  if coalesce(cardinality(lot_ids),0) not between 1 and 20 or cardinality(lot_ids)<>(select count(distinct x) from unnest(lot_ids) x) then raise exception 'Choose between 1 and 20 different parking lots'; end if;
  select building_id into property_id from public.units where id=lease_row.unit_id;
  for lot_id in select x from unnest(lot_ids) x order by x loop
    select * into lot from public.parking_lots where id=lot_id and workspace_id=lease_row.workspace_id for update;
    if not found or lot.status<>'available' then raise exception 'A selected parking lot is unavailable'; end if;
    if lot.building_id<>property_id then raise exception 'Parking must be in the same building as the tenant apartment'; end if;
    if exists(select 1 from public.parking_allocations where lease_id=l and lot_id=lot.id and status='active') then continue; end if;
    if lot.rate_amount is null or lot.rate_period is null then raise exception 'Set a confirmed parking rate before allocating this lot'; end if;
    annual_fee:=case when lot.rate_period='monthly' then lot.rate_amount*12 else lot.rate_amount end;
    if annual_fee>10000000000 then raise exception 'The annual parking fee exceeds the supported limit'; end if;
    select coalesce((select name||' · ' from public.floors where id=lot.floor_id),'')||'Lot '||lot.number into label;
    select name into property_name from public.buildings where id=lot.building_id;
    insert into public.parking_allocations(workspace_id,lot_id,lease_id,tenant_id,start_date,end_date,lot_label,property_label,rate_amount,rate_period,annual_charge)
    values(lease_row.workspace_id,lot.id,l,lease_row.tenant_id,lease_row.start_date,lease_row.end_date,label,property_name,lot.rate_amount,lot.rate_period,annual_fee) returning id into allocation_id;
    insert into public.ledger(workspace_id,tenant_id,lease_id,parking_allocation_id,kind,amount,description,entry_date,idempotency_key)
    values(lease_row.workspace_id,lease_row.tenant_id,l,allocation_id,'parking',annual_fee,left('Annual parking · '||property_name||' · '||label||' · '||lease_row.reference,300),lease_row.start_date,allocation_id);
  end loop;
  perform private.reprice_parking_cheques(l);
  return l;
end $$;

create function public.allocate_parking(l uuid,lot_ids uuid[]) returns uuid language sql security definer set search_path='' as $$
  select private.assign_parking(l,lot_ids)
$$;
create function public.create_lease_with_parking(w uuid,t uuid,u uuid,starts date,rent bigint,checks integer,ref text,lot_ids uuid[],bank_name text default '',notes_text text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
  l:=public.create_lease(w,t,u,starts,rent,checks,ref,bank_name,notes_text);
  perform private.assign_parking(l,lot_ids);
  return l;
end $$;
create function public.cancel_parking_allocation(a uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare allocation public.parking_allocations;
begin
  select * into allocation from public.parking_allocations where id=a;
  if not found or not private.can_manage(allocation.workspace_id) then raise exception 'Parking allocation not found or permission denied'; end if;
  perform 1 from public.leases where id=allocation.lease_id for no key update;
  select * into allocation from public.parking_allocations where id=a for update;
  if allocation.status='cancelled' then return allocation.lease_id; end if;
  update public.parking_allocations set status='cancelled' where id=a;
  insert into public.ledger(workspace_id,tenant_id,lease_id,parking_allocation_id,kind,amount,description,entry_date)
  values(allocation.workspace_id,allocation.tenant_id,allocation.lease_id,a,'adjustment',-allocation.annual_charge,left('Parking reservation cancelled · '||allocation.lot_label,300),allocation.start_date);
  perform private.reprice_parking_cheques(allocation.lease_id);
  return allocation.lease_id;
end $$;
revoke all on function private.assign_parking(uuid,uuid[]),private.reprice_parking_cheques(uuid) from public;
revoke all on function public.allocate_parking(uuid,uuid[]),public.cancel_parking_allocation(uuid),public.create_lease_with_parking(uuid,uuid,uuid,date,bigint,integer,text,uuid[],text,text) from public;
grant execute on function public.allocate_parking(uuid,uuid[]),public.cancel_parking_allocation(uuid),public.create_lease_with_parking(uuid,uuid,uuid,date,bigint,integer,text,uuid[],text,text) to authenticated,service_role;
commit;
