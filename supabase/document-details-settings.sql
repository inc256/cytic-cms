-- Final CMS feature upgrade.
-- Run once after supabase/rbac.sql, supabase/website-cms.sql, and
-- supabase/invoices.sql have been installed. Safe to rerun.
--
-- Covers the current Projects/Invoices/Quotations/Receipts workflows, shared
-- landing-page company details, private invoice bank details, quote inbox
-- permissions, private PNG signatures, and a CEO-only before/after audit trail.

do $$
declare
  missing_tables text;
begin
  select string_agg(required.table_name, ', ' order by required.table_name)
  into missing_tables
  from (values
    ('cms_website_settings'),
    ('cms_document_settings'),
    ('cms_projects'),
    ('cms_financial_transactions'),
    ('cms_business_goals'),
    ('cms_proposals'),
    ('cms_invoices'),
    ('quote_requests'),
    ('cms_user_roles')
  ) as required(table_name)
  where required.table_name <> 'cms_document_settings'
    and to_regclass('public.' || required.table_name) is null;

  if missing_tables is not null then
    raise exception
      'Install the existing RBAC, Website CMS, and Invoices migrations first. Missing tables: %',
      missing_tables;
  end if;

  if to_regprocedure('public.has_cms_role(text[])') is null then
    raise exception 'Install supabase/rbac.sql first; public.has_cms_role(text[]) is required.';
  end if;
end;
$$;

create table if not exists public.cms_document_settings (
  id boolean primary key default true check (id),
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  bank_swift text not null default '',
  bank_address text not null default '',
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);

alter table public.cms_document_settings
  add column if not exists bank_name text not null default '',
  add column if not exists bank_account_name text not null default '',
  add column if not exists bank_account_number text not null default '',
  add column if not exists bank_swift text not null default '',
  add column if not exists bank_address text not null default '',
  add column if not exists digital_signature_path text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.cms_invoices
  add column if not exists client_address text not null default '',
  add column if not exists client_phone text not null default '',
  add column if not exists digital_signature_path text,
  add column if not exists notes text not null default '',
  add column if not exists terms_conditions text not null default '';

alter table public.cms_proposals
  add column if not exists client_email text,
  add column if not exists client_phone text,
  add column if not exists client_address text,
  add column if not exists digital_signature_path text,
  add column if not exists notes text not null default '',
  add column if not exists terms_conditions text not null default '';

update public.cms_proposals
set proposal_code = 'QTN-' || substring(proposal_code from 5)
where proposal_code like 'PRP-%';

alter table public.cms_proposals
  alter column proposal_code set default
    ('QTN-' || lpad(nextval('public.cms_proposal_reference_seq')::text, 5, '0'));

insert into public.cms_website_settings (id, settings)
values (
  true,
  '{
    "address": "",
    "phone": "",
    "public_email": "",
    "instagram": "",
    "linkedin": "",
    "tiktok": "",
    "youtube": "",
    "facebook": "",
    "x": "",
    "whatsapp": "",
    "website": "",
    "show_quote": true,
    "maintenance_mode": false
  }'::jsonb
)
on conflict (id) do update
set settings =
  excluded.settings ||
  case
    when jsonb_typeof(public.cms_website_settings.settings) = 'object'
      then public.cms_website_settings.settings
    else '{}'::jsonb
  end;

insert into public.cms_document_settings (id)
values (true)
on conflict (id) do nothing;

-- Move existing bank values out of the publicly readable landing-page settings.
insert into public.cms_document_settings (
  id,
  bank_name,
  bank_account_name,
  bank_account_number,
  bank_swift,
  bank_address
)
select
  true,
  coalesce(settings ->> 'bank_name', ''),
  coalesce(settings ->> 'bank_account_name', ''),
  coalesce(settings ->> 'bank_account_number', ''),
  coalesce(settings ->> 'bank_swift', ''),
  coalesce(settings ->> 'bank_address', '')
from public.cms_website_settings
where id = true
on conflict (id) do update set
  bank_name = coalesce(nullif(excluded.bank_name, ''), public.cms_document_settings.bank_name),
  bank_account_name = coalesce(
    nullif(excluded.bank_account_name, ''),
    public.cms_document_settings.bank_account_name
  ),
  bank_account_number = coalesce(
    nullif(excluded.bank_account_number, ''),
    public.cms_document_settings.bank_account_number
  ),
  bank_swift = coalesce(nullif(excluded.bank_swift, ''), public.cms_document_settings.bank_swift),
  bank_address = coalesce(
    nullif(excluded.bank_address, ''),
    public.cms_document_settings.bank_address
  );

update public.cms_website_settings
set settings = settings - array[
  'bank_name',
  'bank_account_name',
  'bank_account_number',
  'bank_swift',
  'bank_address'
]
where id = true
  and jsonb_typeof(settings) = 'object';

alter table public.cms_document_settings enable row level security;
revoke all on public.cms_document_settings from anon, authenticated;
grant select, insert, update on public.cms_document_settings to authenticated;

drop policy if exists "CEO and finance can read invoice bank settings"
  on public.cms_document_settings;
create policy "CEO and finance can read invoice bank settings"
  on public.cms_document_settings for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE']));

drop policy if exists "CEO can manage invoice bank settings"
  on public.cms_document_settings;
create policy "CEO can manage invoice bank settings"
  on public.cms_document_settings for all to authenticated
  using (public.has_cms_role(array['CEO']))
  with check (public.has_cms_role(array['CEO']));

create or replace function public.get_cms_digital_signature_path()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select digital_signature_path
  from public.cms_document_settings
  where id = true
    and public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY'])
$$;

revoke all on function public.get_cms_digital_signature_path() from public, anon;
grant execute on function public.get_cms_digital_signature_path() to authenticated;

drop policy if exists "Analytics roles can read shared website settings"
  on public.cms_website_settings;
create policy "Analytics roles can read shared website settings"
  on public.cms_website_settings for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY']));

drop policy if exists "Analytics roles can read landing page quote requests"
  on public.quote_requests;
create policy "Analytics roles can read landing page quote requests"
  on public.quote_requests for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']));

drop policy if exists "Analytics roles can update landing page quote status"
  on public.quote_requests;
create policy "Analytics roles can update landing page quote status"
  on public.quote_requests for update to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']));

grant select on public.quote_requests to authenticated;
grant update (status) on public.quote_requests to authenticated;
grant select on public.cms_website_settings to authenticated;

drop policy if exists "Analytics roles can read quotations" on public.cms_proposals;
create policy "Analytics roles can read quotations"
  on public.cms_proposals for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']));
grant select on public.cms_proposals to authenticated;

drop policy if exists "Analytics roles can update quotations" on public.cms_proposals;
create policy "Analytics roles can update quotations"
  on public.cms_proposals for update to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'FINANCE', 'PARTNER', 'SECRETARY', 'CONTENT EDITOR']));
grant update (
  client,
  client_email,
  client_phone,
  client_address,
  digital_signature_path,
  notes,
  terms_conditions,
  title,
  quote_id,
  line_items,
  value,
  status,
  valid_until
) on public.cms_proposals to authenticated;

create sequence if not exists public.cms_receipt_reference_seq;
grant usage, select on sequence public.cms_receipt_reference_seq to authenticated;

create table if not exists public.cms_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique default
    ('RCT-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.cms_receipt_reference_seq')::text, 6, '0')),
  client_name text not null check (length(btrim(client_name)) > 0),
  project_id uuid references public.cms_projects(id) on delete set null,
  paid_for text not null check (length(btrim(paid_for)) > 0),
  receipt_date date not null default current_date,
  amount_paid bigint not null check (amount_paid > 0),
  balance bigint not null default 0 check (balance >= 0),
  payment_method text not null check (length(btrim(payment_method)) > 0),
  payment_reference text,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.cms_receipts enable row level security;
revoke all on public.cms_receipts from anon, authenticated;
grant select, insert, update, delete on public.cms_receipts to authenticated;

drop policy if exists "Analytics roles can read independent receipts" on public.cms_receipts;
create policy "Analytics roles can read independent receipts"
  on public.cms_receipts for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY']));

drop policy if exists "Finance roles can manage independent receipts" on public.cms_receipts;
create policy "Finance roles can manage independent receipts"
  on public.cms_receipts for all to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE']))
  with check (public.has_cms_role(array['CEO', 'FINANCE']));

-- Preserve receipts already generated from historical income before ending that coupling.
insert into public.cms_receipts (
  receipt_number,
  client_name,
  project_id,
  paid_for,
  receipt_date,
  amount_paid,
  balance,
  payment_method,
  payment_reference,
  notes,
  created_by,
  created_at
)
select
  transactions.receipt_number,
  coalesce(nullif(btrim(transactions.party), ''), 'Client'),
  transactions.project_id,
  coalesce(nullif(btrim(transactions.description), ''), 'Payment received'),
  transactions.transaction_date,
  transactions.amount,
  0,
  coalesce(nullif(btrim(transactions.method), ''), 'Unspecified'),
  transactions.payment_reference,
  '',
  transactions.created_by,
  transactions.created_at
from public.cms_financial_transactions as transactions
where transactions.transaction_type = 'income'
  and transactions.receipt_number is not null
on conflict (receipt_number) do nothing;

update public.cms_financial_transactions
set receipt_number = null
where receipt_number is not null;

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
  new.receipt_number := null;
  return new;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cytic_digital_signatures',
  'cytic_digital_signatures',
  false,
  2097152,
  array['image/png']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/png']::text[];

drop policy if exists "CMS roles can read document signatures" on storage.objects;
create policy "CMS roles can read document signatures"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'cytic_digital_signatures'
    and public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY'])
  );

drop policy if exists "CEO can upload document signatures" on storage.objects;
create policy "CEO can upload document signatures"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cytic_digital_signatures'
    and public.has_cms_role(array['CEO'])
  );

drop policy if exists "CEO can update document signatures" on storage.objects;
create policy "CEO can update document signatures"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'cytic_digital_signatures'
    and public.has_cms_role(array['CEO'])
  )
  with check (
    bucket_id = 'cytic_digital_signatures'
    and public.has_cms_role(array['CEO'])
  );

drop policy if exists "CEO can delete document signatures" on storage.objects;
create policy "CEO can delete document signatures"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'cytic_digital_signatures'
    and public.has_cms_role(array['CEO'])
  );

create or replace function public.mark_cms_invoice_paid(
  invoice_uuid uuid,
  paid_date date,
  payment_method text,
  payment_ref text default null
)
returns table (receipt_number text, transaction_ref text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invoice_row public.cms_invoices%rowtype;
begin
  if not public.has_cms_role(array['CEO', 'FINANCE']) then
    raise exception 'Only CEO or FINANCE can clear invoices as paid'
      using errcode = '42501';
  end if;
  if paid_date is null then
    raise exception 'Payment date is required'
      using errcode = '22023';
  end if;

  select * into invoice_row
  from public.cms_invoices
  where id = invoice_uuid
  for update;
  if not found then
    raise exception 'Invoice not found'
      using errcode = 'P0002';
  end if;
  if invoice_row.status <> 'Sent' then
    raise exception 'Only a sent invoice can be cleared as paid'
      using errcode = '22023';
  end if;

  update public.cms_invoices
  set status = 'Paid',
      paid_at = paid_date::timestamptz
  where id = invoice_row.id;

  return query select null::text, null::text;
end;
$$;

revoke all on function public.mark_cms_invoice_paid(uuid, date, text, text) from public, anon;
grant execute on function public.mark_cms_invoice_paid(uuid, date, text, text) to authenticated;

create table if not exists public.cms_change_audit (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_role text,
  old_data jsonb,
  new_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists cms_change_audit_record_idx
  on public.cms_change_audit(table_name, record_id, changed_at desc);
create index if not exists cms_change_audit_actor_idx
  on public.cms_change_audit(changed_by, changed_at desc);

alter table public.cms_change_audit enable row level security;
revoke all on public.cms_change_audit from anon, authenticated;
grant select on public.cms_change_audit to authenticated;

drop policy if exists "CEO can read CMS change audit" on public.cms_change_audit;
create policy "CEO can read CMS change audit"
  on public.cms_change_audit for select to authenticated
  using (public.has_cms_role(array['CEO']));

create or replace function public.audit_cms_feature_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  target_row jsonb;
  actor_role text;
begin
  if tg_op <> 'INSERT' then
    old_row := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_row := to_jsonb(new);
  end if;
  target_row := coalesce(new_row, old_row);

  select role into actor_role
  from public.cms_user_roles
  where user_id = auth.uid();

  insert into public.cms_change_audit (
    table_name,
    record_id,
    action,
    changed_by,
    changed_by_role,
    old_data,
    new_data
  )
  values (
    tg_table_name,
    coalesce(target_row ->> 'id', target_row ->> 'quote_id', 'unknown'),
    tg_op,
    auth.uid(),
    actor_role,
    old_row,
    new_row
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_cms_feature_changes() from public, anon, authenticated;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'cms_website_settings',
    'cms_document_settings',
    'cms_projects',
    'cms_financial_transactions',
    'cms_proposals',
    'cms_invoices',
    'cms_receipts',
    'quote_requests'
  ]
  loop
    execute format('drop trigger if exists audit_cms_feature_changes on public.%I', target_table);
    execute format(
      'create trigger audit_cms_feature_changes after insert or update or delete on public.%I for each row execute function public.audit_cms_feature_changes()',
      target_table
    );
  end loop;
end;
$$;
