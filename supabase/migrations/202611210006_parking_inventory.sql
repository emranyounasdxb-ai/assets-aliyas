begin;
create extension if not exists btree_gist with schema extensions;
create table public.parking_lots (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  building_id uuid not null, floor_id uuid, number varchar(40) not null check(length(trim(number))>0),
  status text not null default 'available' check(status in ('available','blocked')),
  rate_amount bigint check(rate_amount between 1 and 10000000000),
  rate_period text check(rate_period in ('monthly','yearly')),
  notes varchar(1000) not null default '', created_at timestamptz not null default now(),
  foreign key(building_id,workspace_id) references public.buildings(id,workspace_id),
  foreign key(floor_id,building_id,workspace_id) references public.floors(id,building_id,workspace_id),
  unique(id,workspace_id), unique nulls not distinct(building_id,floor_id,number),
  check((rate_amount is null)=(rate_period is null))
);
alter table public.leases add constraint leases_tenant_workspace unique(id,tenant_id,workspace_id);
create table public.parking_allocations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id),
  lot_id uuid not null, lease_id uuid not null, tenant_id uuid not null,
  start_date date not null, end_date date not null check(end_date>=start_date),
  status text not null default 'active' check(status in ('active','cancelled')),
  lot_label varchar(160) not null, property_label varchar(160) not null,
  created_at timestamptz not null default now(),
  foreign key(lot_id,workspace_id) references public.parking_lots(id,workspace_id),
  foreign key(lease_id,tenant_id,workspace_id) references public.leases(id,tenant_id,workspace_id),
  exclude using gist(lot_id extensions.gist_uuid_ops with =, daterange(start_date,end_date,'[]') with &&) where(status='active')
);
alter table public.parking_lots enable row level security;
alter table public.parking_allocations enable row level security;
grant select,insert,update on public.parking_lots to authenticated;
grant select on public.parking_allocations to authenticated;
grant all on public.parking_lots,public.parking_allocations to service_role;
create policy parking_lots_read on public.parking_lots for select to authenticated using(private.member_role(workspace_id) is not null);
create policy parking_lots_add on public.parking_lots for insert to authenticated with check(private.can_manage(workspace_id));
create policy parking_lots_edit on public.parking_lots for update to authenticated using(private.can_manage(workspace_id)) with check(private.can_manage(workspace_id));
create policy parking_allocations_read on public.parking_allocations for select to authenticated using(private.member_role(workspace_id) is not null);
commit;
