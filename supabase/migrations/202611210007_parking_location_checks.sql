begin;
create function private.check_parking_lot() returns trigger language plpgsql set search_path='' as $$
declare floor_use text;
begin
  if new.floor_id is not null then
    select purpose into floor_use from public.floors where id=new.floor_id and workspace_id=new.workspace_id and building_id=new.building_id for update;
    if not found or floor_use not in ('parking','unspecified') then raise exception 'Choose a parking level or an unclassified level'; end if;
  end if;
  if tg_op='UPDATE' and (new.number is distinct from old.number or new.floor_id is distinct from old.floor_id or new.building_id is distinct from old.building_id or new.status is distinct from old.status) and exists(
    select 1 from public.parking_allocations where lot_id=new.id and status='active' and end_date >= (now() at time zone 'Asia/Dubai')::date
  ) then raise exception 'This space is reserved. Its number, location and availability cannot change during an active reservation'; end if;
  return new;
end $$;
create trigger validate_parking_lot before insert or update on public.parking_lots for each row execute function private.check_parking_lot();
create or replace function private.check_floor_use() returns trigger language plpgsql set search_path='' as $$
begin
  if new.purpose in ('parking','service') and exists(select 1 from public.units where floor_id=new.id) then
    raise exception 'This floor has flats. Move them before changing it to parking or services';
  end if;
  if new.purpose in ('residential','service') and exists(select 1 from public.parking_lots where floor_id=new.id) then
    raise exception 'This floor has parking lots. Move them before changing its use';
  end if;
  return new;
end $$;
revoke all on function private.check_parking_lot() from public;
create trigger record_activity after insert or update on public.parking_lots for each row execute function private.audit_change();
create trigger record_activity after insert or update on public.parking_allocations for each row execute function private.audit_change();
commit;
