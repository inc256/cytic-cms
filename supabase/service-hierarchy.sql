-- WEBSITE SERVICE HIERARCHY MIGRATION
-- Run after supabase/website-cms.sql.
-- Converts legacy service categories into parent services and removes the
-- category column. Safe to rerun after the category column has been removed.

alter table public.cms_website_services
  add column if not exists parent_id uuid;

do $$
declare
  legacy_category text;
  parent_service_id uuid;
  parent_status text;
  has_category_column boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cms_website_services'
      and column_name = 'category'
  ) into has_category_column;

  if has_category_column then
    for legacy_category in
      execute 'select distinct coalesce(nullif(btrim(category), ''''), ''Services'') from public.cms_website_services'
    loop
      parent_service_id := (pg_catalog.md5('cms-service-category:' || legacy_category))::uuid;
      execute
        'select case when exists (select 1 from public.cms_website_services where coalesce(nullif(btrim(category), ''''), ''Services'') = $1 and status = ''Published'') then ''Published'' else ''Draft'' end'
        into parent_status
        using legacy_category;

      execute '
        insert into public.cms_website_services
          (id, name, category, parent_id, description, status, sort_order)
        values ($1, $2, $2, null, '''', $3, 0)
        on conflict (id) do nothing'
        using parent_service_id, legacy_category, parent_status;

      execute '
        update public.cms_website_services
        set parent_id = $1
        where coalesce(nullif(btrim(category), ''''), ''Services'') = $2
          and id <> $1'
        using parent_service_id, legacy_category;
    end loop;

    alter table public.cms_website_services drop column category;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_website_services_parent_id_fkey'
      and conrelid = 'public.cms_website_services'::regclass
  ) then
    alter table public.cms_website_services
      add constraint cms_website_services_parent_id_fkey
      foreign key (parent_id)
      references public.cms_website_services(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_website_services_parent_not_self_check'
      and conrelid = 'public.cms_website_services'::regclass
  ) then
    alter table public.cms_website_services
      add constraint cms_website_services_parent_not_self_check
      check (parent_id is null or parent_id <> id);
  end if;
end;
$$;

create or replace function public.validate_cms_website_service_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.parent_id is not null then
    if exists (
      select 1
      from public.cms_website_services as parent
      where parent.id = new.parent_id
        and parent.parent_id is not null
    ) then
      raise exception 'A sub-service cannot be used as a parent service'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.cms_website_services as child
      where child.parent_id = new.id
    ) then
      raise exception 'A parent service with sub-services cannot be moved under another service'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_cms_website_service_parent on public.cms_website_services;
create trigger validate_cms_website_service_parent
  before insert or update of parent_id on public.cms_website_services
  for each row execute function public.validate_cms_website_service_parent();

create or replace function public.is_published_cms_service_parent(parent_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_website_services as parent
    where parent.id = parent_service_id
      and parent.status = 'Published'
      and parent.parent_id is null
  );
$$;
revoke all on function public.is_published_cms_service_parent(uuid) from public;
grant execute on function public.is_published_cms_service_parent(uuid) to anon, authenticated;

drop policy if exists "Public can read published services" on public.cms_website_services;
create policy "Public can read published services"
  on public.cms_website_services for select to anon
  using (
    status = 'Published'
    and (
      parent_id is null
      or public.is_published_cms_service_parent(parent_id)
    )
  );
