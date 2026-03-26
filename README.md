# Tullia CRM

Internal patient lead management system for Tullia body contouring. Built with Next.js 14, TypeScript, Tailwind CSS, and Supabase.

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
NEXT_PUBLIC_CRM_PASSWORD=tullia2025
```

**For Vercel deployment**, add these same variables in your Vercel project settings under **Settings > Environment Variables**.

> The service role key is only used in server-side API routes and is never exposed to the browser.

---

## 3. Local Development

```bash
npm run dev
```

Opens at `http://localhost:3001`

Default password: `tullia2025`

---

## 4. Deploying to Vercel

1. Push this repo to GitHub
2. Import into Vercel
3. Add all 4 environment variables
4. Deploy — it will run on port 3001 in dev, standard port in production

---

## 5. Connecting the Tullia Website

The CRM exposes a public intake endpoint at `/api/intake`. Update the Tullia website's `ConsultationForm` to POST to this endpoint after (or instead of) its existing form handler:

```typescript
// In ConsultationForm.tsx on the TCL website, after form submission:
try {
  await fetch('https://your-crm.vercel.app/api/intake', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      preferred_contact: formData.preferredContact,
      areas_of_interest: formData.areasOfInterest,
      message: formData.message,
    }),
  })
} catch {
  // Non-blocking — don't fail the form if CRM is unreachable
}
```

CORS is configured to allow requests from:
- `https://tullia.com`
- `https://www.tullia.com`
- `https://tullia-website.vercel.app`
- All `*.vercel.app` domains (for preview deployments)

---

## 6. Changing the Password

Set `NEXT_PUBLIC_CRM_PASSWORD` in your environment to any value. The default is `tullia2025`.

Sessions last 8 hours (cookie-based). To force a logout, clear cookies or wait for expiry.

---

## Architecture

```
app/
  page.tsx              → Dashboard with stats + lead table
  login/page.tsx        → Password login
  leads/
    page.tsx            → All leads list
    new/page.tsx        → Create new lead
    [id]/page.tsx       → Lead detail + notes timeline
  api/
    auth/route.ts       → Cookie auth (POST = login, DELETE = logout)
    leads/route.ts      → GET all leads, POST create lead
    leads/[id]/route.ts → GET, PATCH, DELETE single lead
    leads/[id]/notes/   → GET all notes, POST create note
    intake/route.ts     → Public endpoint for website form submissions

components/
  AppLayout.tsx         → Sidebar + main content wrapper
  Sidebar.tsx           → Navigation with badge counts
  LeadTable.tsx         → Sortable, filterable lead list

lib/
  types.ts              → TypeScript types + STAGE_CONFIG constants
  supabase.ts           → Supabase client helpers
  supabase-schema.sql   → Database schema
```
