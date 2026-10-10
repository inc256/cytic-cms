## Supabase authentication

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` for your project. The anon key is intended for browser
use; never put a service-role key in the frontend.

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

### Live business analytics

Run the complete [`supabase/rbac.sql`](./supabase/rbac.sql) script in the
Supabase SQL Editor to install the analytics tables and policies. It is safe to
rerun and creates `cms_projects`, `cms_financial_transactions`, and
`cms_business_goals`. Analytics also reads quote service/status summaries
through the `get_cms_analytics_quote_requests()` function. Log a payment or
expense in Income & Expenditure to create real financial analytics; payments
receive receipt numbers automatically. New quote requests are read from the
existing `quote_requests` table. Old demo figures are not imported as actual
financial records.

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

Recording an income payment in Income & Expenditure creates a receipt number.
Receipts & Transactions lets CEO and FINANCE record a payment, preview its
receipt, download a printable/shareable PDF, or open the PDF for printing.

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
