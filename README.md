# Creative Studio — Setup Guide

Real-login version of Creative Studio. Next.js (App Router) + Supabase Auth, standalone with its own Supabase project. Access is enforced by the database via Row Level Security — freelancers can only ever receive their own brand's data.

## What's here

```
app/
  layout.js            fonts + shell
  globals.css          all styles (ported from the original)
  page.js              redirects to /dashboard or /login
  login/page.js        login screen (email + password)
  login/actions.js     server-side sign-in
  dashboard/page.js    loads profile + content, enforces scope
  auth/signout/route.js  logout
components/
  StudioShell.js       the app UI: role-scoped nav + live Approvals board
lib/
  supabase-browser.js  client for Client Components
  supabase-server.js   client for Server Components / routes
middleware.js          session refresh + route protection
supabase/schema.sql    tables, RLS policies, signup trigger
.env.local.example     template for your keys
```

## Setup steps (about 15 minutes)

### 1. Create a new Supabase project
At supabase.com, create a project just for Creative Studio (separate from the Command Center). Wait for it to finish provisioning.

### 2. Run the schema
In the Supabase dashboard: SQL Editor → New query. Paste the contents of `supabase/schema.sql` and run it. If it complains about length, run it one numbered SECTION at a time (this is the same truncation behavior you've hit before).

### 3. Get your keys
Settings → API. Copy the Project URL, the `anon` public key, and the `service_role` key.

### 4. Add the keys locally
Copy `.env.local.example` to `.env.local` and paste your three values in. (`.env.local` is gitignored — it will not be committed.)

### 5. Create your users
Authentication → Users → Add user (set email + a password for each):
- Alex
- CJ
- Tali

Then in SQL Editor, set each person's role/scope (replace the IDs with the real user IDs from the Users list):

```sql
update public.profiles set role='command', full_name='Alex', title='Marketing Lead'
  where id = '<alex-user-id>';
update public.profiles set role='command', full_name='CJ', title='CEO · Finance Lead'
  where id = '<cj-user-id>';
update public.profiles set role='freelance', brand_scope='Brand Three',
  full_name='Tali', title='Freelance Graphic Designer'
  where id = '<tali-user-id>';
```

### 6. Run locally to test
```
npm install
npm run dev
```
Open http://localhost:3000 — you'll hit the login screen. Sign in as each person to confirm: Alex/CJ see everything, Tali sees only Content Studio, Asset Library, and Approvals scoped to Brand Three.

### 7. Deploy to Vercel
Push this folder to a GitHub repo, import it in Vercel, and add the three environment variables (the same ones from `.env.local`) under Project → Settings → Environment Variables. Deploy.

## Notes
- **The scoping is real now.** Unlike the demo switcher, Tali's data restriction is enforced by Postgres RLS, not by hiding nav items. Even a crafted request can't pull other brands' rows.
- **Brand scope** for Tali is set to "Brand Three" — change `brand_scope` in her profile row to her actual assigned brand.
- The Approvals board reads live from the `content_items` table. Brand House, Publishing, Analytics, Campaigns, and Asset Library are stubs ready for the next build.
- I can't create the Supabase project, run the SQL, or enter your keys for you — those steps use your own credentials and are yours to do. Everything that goes into the repo is here and builds cleanly.
