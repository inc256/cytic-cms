-- CEO-only CMS user directory and role management.
-- Run after supabase/rbac.sql. New Auth users must be created through the
-- Supabase Dashboard; never expose a service-role key to the browser.

create or replace function public.get_cms_users()
returns table (
  user_id uuid,
  email text,
  full_name text,
  role text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_cms_role(array['CEO']) then
    raise exception 'CEO role required to list CMS users' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    coalesce(
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    r.role,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at
  from auth.users as u
  left join public.cms_user_roles as r on r.user_id = u.id
  order by u.created_at desc, u.email;
end;
$$;

revoke all on function public.get_cms_users() from public, anon;
grant execute on function public.get_cms_users() to authenticated;

create or replace function public.set_cms_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_role text;
  ceo_count bigint;
begin
  if not public.has_cms_role(array['CEO']) then
    raise exception 'CEO role required to manage CMS roles' using errcode = '42501';
  end if;

  if p_role is not null and p_role not in (
    'CEO', 'INVESTOR', 'PARTNER', 'CONTENT EDITOR', 'FINANCE', 'SECRETARY', 'DESIGNER'
  ) then
    raise exception 'Unsupported CMS role' using errcode = '22023';
  end if;

  if not exists (select 1 from auth.users as u where u.id = p_user_id) then
    raise exception 'Auth user does not exist' using errcode = 'P0002';
  end if;

  lock table public.cms_user_roles in share row exclusive mode;

  select r.role into existing_role
  from public.cms_user_roles as r
  where r.user_id = p_user_id;

  if p_user_id = (select auth.uid()) and p_role is distinct from 'CEO' then
    raise exception 'A CEO cannot change their own role' using errcode = '42501';
  end if;

  if existing_role = 'CEO' and p_role is distinct from 'CEO' then
    select count(*) into ceo_count
    from public.cms_user_roles as r
    where r.role = 'CEO';

    if ceo_count <= 1 then
      raise exception 'The last CEO role cannot be removed' using errcode = '23514';
    end if;
  end if;

  if p_role is null then
    delete from public.cms_user_roles as r where r.user_id = p_user_id;
  else
    insert into public.cms_user_roles (user_id, role)
    values (p_user_id, p_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
end;
$$;

revoke all on function public.set_cms_user_role(uuid, text) from public, anon;
grant execute on function public.set_cms_user_role(uuid, text) to authenticated;

-- Private employee profiles, linked to existing Supabase Auth accounts.
create table if not exists public.cms_team_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  job_title text not null default '',
  phone text not null default '',
  start_date date,
  employment_status text not null default 'Active'
    check (employment_status in ('Active', 'On leave', 'Inactive')),
  national_id_type text not null default '',
  national_id_number text not null default '',
  profile_image_path text,
  id_document_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cms_team_profiles_name_idx
  on public.cms_team_profiles (full_name);

alter table public.cms_team_profiles enable row level security;
revoke all on public.cms_team_profiles from anon, authenticated;
grant select, insert, update, delete on public.cms_team_profiles to authenticated;

drop policy if exists "CEO manages team profiles" on public.cms_team_profiles;
create policy "CEO manages team profiles"
  on public.cms_team_profiles
  for all
  to authenticated
  using (public.has_cms_role(array['CEO']))
  with check (public.has_cms_role(array['CEO']));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-private',
  'team-private',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "CEO manages private team files" on storage.objects;
create policy "CEO manages private team files"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'team-private'
    and public.has_cms_role(array['CEO'])
  )
  with check (
    bucket_id = 'team-private'
    and public.has_cms_role(array['CEO'])
  );
