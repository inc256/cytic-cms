-- WEBSITE CMS MIGRATION (separate from supabase/rbac.sql)
-- Run supabase/rbac.sql first, then run this file in the Supabase SQL Editor.
-- Creates persistent Website CMS data and the two public image buckets:
-- "portofio-images" (spelling kept as requested) and "blog-images".

create sequence if not exists public.cms_proposal_reference_seq;
grant usage, select on sequence public.cms_proposal_reference_seq to authenticated;

create table if not exists public.cms_website_services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text not null default '',
  status text not null default 'Draft' check (status in ('Draft', 'Published')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  service text not null,
  year integer not null check (year between 1900 and 2200),
  summary text not null default '',
  description text not null default '',
  image_paths text[] not null,
  featured boolean not null default false,
  status text not null default 'Draft' check (status in ('Draft', 'In review', 'Published')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(image_paths) > 0)
);

create table if not exists public.cms_blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  category text not null default '',
  author text not null default '',
  excerpt text not null default '',
  body text not null default '',
  image_path text,
  status text not null default 'Draft' check (status in ('Draft', 'Scheduled', 'Published')),
  publish_date date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_proposals (
  id uuid primary key default gen_random_uuid(),
  proposal_code text not null unique default
    ('PRP-' || lpad(nextval('public.cms_proposal_reference_seq')::text, 5, '0')),
  quote_id text,
  client text not null,
  title text not null,
  line_items jsonb not null default '[]'::jsonb,
  value bigint not null default 0 check (value >= 0),
  status text not null default 'Draft' check (status in ('Draft', 'Sent', 'Accepted', 'Declined')),
  valid_until date,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_quote_pricing (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  item text not null,
  unit text not null,
  base_price bigint not null check (base_price >= 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_quote_questions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  applies_to text not null,
  input_type text not null default 'text',
  pricing_rule text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_quote_settings (
  id boolean primary key default true check (id),
  service_availability jsonb not null default '{}'::jsonb,
  disclaimer text not null default
    'This Self-Quote is an initial estimate only. It is not a final quotation, invoice, contract or binding commercial offer. A detailed proposal will follow a review of your requirements.',
  updated_at timestamptz not null default now()
);

insert into public.cms_quote_settings (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.cms_website_settings (
  id boolean primary key default true check (id),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.cms_website_settings (id)
values (true)
on conflict (id) do nothing;

create index if not exists cms_services_sort_idx on public.cms_website_services(sort_order, name);
create index if not exists cms_portfolio_published_idx on public.cms_portfolio_projects(status, featured);
create index if not exists cms_blog_published_idx on public.cms_blog_posts(status, publish_date desc);
create index if not exists cms_proposals_updated_idx on public.cms_proposals(updated_at desc);
create index if not exists cms_quote_pricing_sort_idx on public.cms_quote_pricing(sort_order, service);
create index if not exists cms_quote_questions_sort_idx on public.cms_quote_questions(sort_order);

alter table public.cms_website_services enable row level security;
alter table public.cms_portfolio_projects enable row level security;
alter table public.cms_blog_posts enable row level security;
alter table public.cms_proposals enable row level security;
alter table public.cms_quote_pricing enable row level security;
alter table public.cms_quote_questions enable row level security;
alter table public.cms_quote_settings enable row level security;
alter table public.cms_website_settings enable row level security;

revoke all on public.cms_website_services, public.cms_portfolio_projects, public.cms_blog_posts,
  public.cms_proposals, public.cms_quote_pricing, public.cms_quote_questions,
  public.cms_quote_settings, public.cms_website_settings from anon, authenticated;
grant select, insert, update, delete on public.cms_website_services, public.cms_portfolio_projects,
  public.cms_blog_posts, public.cms_proposals, public.cms_quote_pricing,
  public.cms_quote_questions, public.cms_quote_settings, public.cms_website_settings to authenticated;
grant select on public.cms_website_services, public.cms_portfolio_projects, public.cms_blog_posts,
  public.cms_quote_pricing, public.cms_quote_questions, public.cms_quote_settings,
  public.cms_website_settings to anon;

create or replace function public.touch_cms_website_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'cms_website_services', 'cms_portfolio_projects', 'cms_blog_posts',
    'cms_proposals', 'cms_quote_pricing', 'cms_quote_questions',
    'cms_quote_settings', 'cms_website_settings'
  ]
  loop
    execute format('drop trigger if exists touch_updated_at on public.%I', target_table);
    execute format(
      'create trigger touch_updated_at before update on public.%I for each row execute function public.touch_cms_website_updated_at()',
      target_table
    );
  end loop;
end;
$$;

drop policy if exists "Public can read published services" on public.cms_website_services;
create policy "Public can read published services"
  on public.cms_website_services for select to anon
  using (status = 'Published');
drop policy if exists "Public can read published portfolio" on public.cms_portfolio_projects;
create policy "Public can read published portfolio"
  on public.cms_portfolio_projects for select to anon
  using (status = 'Published');
drop policy if exists "Public can read published blog posts" on public.cms_blog_posts;
create policy "Public can read published blog posts"
  on public.cms_blog_posts for select to anon
  using (status = 'Published');
drop policy if exists "Public can read active quote pricing" on public.cms_quote_pricing;
create policy "Public can read active quote pricing"
  on public.cms_quote_pricing for select to anon
  using (active);
drop policy if exists "Public can read quote questions" on public.cms_quote_questions;
create policy "Public can read quote questions"
  on public.cms_quote_questions for select to anon
  using (true);
drop policy if exists "Public can read quote settings" on public.cms_quote_settings;
create policy "Public can read quote settings"
  on public.cms_quote_settings for select to anon
  using (true);
drop policy if exists "Public can read website settings" on public.cms_website_settings;
create policy "Public can read website settings"
  on public.cms_website_settings for select to anon
  using (true);

drop policy if exists "Website editors can manage services" on public.cms_website_services;
create policy "Website editors can manage services"
  on public.cms_website_services for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage portfolio" on public.cms_portfolio_projects;
create policy "Website editors can manage portfolio"
  on public.cms_portfolio_projects for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage blog" on public.cms_blog_posts;
create policy "Website editors can manage blog"
  on public.cms_blog_posts for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage proposals" on public.cms_proposals;
create policy "Website editors can manage proposals"
  on public.cms_proposals for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage quote pricing" on public.cms_quote_pricing;
create policy "Website editors can manage quote pricing"
  on public.cms_quote_pricing for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage quote questions" on public.cms_quote_questions;
create policy "Website editors can manage quote questions"
  on public.cms_quote_questions for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage quote settings" on public.cms_quote_settings;
create policy "Website editors can manage quote settings"
  on public.cms_quote_settings for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "Website editors can manage website settings" on public.cms_website_settings;
create policy "Website editors can manage website settings"
  on public.cms_website_settings for all to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

-- Existing quote requests remain publicly insertable; only the authorized
-- Website editors can view and update the submitted leads.
drop policy if exists "CEO, partners and secretaries can read quote requests" on public.quote_requests;
drop policy if exists "CEO, content editors can read quote requests" on public.quote_requests;
create policy "CEO, content editors can read quote requests"
  on public.quote_requests for select to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

drop policy if exists "CEO, partners and secretaries can update quote requests" on public.quote_requests;
drop policy if exists "CEO, content editors can update quote requests" on public.quote_requests;
create policy "CEO, content editors can update quote requests"
  on public.quote_requests for update to authenticated
  using (public.has_cms_role(array['CEO', 'CONTENT EDITOR']))
  with check (public.has_cms_role(array['CEO', 'CONTENT EDITOR']));

-- Keep the analytics-only quote summary within the currently authorized
-- analytics roles; it is not a way around Website lead access.
create or replace function public.get_cms_analytics_quote_requests()
returns table (quote_id text, business_name text, selected_services jsonb, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    q.quote_id,
    case
      when public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY']) then q.business_name
      else ''
    end,
    q.selected_services,
    q.status,
    q.created_at
  from public.quote_requests as q
  where public.has_cms_role(array['CEO', 'FINANCE', 'SECRETARY', 'INVESTOR', 'PARTNER'])
  order by q.created_at desc;
$$;
revoke all on function public.get_cms_analytics_quote_requests() from public;
grant execute on function public.get_cms_analytics_quote_requests() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portofio-images', 'portofio-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('blog-images', 'blog-images', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Website images are public" on storage.objects;
create policy "Website images are public"
  on storage.objects for select to public
  using (bucket_id in ('portofio-images', 'blog-images'));

drop policy if exists "Website editors can upload website images" on storage.objects;
create policy "Website editors can upload website images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('portofio-images', 'blog-images')
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Website editors can update website images" on storage.objects;
create policy "Website editors can update website images"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('portofio-images', 'blog-images')
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('portofio-images', 'blog-images')
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Website editors can delete website images" on storage.objects;
create policy "Website editors can delete website images"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('portofio-images', 'blog-images')
    and public.has_cms_role(array['CEO', 'CONTENT EDITOR'])
  );
