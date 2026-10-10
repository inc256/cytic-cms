-- Run this in the Supabase SQL Editor. If the CEO account does not exist yet,
-- finish account setup in Supabase Auth and rerun this script afterward.
-- Roles are assigned by trusted administrators, never by the signed-in user.

create table if not exists public.cms_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);

create sequence if not exists public.cms_transaction_reference_seq;
create sequence if not exists public.cms_receipt_reference_seq;
create sequence if not exists public.cms_project_reference_seq;

create table if not exists public.cms_projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique default
    ('PRJ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.cms_project_reference_seq')::text, 5, '0')),
  name text not null,
  client_name text not null,
  service_category text not null,
  contract_value bigint not null check (contract_value >= 0),
  status text not null default 'In Progress'
    check (status in ('In Progress', 'Completed', 'On Hold', 'Cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cms_projects add column if not exists completed_at timestamptz;

update public.cms_projects
set completed_at = coalesce(updated_at, created_at)
where status = 'Completed' and completed_at is null;

create table if not exists public.cms_financial_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_ref text not null unique default
    ('TXN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.cms_transaction_reference_seq')::text, 6, '0')),
  transaction_type text not null check (transaction_type in ('income', 'expense', 'refund')),
  transaction_date date not null default current_date,
  party text not null,
  project_id uuid references public.cms_projects(id) on delete set null,
  service_category text,
  description text not null default '',
  amount bigint not null check (amount > 0),
  method text not null,
  payment_reference text,
  receipt_number text unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.cms_business_goals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  metric text not null check (metric in ('revenue', 'expenses', 'inquiries', 'projects_completed')),
  target bigint not null check (target > 0),
  period_start date not null,
  period_end date not null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (period_end >= period_start)
);

grant usage, select on sequence public.cms_transaction_reference_seq to authenticated;
grant usage, select on sequence public.cms_receipt_reference_seq to authenticated;
grant usage, select on sequence public.cms_project_reference_seq to authenticated;

create or replace function public.assign_cms_financial_references()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.transaction_ref is null then
    new.transaction_ref := 'TXN-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.cms_transaction_reference_seq')::text, 6, '0');
  end if;

  if new.transaction_type = 'income' and new.receipt_number is null then
    new.receipt_number := 'RCT-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.cms_receipt_reference_seq')::text, 6, '0');
  elsif new.transaction_type <> 'income' then
    new.receipt_number := null;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_cms_financial_references on public.cms_financial_transactions;
create trigger assign_cms_financial_references
  before insert on public.cms_financial_transactions
  for each row execute function public.assign_cms_financial_references();

create or replace function public.touch_cms_project_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'Completed' and old.status is distinct from 'Completed' then
    new.completed_at := now();
  elsif new.status <> 'Completed' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists touch_cms_project_timestamps on public.cms_projects;
create trigger touch_cms_project_timestamps
  before update on public.cms_projects
  for each row execute function public.touch_cms_project_timestamps();

create index if not exists cms_projects_status_idx on public.cms_projects(status);
create index if not exists cms_transactions_date_idx on public.cms_financial_transactions(transaction_date desc);
create index if not exists cms_transactions_project_idx on public.cms_financial_transactions(project_id);
create index if not exists cms_transactions_type_date_idx on public.cms_financial_transactions(transaction_type, transaction_date desc);
create index if not exists cms_goals_period_idx on public.cms_business_goals(period_start, period_end);

alter table public.cms_projects enable row level security;
alter table public.cms_financial_transactions enable row level security;
alter table public.cms_business_goals enable row level security;

revoke all on public.cms_projects, public.cms_financial_transactions, public.cms_business_goals from anon, authenticated;
grant select on public.cms_projects, public.cms_financial_transactions, public.cms_business_goals to authenticated;
grant insert, update, delete on public.cms_projects, public.cms_financial_transactions, public.cms_business_goals to authenticated;

alter table public.cms_user_roles
  drop constraint if exists cms_user_roles_role_check;

update public.cms_user_roles
set role = case role
  when 'Owner' then 'CEO'
  when 'Finance' then 'FINANCE'
  when 'Content editor' then 'CONTENT EDITOR'
  when 'Sales' then 'PARTNER'
  else role
end;

alter table public.cms_user_roles
  add constraint cms_user_roles_role_check
  check (role in ('CEO', 'INVESTOR', 'PARTNER', 'CONTENT EDITOR', 'FINANCE', 'SECRETARY', 'DESIGNER'));

alter table public.cms_user_roles enable row level security;

revoke all on public.cms_user_roles from anon, authenticated;
grant select on public.cms_user_roles to authenticated;

drop policy if exists "Users can read their own CMS role" on public.cms_user_roles;
create policy "Users can read their own CMS role"
  on public.cms_user_roles for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare
  ceo_user_id uuid;
begin
  select id into ceo_user_id
  from auth.users
  where lower(email) = lower('mubarakluutu20@gmail.com');

  if ceo_user_id is null then
    raise notice 'CEO role not assigned: create mubarakluutu20@gmail.com in Supabase Auth, then rerun this script.';
  else
    insert into public.cms_user_roles (user_id, role)
    values (ceo_user_id, 'CEO')
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

create or replace function public.has_cms_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_user_roles
    where user_id = (select auth.uid())
      and role = any (allowed_roles)
  );
$$;

revoke all on function public.has_cms_role(text[]) from public;
grant execute on function public.has_cms_role(text[]) to authenticated;

create or replace function public.get_cms_analytics_quote_requests()
returns table (quote_id text, business_name text, selected_services jsonb, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select q.quote_id, q.business_name, q.selected_services, q.status, q.created_at
  from public.quote_requests as q
  where public.has_cms_role(array['CEO', 'INVESTOR', 'PARTNER', 'FINANCE', 'SECRETARY'])
  order by q.created_at desc;
$$;

revoke all on function public.get_cms_analytics_quote_requests() from public;
grant execute on function public.get_cms_analytics_quote_requests() to authenticated;

drop policy if exists "Analytics roles can read projects" on public.cms_projects;
create policy "Analytics roles can read projects"
  on public.cms_projects for select to authenticated
  using (public.has_cms_role(array['CEO', 'INVESTOR', 'PARTNER', 'FINANCE', 'SECRETARY']));

drop policy if exists "CEO can manage projects" on public.cms_projects;
create policy "CEO can manage projects"
  on public.cms_projects for all to authenticated
  using (public.has_cms_role(array['CEO']))
  with check (public.has_cms_role(array['CEO']));

drop policy if exists "Analytics roles can read financial transactions" on public.cms_financial_transactions;
create policy "Analytics roles can read financial transactions"
  on public.cms_financial_transactions for select to authenticated
  using (public.has_cms_role(array['CEO', 'INVESTOR', 'PARTNER', 'FINANCE', 'SECRETARY']));

drop policy if exists "CEO and finance can manage financial transactions" on public.cms_financial_transactions;
create policy "CEO and finance can manage financial transactions"
  on public.cms_financial_transactions for all to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE']))
  with check (public.has_cms_role(array['CEO', 'FINANCE']));

drop policy if exists "Analytics roles can read business goals" on public.cms_business_goals;
create policy "Analytics roles can read business goals"
  on public.cms_business_goals for select to authenticated
  using (public.has_cms_role(array['CEO', 'INVESTOR', 'PARTNER', 'FINANCE', 'SECRETARY']));

drop policy if exists "CEO can manage business goals" on public.cms_business_goals;
create policy "CEO can manage business goals"
  on public.cms_business_goals for all to authenticated
  using (public.has_cms_role(array['CEO']))
  with check (public.has_cms_role(array['CEO']));

alter table public.quote_requests enable row level security;

revoke all on public.quote_requests from anon, authenticated;

drop policy if exists "Anyone can submit a quote request" on public.quote_requests;
create policy "Anyone can submit a quote request"
  on public.quote_requests for insert to anon, authenticated
  with check (status = 'New');

drop policy if exists "Sales and owners can read quote requests" on public.quote_requests;
drop policy if exists "CEO, partners and secretaries can read quote requests" on public.quote_requests;
create policy "CEO, partners and secretaries can read quote requests"
  on public.quote_requests for select to authenticated
  using (public.has_cms_role(array['CEO', 'PARTNER', 'SECRETARY']));

drop policy if exists "Sales and owners can update quote requests" on public.quote_requests;
drop policy if exists "CEO, partners and secretaries can update quote requests" on public.quote_requests;
create policy "CEO, partners and secretaries can update quote requests"
  on public.quote_requests for update to authenticated
  using (public.has_cms_role(array['CEO', 'PARTNER', 'SECRETARY']))
  with check (public.has_cms_role(array['CEO', 'PARTNER', 'SECRETARY']));

grant insert on public.quote_requests to anon, authenticated;
grant select on public.quote_requests to authenticated;
grant update (status) on public.quote_requests to authenticated;
