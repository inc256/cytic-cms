# CYTIC Landing Website: Supabase Setup

This guide connects a public landing website to the content managed in the
CYTIC CMS. It covers the current Supabase project, required SQL, public content
queries, images and blog publishing, quote submissions, and the brand styling
to preserve.

The CMS and landing website use the same Supabase project. The CMS is the
editor; the landing website is a public, read-only consumer of published
content, except that visitors may submit quote requests.

## 1. Supabase project and browser credentials

The configured project reference is `skdjvphgczemfksypzwo`; its project URL is:

```text
https://skdjvphgczemfksypzwo.supabase.co
```

Use the project's **anon / publishable key** in the public website. It is
designed to be included in browser code; Row Level Security (RLS) is what limits
its access. Copy the current key from Supabase Dashboard → Project Settings →
API Keys, or use the anon key already supplied for this project. The key is
intentionally not repeated in this tracked README; keep its value in your
local/deployment environment configuration. Do not copy a `service_role` or
secret key into the browser, source code, README, or any
`VITE_`/`NEXT_PUBLIC_` variable.

For a Vite landing site, create a local `.env.local` file in that site's root:

```dotenv
VITE_SUPABASE_URL=https://skdjvphgczemfksypzwo.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=paste-the-project-publishable-key-here
```

Keep `.env.local` out of Git. The CMS repository already ignores `*.local`;
ensure the landing website repository does too. In deployment settings, add
the same two variables to the hosting provider's environment configuration,
then rebuild/redeploy. Vite variables are public in the shipped bundle; never
put a private key in one.

Install the browser client if the landing project does not already have it:

```sh
npm install @supabase/supabase-js
```

Create one reusable client, for example `src/lib/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
}

export const supabase = createClient(url, publishableKey);
```

If using a framework other than Vite, use that framework's public environment
variable prefix (for example, `NEXT_PUBLIC_` for Next.js) and otherwise follow
the same rule: only the anon/publishable key belongs in browser code.

## 2. Apply the database SQL

Open Supabase Dashboard → SQL Editor. Run each applicable file as a separate
script, in this order:

1. [`supabase/rbac.sql`](./supabase/rbac.sql) — shared CMS role helper,
   `quote_requests` access policies, and existing business data tables. It
   expects the project's existing `public.quote_requests` table and the
   existing quote-ID/timestamp functions and triggers described in the CMS
   setup. On a fresh project, create that base table and its required functions
   before running this migration.
2. [`supabase/website-cms.sql`](./supabase/website-cms.sql) — website services,
   portfolio, blog posts, quote configuration and website settings; RLS
   policies; public image buckets.
3. [`supabase/service-hierarchy.sql`](./supabase/service-hierarchy.sql) —
   hierarchy constraints and public visibility for parent services and their
   sub-services. Run after the CMS schema on both existing and fresh setups.
4. [`supabase/portfolio-project-url.sql`](./supabase/portfolio-project-url.sql)
   — optional for an existing schema; adds the optional portfolio project URL.
   The current `website-cms.sql` already includes the column on a new install.
5. [`supabase/self-quote-seed.sql`](./supabase/self-quote-seed.sql) — optional
   starting price and whole-week delivery ranges for matching sub-services
   that already exist. This only alters/seeds quote pricing; it does not create
   services, blog posts, or questions.

If a migration has already been successfully applied, do not rerun it just
because the landing website is being connected. The scripts are intended to
be rerunnable, but confirm their comments and your current schema before
changing a production database. Never paste the service-role key into SQL
examples or browser code.

### What the SQL exposes publicly

With RLS enabled, the anon role can read:

- Published parent services and published sub-services of published parents.
- Published portfolio projects.
- Published blog posts.
- Active quote pricing, quote questions, quote settings, and website settings.
- Public images in the `portofio-images` and `blog-images` Storage buckets.
- Inserts into `quote_requests` with `status = 'New'`.

The public role cannot read quote-request rows, edit CMS content, or upload or
delete CMS images. Those operations remain restricted to authorized CMS users.
Do not broaden these policies to make the landing site work; correct public
queries should work under the anon key.

## 3. Read website content

Use explicit column lists and handle loading, empty, and error states in the
landing site's UI. These are examples for a Vite/TypeScript app using the
client above.

### Services and sub-services

```ts
const { data, error } = await supabase
  .from("cms_website_services")
  .select("id,parent_id,name,description,sort_order")
  .eq("status", "Published")
  .order("sort_order")
  .order("name");

if (error) throw error;

const parents = (data ?? []).filter((service) => service.parent_id === null);
const childrenOf = (parentId: string) =>
  (data ?? []).filter((service) => service.parent_id === parentId);
```

Render parent services with their child services, rather than treating every
row as an unrelated category. Parent and child visibility is also checked by
the database policy.

### Portfolio

```ts
const { data: projects, error } = await supabase
  .from("cms_portfolio_projects")
  .select(
    "id,title,slug,project_url,service,year,summary,description,image_paths,featured",
  )
  .eq("status", "Published")
  .order("featured", { ascending: false })
  .order("year", { ascending: false });

if (error) throw error;
```

Each project's `image_paths` is an ordered array. Preserve that order when
rendering its gallery; the first path can be used as the card cover. Convert a
stored path to its public URL like this:

```ts
const imageUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

const projectImageUrl = imageUrl("portofio-images", projects[0].image_paths[0]);
```

`project_url` is optional. Only show a project link when it is present and is
an `http://` or `https://` URL.

## 4. Add the CMS-managed blog

The CMS Blog & Articles screen writes to `public.cms_blog_posts`. Its fields
are:

| Field | Landing-site use |
| --- | --- |
| `title` | Article heading |
| `slug` | Stable article route, for example `/blog/{slug}` |
| `category` | Optional category label/filter |
| `author` | Optional byline |
| `excerpt` | Article-card summary and metadata |
| `body` | Article text |
| `image_path` | Optional path in `blog-images` |
| `status` | `Draft`, `Scheduled`, or `Published` |
| `publish_date` | Optional date; use it to withhold future-dated posts |

Only `Published` rows are public under RLS. For the landing website, filter out
future-dated posts as well. A scheduled CMS status is **not** automatically
changed to `Published` by this schema; an editor must publish it in the CMS
(or you must add and secure a separate scheduled publishing job).

Example list query:

```ts
const today = new Date().toISOString().slice(0, 10);
const { data: posts, error } = await supabase
  .from("cms_blog_posts")
  .select(
    "id,title,slug,category,author,excerpt,body,image_path,publish_date,created_at",
  )
  .eq("status", "Published")
  .or(`publish_date.is.null,publish_date.lte.${today}`)
  .order("publish_date", { ascending: false, nullsFirst: false })
  .order("created_at", { ascending: false });

if (error) throw error;
```

Example article lookup for `/blog/:slug`:

```ts
const { data: post, error } = await supabase
  .from("cms_blog_posts")
  .select(
    "title,slug,category,author,excerpt,body,image_path,publish_date,created_at",
  )
  .eq("slug", slug)
  .eq("status", "Published")
  .or(`publish_date.is.null,publish_date.lte.${today}`)
  .maybeSingle();

if (error) throw error;
if (!post) {
  // Render the site's normal not-found page.
}
```

The cover is optional. If there is an `image_path`, display it with the public
Storage URL:

```ts
const coverUrl = post.image_path
  ? supabase.storage.from("blog-images").getPublicUrl(post.image_path).data.publicUrl
  : null;
```

If there is no cover, use a designed neutral/brand-color fallback instead of a
broken image. Provide meaningful `alt` text, reserve image aspect ratio to avoid
layout shifts, and use responsive image sizes. The bucket accepts JPEG, PNG,
WebP, and GIF up to 10 MB. CMS uploads images and stores only the object path
in `image_path`; do not expect a full URL in that column.

The CMS currently stores article `body` as text. Render it as text or use a
documented, safe Markdown renderer if the content convention is Markdown.
Do not insert article content as raw HTML.

### Blog publishing workflow

1. In the CMS, go to Website → Blog & Articles and create an article.
2. Add its title, slug, optional category/byline/excerpt, article text and
   optional cover image.
3. Save as Draft while preparing it. Drafts are not returned to anonymous
   visitors.
4. Set status to Published when ready. A Scheduled status is not auto-published
   by the current database schema.
5. The landing site fetches published posts and displays them at its blog list
   and slug-based article route.

Only CEO and CONTENT EDITOR have permission to manage blog posts and upload
website images in the CMS. Public blog reads do not require a visitor login.

## 5. Submit a quote request

The public quote form must insert into the existing `quote_requests` table.
The anon insert policy permits new rows with `status: "New"`; it does not grant
permission to read submitted rows back. Do not chain `.select()` onto this
public insert. The database generates `id`, `quote_id`, and timestamps through
the configured defaults/triggers, so do not generate or accept those values
from an untrusted browser.

Required request fields in the existing table include:

```ts
const request = {
  full_name: form.fullName,
  business_name: form.businessName,
  email: form.email,
  phone: form.phone,
  preferred_contact: form.preferredContact,
  business_stage: form.businessStage,
  industry: form.industry,
  current_website: form.currentWebsite || null,
  online_presence: form.onlinePresence || null,
  project_description: form.projectDescription,
  selected_services: form.selectedServices, // JSON-compatible value
  brand_scope: form.brandScope,
  digital_requirements: form.digitalRequirements, // JSON-compatible value
  timeline: form.timeline,
  estimated_price: form.estimatedPrice, // non-negative whole UGX
  estimated_weeks_min: form.estimatedWeeksMin, // positive integer
  estimated_weeks_max: form.estimatedWeeksMax, // >= minimum
  pricing_version: form.pricingVersion,
  status: "New",
};

const { error } = await supabase.from("quote_requests").insert(request);
if (error) throw error;
```

Validate every field in the browser for usability, but do not treat browser
validation as a security boundary. Keep status fixed to `New`, enforce the
table's week/price/status constraints, avoid collecting unnecessary personal
data, and display a clear success message only after Supabase confirms the
insert. Because anonymous clients cannot read the inserted row, don't promise
to show the generated quote ID unless a separate, carefully secured server
endpoint or RPC is built for that purpose. Add CAPTCHA/rate limiting through a
trusted server-side service if the public form attracts abuse; never solve
abuse by exposing privileged keys.

## 6. Website settings and quote configuration

The single `cms_website_settings` row stores a JSON object under `settings`.
The CMS currently uses these keys:

```ts
type WebsiteSettings = {
  public_email: string;
  phone: string;
  instagram: string;
  linkedin: string;
  show_quote: boolean;
  maintenance_mode: boolean;
};
```

Load it with:

```ts
const { data, error } = await supabase
  .from("cms_website_settings")
  .select("settings")
  .eq("id", true)
  .single();

if (error) throw error;
const settings = data.settings as WebsiteSettings;
```

The public site can use these values to render contact/social links, hide the
Self-Quote entry point when `show_quote` is false, and show its maintenance
experience when `maintenance_mode` is true. The quote settings row is separate
(`cms_quote_settings`) and contains service availability and a disclaimer.
Active prices live in `cms_quote_pricing`; public quote questions live in
`cms_quote_questions`. Read only the rows and fields needed by the quote
experience.

## 7. Keep the CYTIC visual identity

Preserve the established CYTIC brand and CMS design language while adapting
the layout for a public-facing site:

- Primary/navy brand color: `#00075d`. Use it consistently for primary
  actions, links, focus states, and selected navigation; keep text/background
  contrast accessible.
- Typography: Inter or a clean system sans-serif for body text; Poppins for
  display headings when available.
- Use a restrained neutral/off-white canvas, white or neutral content
  surfaces, fine borders, deliberate spacing, and consistent rounded corners.
- Keep buttons, cards, form controls, and focus rings consistent across the
  home, service, portfolio, blog, and quote pages.
- Build responsive layouts for mobile first; preserve image proportions and
  avoid content jumping while images load.
- Treat editorial content as the source of truth, but retain a consistent
  visual system: clear hierarchy, readable line lengths, accessible headings,
  descriptive image alt text, and visible loading/empty/error states.
- Do not display Draft content, CMS-only controls, internal user data, or
  dashboard navigation on the public website.

The CMS palette is defined in [`src/styles.css`](./src/styles.css). The public
website may have its own stylesheet, but should carry these same brand choices
and interaction patterns rather than copying the CMS dashboard layout wholesale.

## 8. Final smoke test

After applying SQL and deploying the site:

1. Confirm both public environment variables are present in the deployed build.
2. Publish one parent service and a sub-service in the CMS; verify both render
   under the correct parent.
3. Publish a portfolio project with multiple images; verify the gallery keeps
   the saved image order and optional project link behaves correctly.
4. Create a blog draft and confirm it is not publicly visible; publish it and
   verify its card, article route, and optional cover image.
5. Submit a test quote request and confirm success in the CMS without exposing
   that request to the anonymous browser.
6. In browser developer tools, confirm there are no 401/403/4xx errors caused
   by missing policies or mismatched field names.
7. Verify the production deployment contains no service-role or secret key.

If an anonymous read returns no rows, first verify the record is Published,
the correct project URL/key are deployed, and the applicable SQL migrations
have been run. If an error persists, record the exact Supabase error code,
message, and failed table/query without sharing private keys.
