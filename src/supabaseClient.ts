// Supabase client — browser code uses ONLY the anon/public key.
// Never add a service_role key here, in .env for the browser build,
// in Cloudflare frontend variables, or in git. Writes are enforced by
// Row Level Security in supabase/schema.sql + schema-v2.sql, not by
// hiding the key: only a signed-in user listed in admin_roles may write.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const isSupabaseConfigured =
  Boolean(url) && Boolean(anonKey) && !url?.includes('your-project-ref') && !anonKey?.includes('your-supabase')

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null

export const SUPABASE_BUCKET = 'club-images'

// Validate an image before upload. Returns an error string, or '' if OK.
// The returned public Storage URL — never a blob:/temporary URL — is what
// gets stored in the database, so banners and portraits survive reloads.
export function validateImageFile(file: File): string {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowed.includes(file.type)) return 'Image must be JPG, PNG or WebP.'
  if (file.size > 5 * 1024 * 1024) return 'Image must be 5 MB or smaller.'
  if (file.size === 0) return 'That file is empty. Choose another image.'
  return ''
}

export function friendlyError(err: unknown): string {
  const msg = (err as { message?: string })?.message || String(err || 'Unknown error')
  if (/row-level security/i.test(msg)) return 'Access denied by database security (RLS). Only a signed-in admin listed in admin_roles can save this. Check Supabase Auth and admin_roles, then try again.'
  if (/bucket/i.test(msg) || /storage/i.test(msg)) return 'Image storage failed. In Supabase, create the public bucket "club-images" (see docs/DEPLOYMENT.md, Part C), then try again. Details: ' + msg
  if (/invalid login/i.test(msg) || /invalid email/i.test(msg)) return 'Email or password is incorrect.'
  if (/email.*confirm/i.test(msg)) return 'Please confirm this email in Supabase Auth first, or disable email confirmation for this admin user.'
  return msg
}
