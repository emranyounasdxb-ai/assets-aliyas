begin;
create function public.create_building(w uuid,p jsonb,floor_count integer) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; i integer;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to add properties'; end if;
  if floor_count not between 0 and 100 then raise exception 'Choose between 0 and 100 upper floors'; end if;
  insert into public.buildings(workspace_id,name,code,area,address,amenities,notes,color)
  values(w,p->>'name',p->>'code',p->>'area',coalesce(p->>'address',''),array(select jsonb_array_elements_text(coalesce(p->'amenities','[]'::jsonb))),coalesce(p->>'notes',''),coalesce(p->>'color','sage')) returning id into b;
  for i in 0..floor_count loop
    insert into public.floors(workspace_id,building_id,name,ordinal) values(w,b,case when i=0 then 'Ground floor' else 'Floor '||i end,i);
  end loop;
  return b;
end $$;
create function public.update_cheque_details(c uuid,ref text,bank_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare row_c public.cheques;
begin
  select * into row_c from public.cheques where id=c for update;
  if not found or not private.can_finance(row_c.workspace_id) then raise exception 'Cheque not found or permission denied'; end if;
  if row_c.status in ('cleared','cancelled','returned') then raise exception 'A finalized cheque cannot be edited'; end if;
  update public.cheques set number=ref,bank=bank_name where id=c;
  return c;
end $$;
revoke all on function public.create_building(uuid,jsonb,integer),public.update_cheque_details(uuid,text,text) from public,anon;
grant execute on function public.create_building(uuid,jsonb,integer),public.update_cheque_details(uuid,text,text) to authenticated,service_role;
notify pgrst,'reload schema';
commit;
