-- Employee signature support for team profiles and issued documents.
-- Run after supabase/document-details-settings.sql and supabase/user-management.sql.

do $$
begin
  if to_regclass('public.cms_team_profiles') is null then
    raise exception 'Install the Team migration first; public.cms_team_profiles is required.';
  end if;
  if to_regclass('public.cms_invoices') is null
    or to_regclass('public.cms_proposals') is null
    or to_regclass('public.cms_receipts') is null then
    raise exception 'Install supabase/document-details-settings.sql first.';
  end if;
  if to_regprocedure('public.has_cms_role(text[])') is null then
    raise exception 'Install supabase/rbac.sql first; public.has_cms_role(text[]) is required.';
  end if;
end;
$$;

alter table public.cms_team_profiles
  add column if not exists digital_signature_path text;

alter table public.cms_invoices
  add column if not exists digital_signature_user_id uuid,
  add column if not exists digital_signature_name text;

alter table public.cms_proposals
  add column if not exists digital_signature_user_id uuid,
  add column if not exists digital_signature_name text;

alter table public.cms_receipts
  add column if not exists digital_signature_path text,
  add column if not exists digital_signature_user_id uuid,
  add column if not exists digital_signature_name text;

create or replace function public.get_cms_document_signatories()
returns table (
  user_id uuid,
  full_name text,
  job_title text,
  digital_signature_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.user_id, profiles.full_name, profiles.job_title, profiles.digital_signature_path
  from public.cms_team_profiles as profiles
  where profiles.employment_status = 'Active'
    and profiles.digital_signature_path is not null
    and public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY'])
  order by profiles.full_name;
$$;

revoke all on function public.get_cms_document_signatories() from public, anon;
grant execute on function public.get_cms_document_signatories() to authenticated;
