-- DESIGNER WORKSPACE MIGRATION
-- Run after supabase/rbac.sql (and website-cms.sql if that migration is in use).
-- All workspace content is private to authenticated users. Designers may only
-- read published materials; CEO/CONTENT EDITOR manage official content.

create table if not exists public.cms_workspace_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  workspace_type text not null check (workspace_type in (
    'guideline', 'procedure', 'policy', 'checklist', 'resource', 'learning', 'notice'
  )),
  description text not null default '',
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_type, name)
);

alter table public.cms_workspace_categories
  add column if not exists updated_by uuid references auth.users(id) on delete set null default auth.uid();

create table if not exists public.cms_workspace_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_type text not null check (workspace_type in (
    'guideline', 'procedure', 'policy', 'checklist', 'learning'
  )),
  category_id uuid references public.cms_workspace_categories(id) on delete set null,
  title text not null,
  summary text not null default '',
  content text not null default '',
  objectives text[] not null default '{}',
  attachment_paths text[] not null default '{}',
  external_url text,
  status text not null default 'Draft' check (status in ('Draft', 'In review', 'Published', 'Archived')),
  version integer not null default 1 check (version > 0),
  mandatory_reading boolean not null default false,
  require_renewed_acknowledgement boolean not null default false,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_workspace_resources (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.cms_workspace_categories(id) on delete set null,
  name text not null,
  description text not null default '',
  resource_type text not null,
  preview_path text,
  file_path text,
  external_url text,
  status text not null default 'Draft' check (status in ('Draft', 'In review', 'Published', 'Archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (file_path is not null or external_url is not null)
);

create table if not exists public.cms_workspace_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  attachment_path text,
  priority text not null default 'Normal' check (priority in ('Low', 'Normal', 'High', 'Urgent')),
  published_at timestamptz,
  expires_at timestamptz,
  show_after_expiry boolean not null default false,
  pinned boolean not null default false,
  audience_roles text[] not null default array['DESIGNER']::text[],
  status text not null default 'Draft' check (status in ('Draft', 'In review', 'Published', 'Archived')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or published_at is null or expires_at >= published_at),
  check (audience_roles <@ array['CEO', 'CONTENT EDITOR', 'DESIGNER']::text[])
);

create table if not exists public.cms_workspace_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.cms_workspace_documents(id) on delete cascade,
  document_version integer not null check (document_version > 0),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  acknowledged_at timestamptz not null default now(),
  unique (document_id, document_version, user_id)
);

create table if not exists public.cms_workspace_learning_progress (
  document_id uuid not null references public.cms_workspace_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (document_id, user_id)
);

create index if not exists cms_workspace_categories_type_idx
  on public.cms_workspace_categories(workspace_type, sort_order);
create index if not exists cms_workspace_documents_listing_idx
  on public.cms_workspace_documents(workspace_type, status, updated_at desc);
create index if not exists cms_workspace_resources_listing_idx
  on public.cms_workspace_resources(status, updated_at desc);
create index if not exists cms_workspace_notices_listing_idx
  on public.cms_workspace_notices(status, pinned desc, published_at desc);
create index if not exists cms_workspace_ack_user_idx
  on public.cms_workspace_acknowledgements(user_id, acknowledged_at desc);

alter table public.cms_workspace_categories enable row level security;
alter table public.cms_workspace_documents enable row level security;
alter table public.cms_workspace_resources enable row level security;
alter table public.cms_workspace_notices enable row level security;
alter table public.cms_workspace_acknowledgements enable row level security;
alter table public.cms_workspace_learning_progress enable row level security;

revoke all on public.cms_workspace_categories, public.cms_workspace_documents,
  public.cms_workspace_resources, public.cms_workspace_notices,
  public.cms_workspace_acknowledgements, public.cms_workspace_learning_progress
  from anon, authenticated;
grant select, insert, update, delete on public.cms_workspace_categories,
  public.cms_workspace_documents, public.cms_workspace_resources,
  public.cms_workspace_notices to authenticated;
grant select, insert on public.cms_workspace_acknowledgements to authenticated;
grant select, insert, update, delete on public.cms_workspace_learning_progress to authenticated;

create or replace function public.touch_cms_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.updated_by := (select auth.uid());
    if tg_table_name = 'cms_workspace_documents'
      and (
        new.title is distinct from old.title
        or new.summary is distinct from old.summary
        or new.content is distinct from old.content
        or new.category_id is distinct from old.category_id
        or new.objectives is distinct from old.objectives
        or new.attachment_paths is distinct from old.attachment_paths
        or new.external_url is distinct from old.external_url
        or new.mandatory_reading is distinct from old.mandatory_reading
        or new.require_renewed_acknowledgement is distinct from old.require_renewed_acknowledgement
      )
    then
      new.version := old.version + 1;
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'cms_workspace_categories', 'cms_workspace_documents',
    'cms_workspace_resources', 'cms_workspace_notices'
  ]
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', target_table);
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function public.touch_cms_workspace_updated_at()',
      target_table
    );
  end loop;
end;
$$;

-- Categories are visible to content managers; designers only see categories
-- which have published content in their workspace type.
drop policy if exists "Workspace managers manage categories" on public.cms_workspace_categories;
create policy "Workspace managers manage categories"
  on public.cms_workspace_categories for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));
drop policy if exists "Designers read published categories" on public.cms_workspace_categories;
create policy "Designers read published categories"
  on public.cms_workspace_categories for select to authenticated
  using (
    public.has_cms_role(array['DESIGNER'])
    and exists (
      select 1 from public.cms_workspace_documents d
      where d.category_id = id and d.status = 'Published'
    )
  );

drop policy if exists "Workspace managers manage documents" on public.cms_workspace_documents;
create policy "Workspace managers manage documents"
  on public.cms_workspace_documents for all to authenticated
  using (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  )
  with check (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  );
drop policy if exists "Workspace managers read all documents" on public.cms_workspace_documents;
create policy "Workspace managers read all documents"
  on public.cms_workspace_documents for select to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));
drop policy if exists "Designers read published documents" on public.cms_workspace_documents;
create policy "Designers read published documents"
  on public.cms_workspace_documents for select to authenticated
  using (status = 'Published' and public.has_cms_role(array['DESIGNER']));

drop policy if exists "Workspace managers manage resources" on public.cms_workspace_resources;
create policy "Workspace managers manage resources"
  on public.cms_workspace_resources for all to authenticated
  using (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  )
  with check (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  );
drop policy if exists "Workspace managers read all resources" on public.cms_workspace_resources;
create policy "Workspace managers read all resources"
  on public.cms_workspace_resources for select to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));
drop policy if exists "Designers read published resources" on public.cms_workspace_resources;
create policy "Designers read published resources"
  on public.cms_workspace_resources for select to authenticated
  using (status = 'Published' and public.has_cms_role(array['DESIGNER']));

drop policy if exists "Workspace managers manage notices" on public.cms_workspace_notices;
create policy "Workspace managers manage notices"
  on public.cms_workspace_notices for all to authenticated
  using (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  )
  with check (
    public.has_cms_role(array['CEO'])
    or (
      public.has_cms_role(array['CONTENT EDITOR'])
      and status in ('Draft', 'In review')
    )
  );
drop policy if exists "Workspace managers read all notices" on public.cms_workspace_notices;
create policy "Workspace managers read all notices"
  on public.cms_workspace_notices for select to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));
drop policy if exists "Designers read published notices for their audience" on public.cms_workspace_notices;
create policy "Designers read published notices for their audience"
  on public.cms_workspace_notices for select to authenticated
  using (
    status = 'Published'
    and public.has_cms_role(array['DESIGNER'])
    and 'DESIGNER' = any(audience_roles)
    and (expires_at is null or expires_at >= now() or show_after_expiry)
  );

drop policy if exists "Users read own workspace acknowledgements" on public.cms_workspace_acknowledgements;
create policy "Users read own workspace acknowledgements"
  on public.cms_workspace_acknowledgements for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
  );
drop policy if exists "Designers acknowledge current mandatory documents" on public.cms_workspace_acknowledgements;
create policy "Designers acknowledge current mandatory documents"
  on public.cms_workspace_acknowledgements for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_cms_role(array['DESIGNER'])
    and exists (
      select 1 from public.cms_workspace_documents d
      where d.id = document_id
        and d.status = 'Published'
        and d.mandatory_reading
        and d.version = document_version
    )
  );

drop policy if exists "Users manage own learning progress" on public.cms_workspace_learning_progress;
create policy "Users manage own learning progress"
  on public.cms_workspace_learning_progress for all to authenticated
  using (
    user_id = (select auth.uid())
    and (
      public.has_cms_role(array['DESIGNER'])
      or exists (
        select 1 from public.cms_workspace_documents d
        where d.id = document_id and d.status = 'Published'
      )
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.cms_workspace_documents d
      where d.id = document_id and d.workspace_type = 'learning' and d.status = 'Published'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'designer-workspace',
  'designer-workspace',
  false,
  20971520,
  array[
    'application/pdf', 'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Workspace managers upload workspace files" on storage.objects;
create policy "Workspace managers upload workspace files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'designer-workspace'
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Workspace managers update workspace files" on storage.objects;
create policy "Workspace managers update workspace files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'designer-workspace'
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'designer-workspace'
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
drop policy if exists "Workspace managers delete workspace files" on storage.objects;
create policy "Workspace managers delete workspace files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'designer-workspace'
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
  );
drop policy if exists "Workspace users read published workspace files" on storage.objects;
create policy "Workspace users read published workspace files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'designer-workspace'
    and (
      public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
      or (
        public.has_cms_role(array['DESIGNER'])
        and (
          exists (
            select 1 from public.cms_workspace_documents d
            where d.status = 'Published' and name = any(d.attachment_paths)
          )
          or exists (
            select 1 from public.cms_workspace_resources r
            where r.status = 'Published' and name in (r.file_path, r.preview_path)
          )
          or exists (
            select 1 from public.cms_workspace_notices n
            where n.status = 'Published'
              and 'DESIGNER' = any(n.audience_roles)
              and (n.expires_at is null or n.expires_at >= now() or n.show_after_expiry)
              and name = n.attachment_path
          )
        )
      )
    )
  );
