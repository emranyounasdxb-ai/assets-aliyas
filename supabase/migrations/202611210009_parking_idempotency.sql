begin;
create or replace function private.assign_parking(l uuid,lot_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare lease_row public.leases; lot public.parking_lots; selected_lot_id uuid; changed boolean:=false; property_id uuid; allocation_id uuid; annual_fee bigint; label text; property_name text;
begin
  select * into lease_row from public.leases where id=l for no key update;
  if not found or not private.can_manage(lease_row.workspace_id) then raise exception 'Agreement not found or permission denied'; end if;
  if lease_row.status<>'active' or lease_row.end_date<(now() at time zone 'Asia/Dubai')::date then raise exception 'Choose an active or upcoming agreement'; end if;
  if coalesce(cardinality(lot_ids),0) not between 1 and 20 or cardinality(lot_ids)<>(select count(distinct x) from unnest(lot_ids) x) then raise exception 'Choose between 1 and 20 different parking lots'; end if;
  select building_id into property_id from public.units where id=lease_row.unit_id;
  for selected_lot_id in select x from unnest(lot_ids) x order by x loop
    select * into lot from public.parking_lots where id=selected_lot_id and workspace_id=lease_row.workspace_id for update;
    if not found or lot.status<>'available' then raise exception 'A selected parking lot is unavailable'; end if;
    if lot.building_id<>property_id then raise exception 'Parking must be in the same building as the tenant apartment'; end if;
    if exists(select 1 from public.parking_allocations where lease_id=l and lot_id=lot.id and status='active') then continue; end if;
    if lot.rate_amount is null or lot.rate_period is null then raise exception 'Set a confirmed parking rate before allocating this lot'; end if;
    annual_fee:=case when lot.rate_period='monthly' then lot.rate_amount*12 else lot.rate_amount end;
    if annual_fee>10000000000 then raise exception 'The annual parking fee exceeds the supported limit'; end if;
    select coalesce((select name||' · ' from public.floors where id=lot.floor_id),'')||'Lot '||lot.number into label;
    select name into property_name from public.buildings where id=lot.building_id;
    insert into public.parking_allocations(workspace_id,lot_id,lease_id,tenant_id,start_date,end_date,lot_label,property_label,rate_amount,rate_period,annual_charge)
    values(lease_row.workspace_id,lot.id,l,lease_row.tenant_id,lease_row.start_date,lease_row.end_date,label,property_name,lot.rate_amount,lot.rate_period,annual_fee) returning id into allocation_id; changed:=true;
    insert into public.ledger(workspace_id,tenant_id,lease_id,parking_allocation_id,kind,amount,description,entry_date,idempotency_key)
    values(lease_row.workspace_id,lease_row.tenant_id,l,allocation_id,'parking',annual_fee,left('Annual parking · '||property_name||' · '||label||' · '||lease_row.reference,300),lease_row.start_date,allocation_id);
  end loop;
  if changed then perform private.reprice_parking_cheques(l); end if;
  return l;
end $$;
commit;
