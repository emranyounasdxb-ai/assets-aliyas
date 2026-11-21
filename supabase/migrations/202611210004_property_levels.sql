begin;
alter table public.buildings add column declared_levels integer check (declared_levels between 1 and 250);
alter table public.floors add column purpose text not null default 'unspecified' check (purpose in ('unspecified','residential','parking','service'));
alter table public.floors add column notes varchar(1000) not null default '';



create function private.check_unit_floor() returns trigger language plpgsql set search_path='' as $$
declare floor_use text;
begin
  select purpose into floor_use from public.floors
  where id=new.floor_id and workspace_id=new.workspace_id and building_id=new.building_id for update;
  if not found then raise exception 'Choose a floor in this property'; end if;
  if floor_use in ('parking','service') then raise exception 'Apartments cannot be added to parking or service floors'; end if;
  return new;
end $$;
create trigger unit_floor_use before insert or update of floor_id,building_id,workspace_id on public.units for each row execute function private.check_unit_floor();

create function private.check_floor_use() returns trigger language plpgsql set search_path='' as $$
begin
  if new.purpose in ('parking','service') and exists(select 1 from public.units where floor_id=new.id) then
    raise exception 'This floor has flats. Move them before changing it to parking or services';
  end if;
  return new;
end $$;
create trigger floor_use_change before update of purpose on public.floors for each row execute function private.check_floor_use();
revoke all on function private.check_unit_floor(),private.check_floor_use() from public;
commit;
