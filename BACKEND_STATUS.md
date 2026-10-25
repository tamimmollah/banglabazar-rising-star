# Backend status — v2 (read this first)

## What IS implemented in code in this ZIP (v2, 2026-10-25)

- Complete English-only public website: Home, Squad, Management, Matches & Results,
  Statistics, News, Contact, footer — React + TypeScript + Vite, Dark Navy #061A23 /
  Deep Teal #00A99D / Bright Teal #00D5C0, official logo in `public/logo.png` unaltered.
- Real routes: `/`, `/squad`, `/management`, `/matches`, `/stats`, `/news`, `/contact`,
  `/admin`. Cloudflare Pages SPA fallback is in `public/_redirects` (copied to `dist/`).
- Supabase client in `src/supabaseClient.ts` using ONLY `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`. No service_role key is used anywhere in browser code.
  Data layer in `src/api.ts`; schema in `supabase/schema.sql` + `supabase/schema-v2.sql`.
- Real Supabase Auth admin login at `/admin`, with logout and an admin-role check:
  a signed-in user who is NOT in `admin_roles` is signed out with a clear error and
  cannot reach any admin table. Signed-out visitors see only the login form (or the
  setup guide when Supabase is not configured). There is no fake login anywhere.
- Full admin CRUD, guarded by RLS, for: Players (name, photo upload, jersey number,
  position, date of birth/age, nationality, captain/vice-captain, biography, optional
  appearances/goals/assists, active/inactive, published/featured), Hero Banners
  (image upload + preview before publishing, headline, subtitle, button text/URL,
  active flag, order), Matches (opponent + logo, date/time, venue, competition,
  BRS/opponent score, status Upcoming/Live/Completed, goalscorers, summary),
  News (title, category, date, excerpt, body, image, published), Management
  (name, role, portrait, biography, order, published), Social Media (Facebook,
  Instagram, YouTube, TikTok — URL + show/hide each, loaded from `club_settings`,
  never hardcoded in public components), and Club Settings/Branding (club name,
  short name, description, hero headline/subtitle, logo upload, contact email/phone,
  location, footer text).
- Image uploads go to Supabase Storage bucket `club-images` (JPG/PNG/WebP, max 5 MB,
  validated). The database stores the permanent public Storage URL — never a
  temporary browser blob URL — so banners and portraits survive reloads and other devices.
- Public site loads from Supabase when configured: published players/staff/news,
  all matches, active banners, settings. Statistics are calculated live from
  completed matches, so correcting a score updates the stats. Fixtures sort by date;
  recent results show first on the results view. Loading, empty and error states
  are shown instead of blank pages or silent failures. Delete actions ask for
  confirmation first. Search (squad + admin players) and position/result/category
  filters are included. Responsive, mobile-first layout.
- A production build was generated with `npm run build` (77 modules, dist/ included)
  and the built site was smoke-checked locally (root, /admin and /squad all serve
  the app). No live Supabase project was available during this build, so the
  live-database tests below are NOT yet passed — see the honest limits section.

## What is NOT yet proven — do not claim otherwise

1. **No live Supabase project is connected in this export.** No Supabase URL/key
   was supplied with this brief, and no credentials are stored in this ZIP.
   Until the owner runs Part B–D of `docs/DEPLOYMENT.md` with their own project,
   the deployed site runs in sample-data mode: the public site shows the clearly
   labelled sample arrays in `src/data.ts`, and `/admin` shows the setup guide
   instead of a login form. That is deliberate — it must not pretend to save.
2. **Live acceptance tests are therefore unrun against a real database:**
   admin login from an iPhone, permanent player save, public-site update after
   logout/refresh/another device, banner persistence after reload, score correction,
   social-URL change without code edits, RLS denial for a non-admin, and image
   upload to Storage. The code paths for all of them exist and the build passes,
   but they must be run once, in order, against the owner's Supabase project
   (checklist in `docs/DEPLOYMENT.md`, Part F) before the admin panel is
   described as "live and tested" for that deployment.
3. **No real club data.** Every player, staff member, fixture, score and article
   in the sample fallback is a placeholder. Do not publish it as real club data.
4. **No email sending.** The contact form prepares a copyable/downloadable draft
   only. No email backend is configured.

## What remains (owner steps, phone-friendly)

See `docs/DEPLOYMENT.md` — in short: create a Supabase project, run both SQL
files, create the admin Auth user + `admin_roles` row, set the two `VITE_`
variables in Cloudflare Pages and redeploy, then run the Part F checklist
from an iPhone. No code change is needed for those steps.

## Security notes

- Browser code uses only the anon/public key. RLS policies in the SQL files
  allow public reads of published rows only; all writes require `is_admin()`.
- Storage policies in `schema-v2.sql`: public read of `club-images`, admin-only
  insert/update/delete. Verify them in your own project before uploading
  real portraits. Never leave a bucket anonymously writable.
- The `admin_roles` table is readable only by admins, so a visitor cannot
  enumerate admin accounts through the API.
