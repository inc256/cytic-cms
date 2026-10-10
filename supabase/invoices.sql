-- INVOICES MIGRATION
-- Run after supabase/rbac.sql. This creates a standalone invoice ledger.
-- Marking an invoice paid records one linked income transaction, which in turn
-- receives the existing automatic receipt number.

create sequence if not exists public.cms_invoice_reference_seq;

create table if not exists public.cms_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  client text not null check (length(btrim(client)) > 0),
  client_email text,
  project_id uuid references public.cms_projects(id) on delete set null,
  issue_date date not null default current_date,
  due_date date not null,
  line_items jsonb not null check (
    case
      when jsonb_typeof(line_items) = 'array' then jsonb_array_length(line_items) > 0
      else false
    end
  ),
  total bigint not null check (total > 0),
  notes text not null default '',
  status text not null default 'Draft'
    check (status in ('Draft', 'Sent', 'Paid')),
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= issue_date),
  check ((status = 'Paid') = (paid_at is not null))
);

alter table public.cms_financial_transactions
  add column if not exists invoice_id uuid
  references public.cms_invoices(id) on delete restrict;

create unique index if not exists cms_financial_transactions_invoice_uidx
  on public.cms_financial_transactions(invoice_id)
  where invoice_id is not null;

create index if not exists cms_invoices_status_due_idx
  on public.cms_invoices(status, due_date);
create index if not exists cms_invoices_created_idx
  on public.cms_invoices(created_at desc);

alter table public.cms_invoices enable row level security;
revoke all on public.cms_invoices from anon, authenticated;
grant select, insert on public.cms_invoices to authenticated;

drop policy if exists "Finance roles can read invoices" on public.cms_invoices;
create policy "Finance roles can read invoices"
  on public.cms_invoices for select to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE']));

drop policy if exists "Finance roles can create draft invoices" on public.cms_invoices;
create policy "Finance roles can create draft invoices"
  on public.cms_invoices for insert to authenticated
  with check (
    public.has_cms_role(array['CEO', 'FINANCE'])
    and status = 'Draft'
    and paid_at is null
  );

create or replace function public.assign_cms_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := 'INV-' || to_char(current_date, 'YYYY') || '-' ||
      lpad(nextval('public.cms_invoice_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

revoke all on function public.assign_cms_invoice_number() from public, anon, authenticated;
drop trigger if exists assign_cms_invoice_number on public.cms_invoices;
create trigger assign_cms_invoice_number
  before insert on public.cms_invoices
  for each row execute function public.assign_cms_invoice_number();

create or replace function public.touch_cms_invoice_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_cms_invoice_updated_at() from public, anon, authenticated;
drop trigger if exists touch_cms_invoice_updated_at on public.cms_invoices;
create trigger touch_cms_invoice_updated_at
  before update on public.cms_invoices
  for each row execute function public.touch_cms_invoice_updated_at();

create or replace function public.issue_cms_invoice(invoice_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_cms_role(array['CEO', 'FINANCE']) then
    raise exception 'Only CEO or FINANCE can issue invoices'
      using errcode = '42501';
  end if;

  update public.cms_invoices
  set status = 'Sent'
  where id = invoice_uuid
    and status = 'Draft';

  if not found then
    raise exception 'Invoice was not found or is no longer a draft'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.issue_cms_invoice(uuid) from public, anon;
grant execute on function public.issue_cms_invoice(uuid) to authenticated;

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
  transaction_row public.cms_financial_transactions%rowtype;
  project_service text;
begin
  if not public.has_cms_role(array['CEO', 'FINANCE']) then
    raise exception 'Only CEO or FINANCE can clear invoices as paid'
      using errcode = '42501';
  end if;

  if paid_date is null or nullif(btrim(payment_method), '') is null then
    raise exception 'Payment date and method are required'
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

  if invoice_row.project_id is not null then
    select service_category into project_service
    from public.cms_projects
    where id = invoice_row.project_id;
  end if;

  insert into public.cms_financial_transactions (
    transaction_type,
    transaction_date,
    party,
    project_id,
    service_category,
    description,
    amount,
    method,
    payment_reference,
    invoice_id
  )
  values (
    'income',
    paid_date,
    invoice_row.client,
    invoice_row.project_id,
    project_service,
    'Payment for invoice ' || invoice_row.invoice_number,
    invoice_row.total,
    btrim(payment_method),
    nullif(btrim(payment_ref), ''),
    invoice_row.id
  )
  returning * into transaction_row;

  update public.cms_invoices
  set status = 'Paid',
      paid_at = now()
  where id = invoice_row.id;

  return query select transaction_row.receipt_number, transaction_row.transaction_ref;
end;
$$;

revoke all on function public.mark_cms_invoice_paid(uuid, date, text, text) from public, anon;
grant execute on function public.mark_cms_invoice_paid(uuid, date, text, text) to authenticated;
