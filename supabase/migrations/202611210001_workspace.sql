begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(), name varchar(160) not null,
  address varchar(300) not null default 'Ajman, United Arab Emirates',
  phone varchar(40) not null default '', email varchar(180) not null default '',
  is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.memberships (
  workspace_id uuid not null references public.workspaces(id), user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','manager','accountant','viewer')),
  display_name varchar(160) not null, primary key(workspace_id,user_id)
);
create function private.member_role(w uuid) returns text language sql stable security definer set search_path='' as $$
  select role from public.memberships where workspace_id=w and user_id=(select auth.uid())
$$;
create function private.can_manage(w uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(w) in ('owner','manager'),false)
$$;
create function private.can_finance(w uuid) returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(private.member_role(w) in ('owner','manager','accountant'),false)
$$;
revoke all on function private.member_role(uuid), private.can_manage(uuid), private.can_finance(uuid) from public;
grant execute on function private.member_role(uuid), private.can_manage(uuid), private.can_finance(uuid) to authenticated;

create table public.buildings (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  name varchar(160) not null check(length(trim(name))>0), code varchar(24) not null,
  area varchar(120) not null, address varchar(300) not null default '',
  amenities text[] not null default '{}', notes varchar(2000) not null default '',
  color text not null default 'sage' check(color in ('sage','sand','slate','rose')),
  created_at timestamptz not null default now(), unique(id,workspace_id), unique(workspace_id,code)
);
create table public.floors (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  building_id uuid not null, name varchar(80) not null, ordinal integer not null check(ordinal between -10 and 200),
  foreign key(building_id,workspace_id) references public.buildings(id,workspace_id),
  unique(id,building_id,workspace_id), unique(building_id,ordinal)
);
create table public.units (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  building_id uuid not null, floor_id uuid not null, code varchar(30) not null,
  category text not null check(category in ('Studio','1 BHK','2 BHK','3 BHK')),
  monthly_rent bigint not null check(monthly_rent between 0 and 10000000000),
  area_sqft integer not null default 0 check(area_sqft between 0 and 1000000),
  status text not null default 'available' check(status in ('available','maintenance')),
  amenities text[] not null default '{}', created_at timestamptz not null default now(),
  foreign key(floor_id,building_id,workspace_id) references public.floors(id,building_id,workspace_id),
  unique(id,workspace_id), unique(building_id,code)
);
create table public.tenants (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  name varchar(160) not null check(length(trim(name))>0), email varchar(180) not null default '',
  phone varchar(40) not null, nationality varchar(80) not null default '',
  notes varchar(2000) not null default '', created_at timestamptz not null default now(), unique(id,workspace_id)
);
create table public.leases (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  tenant_id uuid not null, unit_id uuid not null, reference varchar(40) not null,
  start_date date not null, end_date date not null check(end_date>=start_date),
  annual_rent bigint not null check(annual_rent between 1 and 10000000000),
  installments integer not null check(installments in (1,2,3,4,6,12)),
  status text not null default 'active' check(status in ('active','ended')),
  closed_on date, notes varchar(2000) not null default '', created_at timestamptz not null default now(),
  foreign key(tenant_id,workspace_id) references public.tenants(id,workspace_id),
  foreign key(unit_id,workspace_id) references public.units(id,workspace_id),
  unique(id,workspace_id), unique(workspace_id,reference)
);
create index leases_unit_dates on public.leases(unit_id,start_date,end_date) where status='active';
create table public.cheques (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  tenant_id uuid not null, lease_id uuid, number varchar(50) not null, bank varchar(120) not null default '',
  amount bigint not null check(amount between 1 and 10000000000), due_date date not null,
  purpose text not null default 'rent' check(purpose in ('rent','security')),
  status text not null default 'received' check(status in ('received','deposited','cleared','bounced','cancelled','returned')),
  cleared_on date, created_at timestamptz not null default now(),
  foreign key(tenant_id,workspace_id) references public.tenants(id,workspace_id),
  foreign key(lease_id,workspace_id) references public.leases(id,workspace_id), unique(id,workspace_id)
);
create index cheques_due on public.cheques(workspace_id,due_date) where status in ('received','deposited','bounced');
create table public.ledger (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  tenant_id uuid not null, lease_id uuid, cheque_id uuid unique,
  kind text not null check(kind in ('opening','rent','payment','adjustment')),
  amount bigint not null check(amount between -10000000000 and 10000000000 and amount<>0),
  description varchar(300) not null, entry_date date not null default (now() at time zone 'Asia/Dubai')::date,
  idempotency_key uuid unique, created_at timestamptz not null default now(),
  foreign key(tenant_id,workspace_id) references public.tenants(id,workspace_id),
  foreign key(lease_id,workspace_id) references public.leases(id,workspace_id),
  foreign key(cheque_id,workspace_id) references public.cheques(id,workspace_id)
);
create index ledger_tenant on public.ledger(workspace_id,tenant_id,entry_date);
create table public.deposits (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  tenant_id uuid not null, amount bigint not null check(amount between 1 and 10000000000),
  reference varchar(160) not null, status text not null default 'held' check(status in ('held','returned')),
  received_on date not null default (now() at time zone 'Asia/Dubai')::date, returned_on date,
  foreign key(tenant_id,workspace_id) references public.tenants(id,workspace_id)
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  target_type text not null check(target_type in ('building','floor','unit','tenant','lease')), target_id uuid not null,
  category text not null check(category in ('Photo','Floor plan','Passport','Emirates ID','Bank statement','Contract','Other')),
  name varchar(200) not null, mime varchar(80) not null, size integer not null check(size between 1 and 20971520),
  storage_path text not null unique, thumbnail_path text, sha256 varchar(64) not null,
  group_id uuid not null default gen_random_uuid(), version integer not null default 1 check(version>0),
  status text not null default 'current' check(status in ('current','superseded','archived')),
  scan_engine varchar(120) not null, uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), unique(group_id,version)
);
create index documents_target on public.documents(workspace_id,target_type,target_id);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  cheque_id uuid not null references public.cheques(id), kind text not null check(kind in ('due_soon','overdue')),
  created_at timestamptz not null default now(), unique(cheque_id,kind)
);
create table public.notification_reads (
  notification_id uuid not null references public.notifications(id), user_id uuid not null references auth.users(id),
  read_at timestamptz not null default now(), primary key(notification_id,user_id)
);
create table public.activities (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  actor_id uuid references auth.users(id), resource_type text not null, resource_id uuid not null,
  action text not null, created_at timestamptz not null default now()
);

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
create policy workspace_read on public.workspaces for select to authenticated using(private.member_role(id) is not null);
create policy workspace_update on public.workspaces for update to authenticated using(private.member_role(id)='owner') with check(private.member_role(id)='owner');
create policy membership_read on public.memberships for select to authenticated using(private.member_role(workspace_id) is not null);

do $$ declare t text; begin
  foreach t in array array['buildings','floors','units','tenants','leases','cheques','ledger','deposits','notifications','activities'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy member_read on public.%I for select to authenticated using(private.member_role(workspace_id) is not null)',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  foreach t in array array['buildings','floors','units'] loop
    execute format('create policy manager_insert on public.%I for insert to authenticated with check(private.can_manage(workspace_id))',t);
    execute format('create policy manager_update on public.%I for update to authenticated using(private.can_manage(workspace_id)) with check(private.can_manage(workspace_id))',t);
    execute format('grant insert,update on public.%I to authenticated',t);
  end loop;
end $$;
create policy tenant_update on public.tenants for update to authenticated using(private.can_manage(workspace_id)) with check(private.can_manage(workspace_id));
grant update on public.tenants to authenticated;
alter table public.documents enable row level security;
create policy documents_read on public.documents for select to authenticated using(
  private.member_role(workspace_id) is not null and (private.can_finance(workspace_id) or (target_type in ('building','floor','unit') and category in ('Photo','Floor plan')))
);
grant select on public.documents to authenticated;
alter table public.notification_reads enable row level security;
create policy own_reads on public.notification_reads for select to authenticated using(user_id=(select auth.uid()));
create policy mark_read on public.notification_reads for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.notifications n where n.id=notification_id and private.member_role(n.workspace_id) is not null));
grant select,insert on public.notification_reads to authenticated;
grant select,update on public.workspaces to authenticated;
grant select on public.memberships to authenticated;
grant all on all tables in schema public to service_role;

create function private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.activities(workspace_id,actor_id,resource_type,resource_id,action)
  values(new.workspace_id,auth.uid(),tg_table_name,new.id,lower(tg_op));
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['buildings','units','tenants','leases','cheques','ledger','deposits','documents'] loop
    execute format('create trigger record_activity after insert or update on public.%I for each row execute function private.audit_change()',t);
  end loop;
end $$;

create function private.generate_reminders() returns void language sql security definer set search_path='' as $$
  insert into public.notifications(workspace_id,cheque_id,kind)
  select workspace_id,id,case when due_date<(now() at time zone 'Asia/Dubai')::date then 'overdue' else 'due_soon' end
  from public.cheques where purpose='rent' and status in ('received','deposited','bounced')
    and due_date <= (now() at time zone 'Asia/Dubai')::date+7
  on conflict(cheque_id,kind) do nothing;
$$;
revoke all on function private.generate_reminders() from public;

create function public.create_tenant(w uuid, details jsonb, opening bigint default 0) returns uuid language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to add tenants'; end if;
  if abs(opening)>10000000000 then raise exception 'Opening balance is too large'; end if;
  insert into public.tenants(workspace_id,name,email,phone,nationality,notes)
  values(w,details->>'name',coalesce(details->>'email',''),details->>'phone',coalesce(details->>'nationality',''),coalesce(details->>'notes','')) returning id into t;
  if opening<>0 then insert into public.ledger(workspace_id,tenant_id,kind,amount,description) values(w,t,'opening',opening,'Opening balance carried forward'); end if;
  return t;
end $$;

create function public.create_lease(w uuid, t uuid, u uuid, starts date, rent bigint, checks integer, ref text, bank_name text default '', notes_text text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare l uuid; finishes date; i integer; amount_part bigint;
begin
  if not private.can_manage(w) then raise exception 'You do not have permission to create agreements'; end if;
  if checks not in (1,2,3,4,6,12) or rent<1 or rent>10000000000 then raise exception 'Invalid rent or payment schedule'; end if;
  finishes := (starts+interval '1 year'-interval '1 day')::date;
  perform 1 from public.units where id=u and workspace_id=w and status='available' for update;
  if not found then raise exception 'Choose an available flat from this workspace'; end if;
  if not exists(select 1 from public.tenants where id=t and workspace_id=w) then raise exception 'Tenant not found'; end if;
  if exists(select 1 from public.leases where unit_id=u and status='active' and starts<=end_date and finishes>=start_date) then raise exception 'This flat already has an agreement covering these dates'; end if;
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

create function public.set_cheque_status(c uuid, new_status text, on_date date default (now() at time zone 'Asia/Dubai')::date, new_number text default null, new_bank text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare row_c public.cheques;
begin
  select * into row_c from public.cheques where id=c for update;
  if not found or not private.can_finance(row_c.workspace_id) then raise exception 'Cheque not found or permission denied'; end if;
  if new_status=row_c.status then return c; end if;
  if row_c.status in ('cleared','cancelled','returned') then raise exception 'A finalized cheque cannot be changed'; end if;
  if new_status not in ('received','deposited','cleared','bounced','cancelled','returned') then raise exception 'Invalid cheque status'; end if;
  if row_c.purpose='security' and new_status not in ('received','returned','cancelled') then raise exception 'Security cheques are held separately from rental payments'; end if;
  if row_c.purpose='rent' and new_status='returned' then raise exception 'Use cancelled for a returned rent cheque'; end if;
  if new_status='bounced' and row_c.status<>'deposited' then raise exception 'Only a deposited cheque can be marked bounced'; end if;
  if on_date>(now() at time zone 'Asia/Dubai')::date then raise exception 'Payment date cannot be in the future'; end if;
  update public.cheques set status=new_status,cleared_on=case when new_status='cleared' then on_date else null end,
    number=coalesce(new_number,number),bank=coalesce(new_bank,bank) where id=c;
  if new_status='cleared' then
    insert into public.ledger(workspace_id,tenant_id,lease_id,cheque_id,kind,amount,description,entry_date)
    values(row_c.workspace_id,row_c.tenant_id,row_c.lease_id,c,'payment',-row_c.amount,'Cheque cleared · '||coalesce(new_number,row_c.number),on_date)
    on conflict(cheque_id) do nothing;
  end if;
  perform private.generate_reminders();
  return c;
end $$;

create function public.record_account_entry(w uuid,t uuid,amount_cents bigint,entry_kind text,label text,on_date date,request_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare e uuid;
begin
  if not private.can_finance(w) then raise exception 'You do not have permission to record payments'; end if;
  if entry_kind not in ('payment','adjustment') or amount_cents=0 or abs(amount_cents)>10000000000 or length(trim(label))<3 or length(label)>300 then raise exception 'Invalid account entry'; end if;
  if entry_kind='payment' and amount_cents>0 then raise exception 'Payments must reduce the tenant balance'; end if;
  if on_date>(now() at time zone 'Asia/Dubai')::date then raise exception 'Payment date cannot be in the future'; end if;
  if not exists(select 1 from public.tenants where id=t and workspace_id=w) then raise exception 'Tenant not found'; end if;
  insert into public.ledger(workspace_id,tenant_id,kind,amount,description,entry_date,idempotency_key)
  values(w,t,entry_kind,amount_cents,label,on_date,request_key) on conflict(idempotency_key) do nothing returning id into e;
  if e is null then select id into e from public.ledger where idempotency_key=request_key and workspace_id=w and tenant_id=t; end if;
  if e is null then raise exception 'This payment reference was already used'; end if;
  return e;
end $$;

create function public.add_security(w uuid,t uuid,amount_cents bigint,ref text,is_cheque boolean,bank_name text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  if not private.can_finance(w) or not exists(select 1 from public.tenants where id=t and workspace_id=w) then raise exception 'Tenant not found or permission denied'; end if;
  if is_cheque then
    insert into public.cheques(workspace_id,tenant_id,amount,number,bank,due_date,purpose)
    values(w,t,amount_cents,ref,bank_name,(now() at time zone 'Asia/Dubai')::date,'security') returning id into result;
  else
    insert into public.deposits(workspace_id,tenant_id,amount,reference) values(w,t,amount_cents,ref) returning id into result;
  end if;
  return result;
end $$;
create function public.return_deposit(d uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare w uuid;
begin
  select workspace_id into w from public.deposits where id=d for update;
  if not private.can_finance(w) then raise exception 'Deposit not found or permission denied'; end if;
  update public.deposits set status='returned',returned_on=(now() at time zone 'Asia/Dubai')::date where id=d and status='held';
  return d;
end $$;
create function public.end_lease(l uuid,on_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare row_l public.leases; outstanding bigint;
begin
  select * into row_l from public.leases where id=l for update;
  if not found or not private.can_manage(row_l.workspace_id) then raise exception 'Agreement not found or permission denied'; end if;
  if on_date<row_l.end_date or on_date>(now() at time zone 'Asia/Dubai')::date then raise exception 'Close only on or after the agreement end date. Early termination requires a reviewed settlement.'; end if;
  update public.leases set status='ended',closed_on=on_date where id=l;
  return l;
end $$;

create function public.register_scanned_document(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare old_doc public.documents; new_id uuid; new_group uuid; new_version integer:=1;
begin
  if auth.role()<>'service_role' then raise exception 'Server access required'; end if;
  if p->>'replaces' is not null then
    select * into old_doc from public.documents where id=(p->>'replaces')::uuid and workspace_id=(p->>'workspace_id')::uuid and status='current' for update;
    if not found or old_doc.target_id<>(p->>'target_id')::uuid or old_doc.target_type<>p->>'target_type' or old_doc.category<>p->>'category' then raise exception 'The original document has changed. Refresh and try again.'; end if;
    new_group:=old_doc.group_id; new_version:=old_doc.version+1;
    update public.documents set status='superseded' where id=old_doc.id;
  else new_group:=gen_random_uuid(); end if;
  insert into public.documents(workspace_id,target_type,target_id,category,name,mime,size,storage_path,thumbnail_path,sha256,group_id,version,scan_engine,uploaded_by)
  values((p->>'workspace_id')::uuid,p->>'target_type',(p->>'target_id')::uuid,p->>'category',p->>'name',p->>'mime',(p->>'size')::integer,p->>'storage_path',p->>'thumbnail_path',p->>'sha256',new_group,new_version,p->>'scan_engine',(p->>'uploaded_by')::uuid) returning id into new_id;
  return new_id;
end $$;

revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.create_tenant(uuid,jsonb,bigint),public.create_lease(uuid,uuid,uuid,date,bigint,integer,text,text,text),public.set_cheque_status(uuid,text,date,text,text),public.record_account_entry(uuid,uuid,bigint,text,text,date,uuid),public.add_security(uuid,uuid,bigint,text,boolean,text),public.return_deposit(uuid),public.end_lease(uuid,date) to authenticated,service_role;
grant execute on function public.register_scanned_document(jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('aliyas-private','aliyas-private',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- No authenticated storage-object writes or reads: the server scans uploads and
-- checks record permissions before issuing a short-lived private file URL.
create extension if not exists pg_cron;
select cron.schedule('aliyas-cheque-reminders','0 4 * * *','select private.generate_reminders()');
notify pgrst,'reload schema';
commit;
