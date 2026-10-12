-- Run after rbac.sql, website-cms.sql, and invoices.sql.
-- Consolidates permissions and integrity behavior for business analytics record management.

drop policy if exists "Analytics roles can read service categories" on public.cms_website_services;
create policy "Analytics roles can read service categories"
  on public.cms_website_services for select to authenticated
  using (public.has_cms_role(array['CEO', 'INVESTOR', 'PARTNER', 'FINANCE', 'SECRETARY']));

drop policy if exists "CEO, partners and secretaries can read quote requests" on public.quote_requests;
drop policy if exists "CEO, content editors can read quote requests" on public.quote_requests;
drop policy if exists "Authorized staff can read quote requests" on public.quote_requests;
create policy "Authorized staff can read quote requests"
  on public.quote_requests for select to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR', 'PARTNER', 'SECRETARY']));

drop policy if exists "CEO, partners and secretaries can update quote requests" on public.quote_requests;
drop policy if exists "CEO, content editors can update quote requests" on public.quote_requests;
drop policy if exists "Authorized staff can update quote requests" on public.quote_requests;
create policy "Authorized staff can update quote requests"
  on public.quote_requests for update to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR', 'PARTNER', 'SECRETARY']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR', 'PARTNER', 'SECRETARY']));

drop policy if exists "Authorized staff can delete quote requests" on public.quote_requests;
create policy "Authorized staff can delete quote requests"
  on public.quote_requests for delete to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR', 'PARTNER', 'SECRETARY']));

grant select, update, delete on public.quote_requests to authenticated;

grant update (client, client_email, project_id, issue_date, due_date, line_items, total, notes)
  on public.cms_invoices to authenticated;

drop policy if exists "Finance roles can edit invoices" on public.cms_invoices;
create policy "Finance roles can edit invoices"
  on public.cms_invoices for update to authenticated
  using (public.has_cms_role(array['CEO', 'FINANCE']))
  with check (
    public.has_cms_role(array['CEO', 'FINANCE'])
    and ((status = 'Paid') = (paid_at is not null))
  );

create or replace function public.sync_cms_paid_invoice_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_service text;
begin
  if old.status = 'Paid' and new.status = 'Paid' then
    if new.project_id is not null then
      select service_category into project_service
      from public.cms_projects
      where id = new.project_id;
    end if;

    update public.cms_financial_transactions
    set party = new.client,
        project_id = new.project_id,
        service_category = project_service,
        description = 'Payment for invoice ' || new.invoice_number,
        amount = new.total
    where invoice_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_cms_paid_invoice_transaction() from public, anon, authenticated;
drop trigger if exists sync_cms_paid_invoice_transaction on public.cms_invoices;
create trigger sync_cms_paid_invoice_transaction
  after update of client, project_id, total on public.cms_invoices
  for each row execute function public.sync_cms_paid_invoice_transaction();

create or replace function public.delete_cms_invoice(invoice_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_cms_role(array['CEO', 'FINANCE']) then
    raise exception 'Only CEO or FINANCE can delete invoices'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.cms_invoices where id = invoice_uuid
  ) then
    raise exception 'Invoice not found'
      using errcode = 'P0002';
  end if;

  delete from public.cms_financial_transactions
  where invoice_id = invoice_uuid;

  delete from public.cms_invoices
  where id = invoice_uuid;
end;
$$;

revoke all on function public.delete_cms_invoice(uuid) from public, anon;
grant execute on function public.delete_cms_invoice(uuid) to authenticated;
