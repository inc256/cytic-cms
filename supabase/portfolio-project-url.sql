-- OPTIONAL PORTFOLIO PROJECT URL MIGRATION
-- Run after supabase/website-cms.sql for an existing Website CMS database.
-- Project URLs may be omitted; supplied URLs must use http:// or https://.

alter table public.cms_portfolio_projects
  add column if not exists project_url text;

alter table public.cms_portfolio_projects
  drop constraint if exists cms_portfolio_projects_project_url_check;

alter table public.cms_portfolio_projects
  add constraint cms_portfolio_projects_project_url_check
  check (
    project_url is null
    or project_url ~* '^https?://[^[:space:]]+$'
  );
