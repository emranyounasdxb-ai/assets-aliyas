begin;
alter table public.cheques drop constraint cheques_status_check;
alter table public.cheques add constraint cheques_status_check check(status in ('scheduled','received','deposited','cleared','bounced','cancelled','returned'));
alter table public.cheques alter column status set default 'scheduled';
create or replace function public.add_security(w uuid,t uuid,amount_cents bigint,ref text,is_cheque boolean,bank_name text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not private.can_finance(w) or not exists(select 1 from public.tenants where id=t and workspace_id=w) then raise exception 'Tenant not found or permission denied'; end if;
  if is_cheque then
    insert into public.cheques(workspace_id,tenant_id,amount,number,bank,due_date,purpose,status)
    values(w,t,amount_cents,ref,bank_name,(now() at time zone 'Asia/Dubai')::date,'security','received') returning id into result;
  else insert into public.deposits(workspace_id,tenant_id,amount,reference) values(w,t,amount_cents,ref) returning id into result;
  end if;
  return result;
end $$;
create or replace function private.generate_reminders() returns void language sql security definer set search_path='' as $$
  insert into public.notifications(workspace_id,cheque_id,kind)
  select workspace_id,id,case when due_date<(now() at time zone 'Asia/Dubai')::date then 'overdue' else 'due_soon' end
  from public.cheques where purpose='rent' and status in ('scheduled','received','deposited','bounced')
  and due_date <= (now() at time zone 'Asia/Dubai')::date+7
  on conflict(cheque_id,kind) do nothing;
$$;
alter table public.documents add column upload_key uuid not null default gen_random_uuid() unique;
create or replace function public.register_scanned_document(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old_doc public.documents; new_id uuid; new_group uuid; new_version integer:=1;
begin
  if auth.role()<>'service_role' then raise exception 'Server access required'; end if;
  select id into new_id from public.documents where upload_key=(p->>'upload_key')::uuid and workspace_id=(p->>'workspace_id')::uuid and uploaded_by=(p->>'uploaded_by')::uuid;
  if found then return new_id; end if;
  if p->>'replaces' is not null then
    select * into old_doc from public.documents where id=(p->>'replaces')::uuid and workspace_id=(p->>'workspace_id')::uuid and status='current' for update;
    if not found or old_doc.target_id<>(p->>'target_id')::uuid or old_doc.target_type<>p->>'target_type' or old_doc.category<>p->>'category' then raise exception 'The original document has changed. Refresh and try again.'; end if;
    new_group:=old_doc.group_id; new_version:=old_doc.version+1; update public.documents set status='superseded' where id=old_doc.id;
  else new_group:=gen_random_uuid(); end if;
  insert into public.documents(workspace_id,target_type,target_id,category,name,mime,size,storage_path,thumbnail_path,sha256,group_id,version,scan_engine,uploaded_by,upload_key)
  values((p->>'workspace_id')::uuid,p->>'target_type',(p->>'target_id')::uuid,p->>'category',p->>'name',p->>'mime',(p->>'size')::integer,p->>'storage_path',p->>'thumbnail_path',p->>'sha256',new_group,new_version,p->>'scan_engine',(p->>'uploaded_by')::uuid,(p->>'upload_key')::uuid) returning id into new_id;
  return new_id;
end $$;
notify pgrst,'reload schema';
commit;
