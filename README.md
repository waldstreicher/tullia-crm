# Tuli CRM

Internal patient lead management system for Tuli body contouring. Built with Next.js 14, TypeScript, Tailwind CSS, and Supabase (with Supabase Auth for multi-user login).

---

## 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `/lib/supabase-schema.sql`
3. This creates the `leads` and `lead_notes` tables with all required indexes and triggers

---

## 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**For Vercel deployment**, add these same variables in your Vercel project settings under **Settings > Environment Variables**.

> The service role key is only used in server-side API routes and is never exposed to the browser.

---

## 3. Authentication & Users (Supabase Auth)

Login is handled by **Supabase Auth** with email + password. There is no shared
password — each team member has their own account, and their name is attributed
to the notes they add.

**Enable email/password login**

1. In Supabase, go to **Authentication → Providers → Email** and make sure it is enabled.
2. Under **Authentication → Sign In / Providers** (or **Settings**), turn **OFF**
   "Allow new users to sign up" so only administrators can create accounts. (This
   app has no public sign-up page by design.)
3. Optional but recommended: turn off "Confirm email" for internal accounts so
   admin-created users can log in immediately.

**Add a team member**

1. Go to **Authentication → Users → Add user**.
2. Enter their email and a password (or send an invite).
3. To show a friendly name instead of their email in the CRM, set a
   **`full_name`** value in the user's **User Metadata**. If none is set, the
   app falls back to the email address.

**Sessions** are managed by Supabase (JWT stored in secure cookies) and are
refreshed automatically by the middleware. To sign out, use the **Log Out**
button in the sidebar.

> Security note: the previous version used a single shared password stored in
> `NEXT_PUBLIC_CRM_PASSWORD` plus a `crm_auth=true` cookie. That approach has been
> removed — the password was shipped to the browser and the cookie could be
> forged. Supabase Auth replaces it entirely, so `NEXT_PUBLIC_CRM_PASSWORD` is no
> longer used.

---

## 4. Local Development

```bash
npm run dev
```

Opens at `http://localhost:3001`

Create at least one user in Supabase (step 3) before signing in.

---

## 5. Deploying to Vercel

1. Push this repo to GitHub
2. Import into Vercel
3. Add the 3 environment variables
4. Deploy — it will run on port 3001 in dev, standard port in production

---

## 6. Connecting the Tuli Website (lead intake)

The CRM exposes a **public** intake endpoint at `/api/intake`. The Tuli website's
consultation form should POST to it so new consultation requests appear
automatically as leads.

> **Current status:** As of this writing, the live consult form at
> `tumescentlipolysis.com/#consult` shows a success message but does **not**
> transmit the submission anywhere — it has no network call wired up. Until the
> website's form is updated to POST to this endpoint (below), no leads will flow
> into the CRM. The CRM side is ready and its CORS already allows the Tuli domain.

Add this to the website's consultation form submit handler (the field names on
the form already match the payload below):

```typescript
// In the consultation form's submit handler, after validating the fields:
try {
  await fetch('https://tullia-crm.vercel.app/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      preferred_contact: formData.preferredContact, // 'phone' | 'email'
      areas_of_interest: formData.areas,            // string[]
      message: formData.message,
    }),
  })
} catch {
  // Non-blocking — don't fail the form if the CRM is unreachable
}
```

`first_name`, `last_name`, and `email` are required; everything else is optional.

CORS is configured (in `app/api/intake/route.ts`) to allow requests from, among
others:
- `https://tumescentlipolysis.com` and `https://www.tumescentlipolysis.com`
- `https://tulliaprocedure.com` and `https://www.tulliaprocedure.com`
- All `*.vercel.app` domains (for preview deployments)

---

## Architecture

```
app/
  page.tsx              → Dashboard with stats + lead table
  login/page.tsx        → Supabase Auth email/password login
  leads/
    page.tsx            → All leads list
    new/page.tsx        → Create new lead
    [id]/page.tsx       → Lead detail + notes timeline
  api/
    auth/route.ts       → Deprecated (returns 410); auth is via Supabase now
    leads/route.ts      → GET all leads, POST create lead
    leads/[id]/route.ts → GET, PATCH, DELETE single lead
    leads/[id]/notes/   → GET all notes, POST create note
    intake/route.ts     → Public endpoint for website form submissions

components/
  AppLayout.tsx         → Sidebar + main content wrapper
  Sidebar.tsx           → Navigation, activity badges, current user + logout
  LeadTable.tsx         → Sortable, filterable lead list

lib/
  types.ts              → TypeScript types + STAGE_CONFIG constants
  supabase.ts           → Server clients (service role + session-aware)
  supabase-browser.ts   → Browser client with auth (Client Components)
  supabase-middleware.ts→ Session refresh + route protection for middleware
  supabase-schema.sql   → Database schema
```
