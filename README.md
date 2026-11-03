## Landing website integration

For public-site Supabase credentials, migration order, services and portfolio
queries, blog setup and publishing, quote submissions, and CYTIC styling, see
[`LANDING-WEBSITE-README.md`](./LANDING-WEBSITE-README.md).

## Supabase authentication

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` for your project. Add these same variables to
Vercel and redeploy so the production build receives them. The publishable key
is intended for browser use; never put a service-role key in the frontend.

Run [`supabase/rbac.sql`](./supabase/rbac.sql) in the Supabase SQL Editor. In
Supabase Authentication settings, turn off email confirmation for the Email
provider and keep public sign-ups disabled. In Authentication > Users, choose
Add user > Create new user, enter `mubarakluutu20@gmail.com`, set a strong
password, and mark the email as confirmed. Do not put the password in this SQL
file or share it in chat. Then run the SQL script; if you ran it before
creating the Auth user, run it again now. It will assign that user the `CEO`
role. The supported roles are `CEO`, `INVESTOR`, `PARTNER`, `CONTENT EDITOR`,
`FINANCE`, `SECRETARY`, and `DESIGNER`. Users cannot assign or change their own
role.

The app checks role access in its navigation and route gate; Supabase row-level
security separately protects quote requests. CEO has full workspace access;
other roles are limited to the sections described by the Users & Permissions
page. Sign in at your CMS URL using `mubarakluutu20@gmail.com` and the password
you set when creating the Auth user.

Overview is available to CEO, FINANCE, INVESTOR, PARTNER, and SECRETARY.
Business Analytics is available to CEO, FINANCE, and SECRETARY.
Projects are managed from the Projects page in Business Analytics. Project
create, edit, status, and delete actions are available to CEO; FINANCE and
SECRETARY can review project financials.
Receipts & Transactions is in Business Analytics. Landing Page Quotes is
available there to CEO, FINANCE, PARTNER, and SECRETARY; CONTENT EDITOR handles
the same quote inbox from Website → Inquiries & Leads. General Settings is a
separate CEO-only section for shared company details and private invoice bank
details. Website Settings remains dedicated to landing-page behavior.

### Live business analytics

Run the complete [`supabase/rbac.sql`](./supabase/rbac.sql) script in the
Supabase SQL Editor to install the analytics tables and policies. It is safe to
rerun and creates `cms_projects`, `cms_financial_transactions`, and
`cms_business_goals`. Analytics also reads quote service/status summaries
through the `get_cms_analytics_quote_requests()` function. Log a payment or
expense in Income & Expenditure to create real financial analytics. New quote
requests are read from the existing `quote_requests` table. Old demo figures
are not imported as actual financial records.

### Invoices

Run [`supabase/invoices.sql`](./supabase/invoices.sql) after
[`supabase/rbac.sql`](./supabase/rbac.sql). The Invoices screen is available to
CEO and FINANCE. Create a draft with line items, issue it to the client, then
mark its status paid after payment is received. This does not issue a receipt
or create an income transaction; handle both independently. This workflow
supports full payment only; partial payments are not supported.

Quotations are available under Business Analytics. They can be
created and previewed without creating or linking a project. Invoice and
quotation creation both provide a document preview before saving. Client
address, telephone, and email are optional. A PNG signature can be uploaded in
General Settings and optionally included on each quotation or invoice; without
it, each document provides a handwritten signature line. Quotation references
use the `QTN-` prefix. Document previews and generated PDFs use A4 portrait
format; quotations, invoices, and receipts can be printed or saved as PDF.
Overview and Business Performance include quotation pipeline and acceptance
analysis, separate from recorded income.
Quotation and invoice forms support optional Notes and Terms & Conditions;
receipts support optional Notes. Document styling follows the A4 navy-header,
ruled-table, and highlighted-notes design.

Receipts are issued independently from income. They include the client name,
paid-for project or description, amount in numbers and words, remaining
balance, and CYTIC contact details. Issuing a receipt does not create an
income entry; enter that separately in Income & Expenditure.

For an existing database, run
[`supabase/document-details-settings.sql`](./supabase/document-details-settings.sql)
after [`supabase/rbac.sql`](./supabase/rbac.sql),
[`supabase/website-cms.sql`](./supabase/website-cms.sql), and
[`supabase/invoices.sql`](./supabase/invoices.sql). This idempotent upgrade
moves bank details out of publicly readable website settings, adds optional
client/document fields, notes and terms, and signature references, creates the independent receipt table
and private `cytic_digital_signatures` storage bucket, migrates legacy
income-linked receipts, and updates invoice payment behavior. It also records
before/after changes to settings, projects, financial transactions,
quotations, invoices, receipts, and quote requests in a CEO-readable audit
table. In General Settings, set shared company details, private invoice bank
details, and the optional PNG signature. Matching social usernames are grouped
into one line on quotations and invoices.

To add employee signatures, run
[`supabase/team-document-signatures.sql`](./supabase/team-document-signatures.sql)
after the Team migration and `supabase/document-details-settings.sql`. Team
profiles can then store a private PNG signature, and invoice, quotation, and
receipt forms can choose a signatory or leave a physical signature line.
Existing company signatures remain available as a signatory option.

Supabase Auth persists the user's browser session and refreshes its token
automatically. Signing out or clearing browser storage ends that session.

### Users & Permissions

Run [`supabase/user-management.sql`](./supabase/user-management.sql) separately
after `supabase/rbac.sql`. It provides CEO-only, role-checked functions to list
Auth users and assign or remove CMS roles without exposing Supabase's
service-role key. It also creates the CEO-only Team directory and its private
`team-private` Storage bucket for profile photos and ID documents. Team profiles
must reference an existing Auth account. The Team screen stores names, date of
birth, position, phone, employment dates/status, and ID type/number; team profile
data and attached files are restricted to CEO accounts by RLS. Treat ID numbers
and documents as sensitive personal data and collect/store them only where
legally appropriate. Create or invite accounts in Supabase Dashboard →
Authentication → Users; then assign their CMS role from Users & Permissions
and create a profile in Team. The migration prevents a CEO from demoting their
own account or removing the last CEO role.

Receipts lets CEO and FINANCE issue a receipt independently, preview it,
download a printable/shareable PDF, or open it for printing. Add the income
separately in Income & Expenditure.

### Website CMS data

Run [`supabase/website-cms.sql`](./supabase/website-cms.sql) separately, after
`supabase/rbac.sql`, in the Supabase SQL Editor. This distinct migration creates
the live service, portfolio, blog, proposals, quote-pricing, quote-question,
and website-settings tables plus the `portofio-images` and `blog-images`
Storage buckets. Website CMS access is limited to CEO and CONTENT EDITOR.
Portfolio entries require at least one uploaded image; blog cover images are
optional. No demo content is imported. The public website must read the
published rows and public Storage URLs from these Supabase resources to display
the content managed here.

After `supabase/service-hierarchy.sql`, run
[`supabase/self-quote-seed.sql`](./supabase/self-quote-seed.sql) to set starting
prices and estimated delivery ranges for matching sub-services that already
exist. It does not create services, questions, availability settings, or other
quote content; unmatched sub-services are skipped. It is safe to rerun. In
Self-Quote & Pricing, assign a starting price and delivery range by selecting
an existing parent service and one of its sub-services; arbitrary text labels
are no longer accepted for new pricing rules.

For an existing Website CMS database, run
[`supabase/portfolio-project-url.sql`](./supabase/portfolio-project-url.sql)
after `supabase/website-cms.sql` to add the optional live-project URL field.
The URL may be left blank; if supplied, it must use `http://` or `https://`.
The portfolio section is named simply “Portfolio”.

For an existing Website CMS database, run
[`supabase/service-hierarchy.sql`](./supabase/service-hierarchy.sql) after
`supabase/website-cms.sql`. It migrates the old service category values into
parent services, preserves the existing services as their sub-services, and
drops the old service `category` column. For a new setup, the website migration
already creates the hierarchical service relationship; run the hierarchy
migration afterward to install its hierarchy validation and public visibility
rules. The Services screen now supports top-level services and one level of
sub-services (for example, Digital Products → Web Development and Android App
Development); deleting a parent removes its sub-services.

### Designer Workspace

Run [`supabase/designer-workspace.sql`](./supabase/designer-workspace.sql)
separately after `supabase/rbac.sql`. It creates the private Designer Workspace
content tables, versioned reading acknowledgements, optional learning progress,
and the private `designer-workspace` Storage bucket. CEO and CONTENT EDITOR
manage workspace content; CEO alone can publish or archive it. DESIGNER accounts
can read published materials, download files attached to published content,
acknowledge required document versions, and track their learning progress.
Uploaded files are private and are made available only through short-lived
signed URLs after the user's role and content access pass RLS checks.

Palette Creator is a browser-only tool within Designer Workspace. Its palette
state is stored in the current browser's local storage and is not written to
Supabase or visible to other CMS users.
