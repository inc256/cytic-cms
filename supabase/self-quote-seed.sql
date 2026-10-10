-- SELF-QUOTE PRICE AND DELIVERY CONFIGURATION ONLY
-- Run after supabase/website-cms.sql and supabase/service-hierarchy.sql.
-- This migration does not create or modify website services, portfolio/blog
-- content, workspace/team data, quote questions, availability, or disclaimers.
-- It configures a starting price and delivery range for matching existing
-- sub-services only. Rerunning it updates these seeded pricing rows.

alter table public.cms_quote_pricing
  add column if not exists estimated_weeks_min integer not null default 1;

alter table public.cms_quote_pricing
  add column if not exists estimated_weeks_max integer not null default 2;

alter table public.cms_quote_pricing
  drop constraint if exists cms_quote_pricing_estimated_weeks_check;

alter table public.cms_quote_pricing
  add constraint cms_quote_pricing_estimated_weeks_check
  check (
    estimated_weeks_min > 0
    and estimated_weeks_max >= estimated_weeks_min
  );

with price_seed (
  service_key,
  parent_name,
  subservice_name,
  starting_price,
  estimated_weeks_min,
  estimated_weeks_max,
  sort_order
) as (
  values
    ('business-websites', 'Digital Products', 'Business Websites', 1200000, 3, 12, 10),
    ('e-commerce-websites', 'Digital Products', 'E-commerce Websites', 2000000, 3, 12, 20),
    ('web-applications', 'Digital Products', 'Web Applications', 1000000, 3, 12, 30),
    ('mobile-applications', 'Digital Products', 'Mobile Applications', 1000000, 3, 12, 40),
    ('custom-digital-products', 'Digital Products', 'Custom Digital Products', 3000000, 3, 12, 50),
    ('logo-design', 'Brand Identity', 'Logo Design', 100000, 1, 2, 110),
    ('campaign-design', 'Brand Identity', 'Campaign Design', 400000, 1, 2, 120),
    ('graphic-design', 'Brand Identity', 'Graphic Design', 50000, 1, 2, 130),
    ('website-ui-ux', 'UI/UX Design', 'Website UI/UX', 500000, 1, 4, 210),
    ('mobile-app-ui-ux', 'UI/UX Design', 'Mobile App UI/UX', 800000, 1, 4, 220),
    ('web-app-ui-ux', 'UI/UX Design', 'Web App UI/UX', 500000, 1, 4, 230),
    ('wireframes-prototypes', 'UI/UX Design', 'Wireframes & Prototypes', 600000, 1, 4, 240),
    ('promotional-wear', 'Merchandise Branding', 'Promotional Wear', 30000, 1, 2, 310),
    ('packaging-product-labels', 'Merchandise Branding', 'Packaging & Product Labels', 50000, 1, 2, 320)
),
matched as (
  select
    price_seed.service_key,
    parent.name as service_name,
    child.name as item_name,
    price_seed.starting_price,
    price_seed.estimated_weeks_min,
    price_seed.estimated_weeks_max,
    price_seed.sort_order
  from price_seed
  join public.cms_website_services as parent
    on parent.parent_id is null
    and lower(btrim(parent.name)) in (
      lower(btrim(price_seed.parent_name)),
      case
        when price_seed.parent_name = 'Brand Identity'
          then lower('Brand Identity & Logo Design')
        else lower(btrim(price_seed.parent_name))
      end
    )
  join public.cms_website_services as child
    on child.parent_id = parent.id
    and lower(btrim(child.name)) in (
      lower(btrim(price_seed.subservice_name)),
      case
        when price_seed.subservice_name = 'Promotional Wear' then lower('Promotion Ware')
        when price_seed.subservice_name = 'E-Commerce Websites' then lower('E-commerce Websites')
        else lower(btrim(price_seed.subservice_name))
      end
    )
)
insert into public.cms_quote_pricing (
  id,
  service,
  item,
  unit,
  base_price,
  active,
  sort_order,
  estimated_weeks_min,
  estimated_weeks_max
)
select
  md5('cytic-self-quote-price-v1:' || service_key)::uuid,
  service_name,
  item_name,
  'project',
  starting_price,
  true,
  sort_order,
  estimated_weeks_min,
  estimated_weeks_max
from matched
on conflict (id) do update
set service = excluded.service,
    item = excluded.item,
    unit = excluded.unit,
    base_price = excluded.base_price,
    active = excluded.active,
    sort_order = excluded.sort_order,
    estimated_weeks_min = excluded.estimated_weeks_min,
    estimated_weeks_max = excluded.estimated_weeks_max;

-- Report how many existing sub-services received quote pricing.
select
  count(*) as configured_subservices,
  (select count(*) from public.cms_website_services where parent_id is not null)
    as existing_subservices
from public.cms_quote_pricing
where id in (
  md5('cytic-self-quote-price-v1:business-websites')::uuid,
  md5('cytic-self-quote-price-v1:e-commerce-websites')::uuid,
  md5('cytic-self-quote-price-v1:web-applications')::uuid,
  md5('cytic-self-quote-price-v1:mobile-applications')::uuid,
  md5('cytic-self-quote-price-v1:custom-digital-products')::uuid,
  md5('cytic-self-quote-price-v1:logo-design')::uuid,
  md5('cytic-self-quote-price-v1:campaign-design')::uuid,
  md5('cytic-self-quote-price-v1:graphic-design')::uuid,
  md5('cytic-self-quote-price-v1:website-ui-ux')::uuid,
  md5('cytic-self-quote-price-v1:mobile-app-ui-ux')::uuid,
  md5('cytic-self-quote-price-v1:web-app-ui-ux')::uuid,
  md5('cytic-self-quote-price-v1:wireframes-prototypes')::uuid,
  md5('cytic-self-quote-price-v1:promotional-wear')::uuid,
  md5('cytic-self-quote-price-v1:packaging-product-labels')::uuid
);
