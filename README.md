# BANGLABAZAR RISING STAR — Official Club Website

English-only, premium modern football club website (v2) for
**BANGLABAZAR RISING STAR (BRS)**.

Identity: Dark Navy `#061A23`, Deep Teal `#00A99D`, Bright Teal `#00D5C0`,
White `#FFFFFF`, Muted Gray `#A7B5BA`. Official logo: `public/logo.png`
(supplied by the club, unaltered).

## What v2 adds over v1
- Real `/admin` route with Supabase Auth login/logout and an `admin_roles`
  guard (no fake login, no local-only preview saves).
- Full CRUD for players, hero banners, matches, news, management, social
  links and club settings/branding, saved in Supabase and reflected on the
  public site immediately. Image uploads go to Supabase Storage
  (`club-images`, JPG/PNG/WebP, max 5 MB) and store permanent public URLs.
- Live match status, competition, opponent logos, goalscorers, captain /
  vice-captain, date of birth / age, active/inactive players, and social
  links loaded from settings (not hardcoded).
- See `BACKEND_STATUS.md` for what is code-complete vs. what still needs
  the owner's live Supabase project and the Part F test run before it can
  be called live-tested.

## Pages

- **Home** — hero "BUILT TO COMPETE. UNITED TO WIN.", latest result, next match,
  record counters, featured players, latest news
- **Squad** — position filters (Goalkeeper / Defender / Midfielder / Forward),
  player-profile modals, captain badge
- **Management** — Team Manager, Head Coach, Assistant Coach, Team Coordinator
- **Matches** — Upcoming / Completed / Results tabs, Win / Draw / Loss filter
- **Statistics** — calculated from recorded matches (played, W/D/L, win %,
  goals for/against, clean sheets)
- **News** — category filters and full-article reading
- **Contact** — placeholder official details + a form that prepares a draft
  (it does not send email in this export)
- **Admin** (`/admin`) — real dashboard: Overview, Players, Banners, Matches,
  News, Management, Social, Settings (login required when Supabase is configured;
  setup guide shown when it is not)

## Quick start

```bash
npm install
npm run dev      # local development
npm run build    # production build -> dist/
npm run preview  # preview the production build
```

The `dist/` folder in this ZIP is the already-built production output. You can
deploy it directly to Cloudflare Pages (Upload assets), or deploy from Git
with build command `npm run build` and output directory `dist`.

## Important: backend status

Read `BACKEND_STATUS.md` before describing this project as live-tested.
The v2 code (Auth, CRUD, Storage uploads, RLS) is implemented and the
production build passes, but **no live Supabase project was supplied with
this brief**, so the deployed site runs in labelled sample mode until the
owner completes `docs/DEPLOYMENT.md` Parts B–D and the Part F checklist.
Until then `/admin` shows the setup guide instead of a fake login, and
all players/fixtures/articles in the fallback are sample placeholders in
`src/data.ts` — replace them with real data via the admin panel once
connected. No email sending is implemented (contact form prepares a draft).

Supabase schema + RLS: `supabase/schema.sql` + `supabase/schema-v2.sql`.
Environment template: `.env.example`. Full setup: `docs/DEPLOYMENT.md`.

## Project structure

```
index.html                 Entry page, fonts, title
vite.config.ts             Vite + React build config
package.json               Scripts and dependencies
src/main.tsx               React entry point
src/App.tsx                All pages, routing, admin preview, forms
src/data.ts                Sample data + statistics calculation
src/styles.css             Design system (navy / teal)
public/logo.png            Official club crest (unaltered)
public/                    Static assets served at /
supabase/schema.sql        PostgreSQL tables + RLS policies
.env.example               Frontend environment template (anon key only)
BACKEND_STATUS.md          What works, what does not, what remains
docs/DEPLOYMENT.md         Cloudflare Pages + Supabase step-by-step guide
dist/                      Pre-built production output (from npm run build)
```

## Security notes

- Never put the Supabase `service_role` key in frontend code, in `.env` for
  the browser build, in Cloudflare frontend variables, or in git.
- The browser may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Public RLS policies allow reading published rows only; writes require an
  admin row in `admin_roles` for the authenticated user.
