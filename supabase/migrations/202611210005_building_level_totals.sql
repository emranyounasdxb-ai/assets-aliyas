begin;
create or replace function public.create_building(w uuid,p jsonb,floor_count integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; i integer;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to add properties'; end if;
  if floor_count not between 0 and 100 then raise exception 'Choose between 0 and 100 upper floors'; end if;
  insert into public.buildings(workspace_id,name,code,area,address,amenities,notes,color,declared_levels)
  values(w,p->>'name',p->>'code',p->>'area',coalesce(p->>'address',''),array(select jsonb_array_elements_text(coalesce(p->'amenities','[]'::jsonb))),coalesce(p->>'notes',''),coalesce(p->>'color','sage'),(p->>'declared_levels')::integer) returning id into b;
  for i in 0..floor_count loop
    insert into public.floors(workspace_id,building_id,name,ordinal) values(w,b,case when i=0 then 'Ground floor' else 'Floor '||i end,i);
  end loop;
  return b;
end $$;
commit;
