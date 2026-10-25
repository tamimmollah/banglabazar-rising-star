// Data layer: Supabase queries + row mapping. All admin writes go through
// here so RLS is the single enforcement point. When Supabase is not
// configured, every loader returns null and the UI falls back to the
// labelled sample data in data.ts — it never pretends a save succeeded.
import { supabase, SUPABASE_BUCKET, validateImageFile, friendlyError } from './supabaseClient'
import { defaultSettings, emptySocialLinks } from './data'
import type { Banner, ClubSettings, Match, NewsArticle, Player, Position, SocialLinks, StaffMember } from './data'

type Row = Record<string, unknown>
const s = (r: Row, k: string): string => (typeof r[k] === 'string' ? (r[k] as string) : '')
const n = (r: Row, k: string): number | null => (typeof r[k] === 'number' ? (r[k] as number) : null)
const b = (r: Row, k: string, d = false): boolean => (typeof r[k] === 'boolean' ? (r[k] as boolean) : d)

export const mapPlayer = (r: Row): Player => ({
  id: String(r.id), name: s(r, 'name'), number: n(r, 'jersey_number') ?? 0,
  position: (s(r, 'position') as Position) || 'Forward', nationality: s(r, 'nationality'),
  bio: s(r, 'bio'), captain: b(r, 'is_captain'), viceCaptain: b(r, 'is_vice_captain'),
  published: b(r, 'is_published', true), featured: b(r, 'is_featured'),
  isActive: b(r, 'is_active', true), portraitUrl: s(r, 'portrait_url') || null,
  dateOfBirth: s(r, 'date_of_birth') || null, appearances: n(r, 'appearances'),
  goals: n(r, 'goals'), assists: n(r, 'assists'),
})
export const mapStaff = (r: Row): StaffMember => ({
  id: String(r.id), name: s(r, 'name'), role: s(r, 'role'), bio: s(r, 'bio'),
  order: n(r, 'display_order') ?? 0, portraitUrl: s(r, 'portrait_url') || null,
  published: b(r, 'is_published', true),
})
export const mapMatch = (r: Row): Match => ({
  id: String(r.id), opponent: s(r, 'opponent'), opponentLogoUrl: s(r, 'opponent_logo_url') || null,
  date: s(r, 'match_date'), kickoff: (s(r, 'kickoff') || '16:00').slice(0, 5),
  venue: s(r, 'venue'), competition: s(r, 'competition'),
  homeOrAway: s(r, 'home_or_away') === 'Away' ? 'Away' : 'Home',
  status: (['upcoming', 'live', 'completed'].includes(s(r, 'status')) ? s(r, 'status') : 'upcoming') as Match['status'],
  brsScore: n(r, 'brs_score'), opponentScore: n(r, 'opponent_score'),
  report: s(r, 'report') || s(r, 'summary'), goalscorers: s(r, 'goalscorers'),
})
export const mapNews = (r: Row): NewsArticle => ({
  id: String(r.id), title: s(r, 'title'), category: (s(r, 'category') as NewsArticle['category']) || 'Club Event',
  date: s(r, 'published_date'), excerpt: s(r, 'excerpt'), body: s(r, 'body'),
  published: b(r, 'is_published'), imageUrl: s(r, 'image_url') || null,
})
export const mapBanner = (r: Row): Banner => ({
  id: String(r.id), imageUrl: s(r, 'image_url'), headline: s(r, 'headline'),
  subtitle: s(r, 'subtitle'), buttonText: s(r, 'button_text'), buttonUrl: s(r, 'button_url'),
  isActive: b(r, 'is_active'), displayOrder: n(r, 'display_order') ?? 0,
})
export function mapSettings(r: Row): ClubSettings {
  const raw = (r.social_links && typeof r.social_links === 'object' ? r.social_links : {}) as Record<string, { url?: string; enabled?: boolean } | string>
  const links = emptySocialLinks()
  ;(['facebook', 'instagram', 'youtube', 'tiktok'] as const).forEach((k) => {
    const v = raw[k]
    if (typeof v === 'string') links[k] = { url: v, enabled: Boolean(v) }
    else if (v && typeof v === 'object') links[k] = { url: v.url || '', enabled: v.enabled !== false && Boolean(v.url) }
  })
  return {
    clubName: s(r, 'club_name') || defaultSettings.clubName,
    shortName: s(r, 'short_name') || 'BRS',
    description: s(r, 'description') || defaultSettings.description,
    heroHeadline: s(r, 'hero_headline') || defaultSettings.heroHeadline,
    heroSubtitle: s(r, 'hero_subtitle') || defaultSettings.heroSubtitle,
    logoUrl: s(r, 'logo_url') || null,
    contactEmail: s(r, 'contact_email'), contactPhone: s(r, 'contact_phone'),
    location: s(r, 'location'), socialLinks: links as SocialLinks,
    footerText: s(r, 'footer_text') || defaultSettings.footerText,
  }
}
export function settingsToRow(x: ClubSettings): Row {
  return {
    club_name: x.clubName, short_name: x.shortName, description: x.description,
    hero_headline: x.heroHeadline, hero_subtitle: x.heroSubtitle, logo_url: x.logoUrl || null,
    contact_email: x.contactEmail || null, contact_phone: x.contactPhone || null,
    location: x.location || null, social_links: x.socialLinks, footer_text: x.footerText || null,
  }
}

export interface LoadResult {
  players: Player[]; staff: StaffMember[]; matches: Match[]; news: NewsArticle[]
  banners: Banner[]; settings: ClubSettings
}

// Public load: published players/staff/news, all matches, active banners, settings.
// Admin load (isAdmin=true): all rows, including unpublished.
export async function loadSite(isAdmin: boolean): Promise<LoadResult | null> {
  if (!supabase) return null
  const playersQ = supabase.from('players').select('*').order('jersey_number')
  const staffQ = supabase.from('management').select('*').order('display_order')
  const matchesQ = supabase.from('matches').select('*').order('match_date').order('kickoff')
  const newsQ = supabase.from('news').select('*').order('published_date', { ascending: false })
  const bannersQ = supabase.from('hero_banners').select('*').order('display_order')
  const settingsQ = supabase.from('club_settings').select('*').eq('id', 1).single()
  if (!isAdmin) {
    playersQ.eq('is_published', true); staffQ.eq('is_published', true); newsQ.eq('is_published', true)
    bannersQ.eq('is_active', true)
  }
  const [p, st, m, nw, bn, se] = await Promise.all([playersQ, staffQ, matchesQ, newsQ, bannersQ, settingsQ])
  const firstError = [p, st, m, nw, bn].find((r) => r.error)?.error
  if (firstError) throw new Error(friendlyError(firstError))
  return {
    players: (p.data || []).map(mapPlayer),
    staff: (st.data || []).map(mapStaff),
    matches: (m.data || []).map(mapMatch),
    news: (nw.data || []).map(mapNews),
    banners: (bn.data || []).map(mapBanner),
    settings: se.data ? mapSettings(se.data as Row) : defaultSettings,
  }
}

export async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.from('admin_roles').select('role').eq('user_id', userId).maybeSingle()
  if (error) return false
  return data?.role === 'admin'
}

// Upload to Supabase Storage and return the permanent public URL.
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const v = validateImageFile(file)
  if (v) throw new Error(v)
  const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  const path = `${folder}/${Date.now()}-${safe}`
  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, { upsert: false })
  if (error) throw new Error(friendlyError(error))
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

async function write(table: string, payload: Row, id?: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const q = id ? supabase.from(table).update(payload).eq('id', id).select().single()
    : supabase.from(table).insert(payload).select().single()
  const { data, error } = await q
  if (error) throw new Error(friendlyError(error))
  return data as Row
}
async function remove(table: string, id: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(friendlyError(error))
}

export const playerToRow = (p: Partial<Player>): Row => ({
  name: p.name, jersey_number: p.number, position: p.position, nationality: p.nationality || null,
  bio: p.bio || null, is_captain: !!p.captain, is_vice_captain: !!p.viceCaptain,
  is_published: p.published !== false, is_featured: !!p.featured, is_active: p.isActive !== false,
  portrait_url: p.portraitUrl || null, date_of_birth: p.dateOfBirth || null,
  appearances: p.appearances ?? null, goals: p.goals ?? null, assists: p.assists ?? null,
})
export const staffToRow = (x: Partial<StaffMember>): Row => ({
  name: x.name, role: x.role, bio: x.bio || null, display_order: x.order ?? 0,
  portrait_url: x.portraitUrl || null, is_published: x.published !== false,
})
export const matchToRow = (m: Partial<Match>): Row => ({
  opponent: m.opponent, opponent_logo_url: m.opponentLogoUrl || null,
  match_date: m.date, kickoff: m.kickoff || '16:00', venue: m.venue || null,
  competition: m.competition || null, home_or_away: m.homeOrAway || 'Home',
  status: m.status || 'upcoming',
  brs_score: m.status === 'completed' || m.status === 'live' ? (m.brsScore ?? null) : null,
  opponent_score: m.status === 'completed' || m.status === 'live' ? (m.opponentScore ?? null) : null,
  report: m.report || null, summary: m.report || null, goalscorers: m.goalscorers || null,
})
export const newsToRow = (x: Partial<NewsArticle>): Row => ({
  title: x.title, category: x.category, published_date: x.date, excerpt: x.excerpt || null,
  body: x.body || null, is_published: x.published !== false, image_url: x.imageUrl || null,
})
export const bannerToRow = (x: Partial<Banner>): Row => ({
  image_url: x.imageUrl, headline: x.headline || null, subtitle: x.subtitle || null,
  button_text: x.buttonText || null, button_url: x.buttonUrl || null,
  is_active: !!x.isActive, display_order: x.displayOrder ?? 0,
})

export const savePlayer = (p: Partial<Player>, id?: string) => write('players', playerToRow(p), id)
export const deletePlayer = (id: string) => remove('players', id)
export const saveStaff = (x: Partial<StaffMember>, id?: string) => write('management', staffToRow(x), id)
export const deleteStaff = (id: string) => remove('management', id)
export const saveMatch = (m: Partial<Match>, id?: string) => write('matches', matchToRow(m), id)
export const deleteMatch = (id: string) => remove('matches', id)
export const saveNews = (x: Partial<NewsArticle>, id?: string) => write('news', newsToRow(x), id)
export const deleteNews = (id: string) => remove('news', id)
export const saveBanner = (x: Partial<Banner>, id?: string) => write('hero_banners', bannerToRow(x), id)
export const deleteBanner = (id: string) => remove('hero_banners', id)
export async function saveSettings(x: ClubSettings) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.from('club_settings').update(settingsToRow(x)).eq('id', 1)
  if (error) throw new Error(friendlyError(error))
}
