# Deploy to Cloudflare Pages + connect Supabase (v2)
# Phone-friendly workflow — every step can be done from a phone browser.
# No service-role key is ever used in the browser, in Cloudflare frontend
# variables, or in git. Only VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.

## Part A — Deploy the frontend to Cloudflare Pages

### Option 1: Upload the pre-built folder (fastest, no build step, phone-friendly)
1. Unzip `BANGLABAZAR_RISING_STAR.zip` on your phone/computer.
2. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Upload assets**.
3. Name the project, e.g. `banglabazar-rising-star`.
4. Upload the CONTENTS of the `dist/` folder (not the `dist` folder itself:
   `index.html`, `assets/`, `logo.png`, `_redirects`).
5. Deploy. Cloudflare gives you a `*.pages.dev` URL. This build already
   includes the v2 admin code — but it runs in sample mode until Part B–D
   are done and the site is redeployed with the variables in Part D, step 5.
6. Optional: add your own domain under **Pages → Custom domains**.

### Option 2: Deploy from Git (recommended for updates)
1. Push this project folder to GitHub / GitLab. Do NOT commit a real `.env`.
   `.env.example` is safe to commit.
2. Cloudflare Dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select the repository. Build settings:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: `/` (or the folder containing `package.json`, if nested)
4. Add the environment variables from Part D, step 5 BEFORE the first
   production build, then Deploy. Every future `git push` redeploys automatically.

Local test before deploying (computer):
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # produces dist/
npm run preview  # previews the production build locally
```

## Part B — Create Supabase and run the schema (phone browser works)
1. Go to https://supabase.com/dashboard → **New project**. Choose a name, a
   database password (store it safely — it is NOT used in the website), and
   the closest region. Wait for provisioning to finish.
2. Open **SQL Editor → New query**, paste the ENTIRE contents of
   `supabase/schema.sql` from this ZIP, click **Run**.
3. Open another new query, paste the ENTIRE contents of
   `supabase/schema-v2.sql`, click **Run**. This adds vice-captain/active/
   date-of-birth/stats columns, live-match status, competition, opponent
   logos, goalscorers, hero subtitle, the `hero_banners` table, updated-at
   triggers, and the `club-images` storage policies.
4. Confirm RLS is on: **Table Editor** → each table should show RLS enabled.
   Public visitors can read published rows only; only admins can write.

## Part C — Storage for portraits, banners and logos
1. In Supabase: **Storage**. Confirm the bucket `club-images` exists and is
   **public** (the v2 SQL creates it; if it is missing, create it in the
   dashboard with public = on).
2. Confirm its policies (Dashboard → Storage → Policies, or re-run the
   storage section of `schema-v2.sql`): public SELECT, admin-only
   INSERT / UPDATE / DELETE. Do NOT leave the bucket anonymously writable.
3. Uploaded files are stored as permanent public Storage URLs in the
   database — never as temporary browser URLs — so they survive reloads.

## Part D — Secure admin login (Supabase Auth)
1. In Supabase: **Authentication → Users → Add user**. Create the admin
   account with a strong password and a real club email. If email
   confirmation is on, confirm the user (or turn confirmation off for
   this admin in Auth settings — the login form will otherwise show a
   clear "confirm email" error).
2. Copy that user's UUID (Authentication → Users → click the user).
3. In **SQL Editor**, run:
   ```sql
   insert into public.admin_roles (user_id, role)
   values ('<paste-the-auth-user-uuid-here>', 'admin');
   ```
4. In Supabase: **Project Settings → API**, copy:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` / `public` key → `VITE_SUPABASE_ANON_KEY`
   Never copy the `service_role` key into the website, Cloudflare frontend
   variables, or git.
5. In Cloudflare Pages: **Settings → Environment variables (Production)**,
   add the two `VITE_` variables above, then **Redeploy** (Deployments →
   ⋯ → Redeploy, or push a new commit for Git deployments). `VITE_`
   variables are baked into the frontend build at build time — changing
   them without a redeploy does nothing.
6. Local development: copy `.env.example` to `.env` and fill in the same
   two values. `.env` is git-ignored.

## Part E — What the v2 code already does (no extra code needed)
- `src/supabaseClient.ts`: creates the client only when both `VITE_` values
  are present; otherwise the app runs in labelled sample mode.
- `src/api.ts`: public load (published rows, active banners), admin load
  (all rows), and every insert/update/delete, plus Storage uploads with
  JPG/PNG/WebP + 5 MB validation.
- `src/App.tsx`: `/admin` route with real Auth + `admin_roles` guard,
  logout, and full CRUD forms for players, banners, matches, news,
  management, social links and club settings/branding. Public components
  read social links and branding from `club_settings` — they are not
  hardcoded. Deleting asks for confirmation; failed writes show the real
  RLS/storage error instead of a fake success.

## Part F — Acceptance tests (run these, in order, from an iPhone)
Do not call the admin panel "live" until every box below passes on the
deployed site. Tick them off in this order:
- [ ] 1. Public site loads without login; sample banner is gone once real
      data is published (or still shows honestly while sample data remains).
- [ ] 2. Signed-out visitor opening `https://your-site.pages.dev/admin`
      sees ONLY the login form — no admin tables, no data forms.
- [ ] 3. Wrong password fails with a clear English error.
- [ ] 4. Admin login works from an iPhone; logout works and returns to Home.
- [ ] 5. Add a player (with photo) → it saves, appears on Squad, and is
      still there after logout, refresh, and opening the site on another device.
- [ ] 6. Edit that player, then delete it (confirm dialog appears) → the
      public squad updates both times.
- [ ] 7. Upload a banner, preview it, publish it (Active on) → the home
      hero shows it after a page reload, on another device.
- [ ] 8. Add a match, then correct its score → fixtures, results and the
      Statistics page update. Set a match to Live → it shows the LIVE badge.
- [ ] 9. Change a social URL in Admin → Social (no code edit) → the footer
      and home social icons open the new URL in a new tab. Disable one →
      its icon disappears.
- [ ] 10. A signed-in NON-admin account (create a second Auth user without
      an `admin_roles` row) is refused with a clear error and cannot write.
- [ ] 11. The whole site stays readable and tappable on iPhone and Android:
      no horizontal scrolling, no cut-off buttons, admin tables scroll
      sideways inside their card instead of breaking the page.
- [ ] 12. Change the club logo in Admin → Settings → it updates the header,
      hero and footer, and survives reload.

If a test fails, note the exact on-screen error — the app now shows the
real Supabase/RLS/storage message, which usually names the missing step
(bucket missing, `admin_roles` row missing, or variables not redeployed).

## Troubleshooting
- **Blank page after deploy:** build output directory must be `dist` and
  `index.html` at the root of the uploaded/built output.
- **Admin still shows the setup guide after adding variables:** you added
  the variables but did not redeploy. Redeploy, then hard-refresh.
- **Admin write denied:** the user must exist in BOTH Auth and
  `admin_roles` with role `admin`; otherwise RLS correctly blocks the write.
- **Images not showing:** bucket must be public for reads, and the stored
  URL must be the public Storage URL (the app saves exactly that).
- **Login says "confirm email":** confirm the admin user in Supabase Auth,
  or disable email confirmation for that user, then retry.
- **`/admin` shows a 404 on Cloudflare:** the `dist/_redirects` file was
  not uploaded (Option 1) — upload the full contents of `dist/`, including
  `_redirects`. Git deployments copy it automatically.
