// BANGLABAZAR RISING STAR — types, sample fallback data, statistics.
// ---------------------------------------------------------------------------
// SAMPLE DATA ONLY in the arrays below. Nothing here is a real player,
// staff member, match result, sponsor, trophy, or contact detail.
// When Supabase is configured (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY),
// the app loads real rows from Supabase instead and these arrays are only
// the fallback shown while the backend is unreachable — they are never
// written back to the database. When Supabase is NOT configured, the site
// shows this clearly labelled sample data and the admin panel shows the
// setup guide instead of a fake login. Replace samples with real data by
// adding rows in Supabase (Admin panel, once connected) — never by
// inventing names here and calling them real.
// Statistics are calculated from the `matches` array, not hard-coded.
// ---------------------------------------------------------------------------

export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'
export type MatchStatus = 'upcoming' | 'live' | 'completed'

export interface Player {
  id: string
  name: string
  number: number
  position: Position
  nationality: string
  bio: string
  captain: boolean
  viceCaptain: boolean
  published: boolean
  featured: boolean
  isActive: boolean
  portraitUrl: string | null
  dateOfBirth: string | null // YYYY-MM-DD
  appearances: number | null
  goals: number | null
  assists: number | null
}

export interface StaffMember {
  id: string
  name: string
  role: string
  bio: string
  order: number
  portraitUrl: string | null
  published: boolean
}

export interface Match {
  id: string
  opponent: string
  opponentLogoUrl: string | null
  date: string // YYYY-MM-DD
  kickoff: string // HH:MM
  venue: string
  competition: string
  homeOrAway: 'Home' | 'Away'
  status: MatchStatus
  brsScore: number | null
  opponentScore: number | null
  report: string
  goalscorers: string
}

export interface NewsArticle {
  id: string
  title: string
  category: 'Match Announcement' | 'Match Result' | 'Player Announcement' | 'Training Update' | 'Club Event' | 'Tournament News'
  date: string
  excerpt: string
  body: string
  published: boolean
  imageUrl: string | null
}

export interface Banner {
  id: string
  imageUrl: string
  headline: string
  subtitle: string
  buttonText: string
  buttonUrl: string
  isActive: boolean
  displayOrder: number
}

export interface SocialLink { url: string; enabled: boolean }
export interface SocialLinks {
  facebook: SocialLink; instagram: SocialLink; youtube: SocialLink; tiktok: SocialLink
}
export const emptySocialLinks = (): SocialLinks => ({
  facebook: { url: '', enabled: false },
  instagram: { url: '', enabled: false },
  youtube: { url: '', enabled: false },
  tiktok: { url: '', enabled: false },
})

export interface ClubSettings {
  clubName: string
  shortName: string
  description: string
  heroHeadline: string
  heroSubtitle: string
  logoUrl: string | null
  contactEmail: string
  contactPhone: string
  location: string
  socialLinks: SocialLinks
  footerText: string
}

export const defaultSettings: ClubSettings = {
  clubName: 'BANGLABAZAR RISING STAR',
  shortName: 'BRS',
  description: 'The official home of BANGLABAZAR RISING STAR — a competitive local football club built on discipline, teamwork and ambition.',
  heroHeadline: 'BUILT TO COMPETE. UNITED TO WIN.',
  heroSubtitle: 'Follow the squad, fixtures, results and club news here, in English.',
  logoUrl: null,
  contactEmail: '',
  contactPhone: '',
  location: '',
  socialLinks: emptySocialLinks(),
  footerText: 'Built to compete. United to win.',
}

export const initialPlayers: Player[] = [
  { id: 'p1', name: 'Squad Player 01 (Sample)', number: 1, position: 'Goalkeeper', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real goalkeeper biography, or leave unpublished until real data is supplied.', captain: false, viceCaptain: false, published: true, featured: true, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p2', name: 'Squad Player 02 (Sample)', number: 4, position: 'Defender', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real defender biography.', captain: true, viceCaptain: false, published: true, featured: true, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p3', name: 'Squad Player 03 (Sample)', number: 8, position: 'Midfielder', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real midfielder biography.', captain: false, viceCaptain: true, published: true, featured: true, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p4', name: 'Squad Player 04 (Sample)', number: 9, position: 'Forward', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real forward biography.', captain: false, viceCaptain: false, published: true, featured: false, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p5', name: 'Squad Player 05 (Sample)', number: 5, position: 'Defender', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real defender biography.', captain: false, viceCaptain: false, published: true, featured: false, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p6', name: 'Squad Player 06 (Sample)', number: 10, position: 'Midfielder', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real midfielder biography.', captain: false, viceCaptain: false, published: true, featured: false, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p7', name: 'Squad Player 07 (Sample)', number: 11, position: 'Forward', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real forward biography.', captain: false, viceCaptain: false, published: true, featured: false, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
  { id: 'p8', name: 'Squad Player 08 (Sample)', number: 2, position: 'Defender', nationality: 'To be confirmed', bio: 'Sample placeholder profile. Replace with the real defender biography.', captain: false, viceCaptain: false, published: false, featured: false, isActive: false, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null },
]

export const initialStaff: StaffMember[] = [
  { id: 's1', name: 'Team Manager (To be confirmed)', role: 'Team Manager', bio: 'Placeholder. Replace with the real team manager name and biography.', order: 1, portraitUrl: null, published: true },
  { id: 's2', name: 'Head Coach (To be confirmed)', role: 'Head Coach', bio: 'Placeholder. Replace with the real head coach name and biography.', order: 2, portraitUrl: null, published: true },
  { id: 's3', name: 'Assistant Coach (To be confirmed)', role: 'Assistant Coach', bio: 'Placeholder. Replace with the real assistant coach name and biography.', order: 3, portraitUrl: null, published: true },
  { id: 's4', name: 'Team Coordinator (To be confirmed)', role: 'Team Coordinator', bio: 'Placeholder. Replace with the real team coordinator name and biography.', order: 4, portraitUrl: null, published: true },
]

export const initialMatches: Match[] = [
  { id: 'm1', opponent: 'Sample Opponent A', opponentLogoUrl: null, date: '2026-09-05', kickoff: '16:00', venue: 'Home Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Home', status: 'completed', brsScore: 2, opponentScore: 1, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm2', opponent: 'Sample Opponent B', opponentLogoUrl: null, date: '2026-09-12', kickoff: '16:00', venue: 'Away Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Away', status: 'completed', brsScore: 1, opponentScore: 1, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm3', opponent: 'Sample Opponent C', opponentLogoUrl: null, date: '2026-09-19', kickoff: '16:00', venue: 'Home Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Home', status: 'completed', brsScore: 3, opponentScore: 0, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm4', opponent: 'Sample Opponent D', opponentLogoUrl: null, date: '2026-09-26', kickoff: '16:00', venue: 'Away Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Away', status: 'completed', brsScore: 0, opponentScore: 2, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm5', opponent: 'Sample Opponent E', opponentLogoUrl: null, date: '2026-10-03', kickoff: '16:00', venue: 'Home Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Home', status: 'completed', brsScore: 2, opponentScore: 2, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm6', opponent: 'Sample Opponent F', opponentLogoUrl: null, date: '2026-10-10', kickoff: '16:00', venue: 'Away Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Away', status: 'completed', brsScore: 1, opponentScore: 0, report: 'Sample result only. Replace with the real match report.', goalscorers: '' },
  { id: 'm7', opponent: 'Sample Opponent G', opponentLogoUrl: null, date: '2026-11-07', kickoff: '15:30', venue: 'Home Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Home', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' },
  { id: 'm8', opponent: 'Sample Opponent H', opponentLogoUrl: null, date: '2026-11-14', kickoff: '15:30', venue: 'Away Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Away', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' },
  { id: 'm9', opponent: 'Sample Opponent I', opponentLogoUrl: null, date: '2026-11-21', kickoff: '15:30', venue: 'Home Ground (To be confirmed)', competition: 'League (Sample)', homeOrAway: 'Home', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' },
]

export const initialNews: NewsArticle[] = [
  { id: 'n1', title: 'Sample: Training schedule update', category: 'Training Update', date: '2026-10-20', excerpt: 'Sample announcement only. Replace with the real training update.', body: 'This is a sample article. Replace it with the real training update, including the real date, time and venue, before publishing as club news.', published: true, imageUrl: null },
  { id: 'n2', title: 'Sample: Next fixture announced', category: 'Match Announcement', date: '2026-10-18', excerpt: 'Sample announcement only. Replace with the real fixture announcement.', body: 'This is a sample article. Replace it with the real fixture announcement before publishing as club news.', published: true, imageUrl: null },
  { id: 'n3', title: 'Sample: Club event notice', category: 'Club Event', date: '2026-10-15', excerpt: 'Sample announcement only. Replace with the real club event details.', body: 'This is a sample article. Replace it with the real club event details before publishing as club news.', published: true, imageUrl: null },
]

export function resultOf(m: Match): 'W' | 'D' | 'L' | null {
  if (m.status !== 'completed' || m.brsScore === null || m.opponentScore === null) return null
  if (m.brsScore > m.opponentScore) return 'W'
  if (m.brsScore < m.opponentScore) return 'L'
  return 'D'
}

export interface Stats {
  played: number; wins: number; draws: number; losses: number; winPct: number
  goalsFor: number; goalsAgainst: number; cleanSheets: number
}

export function computeStats(matches: Match[]): Stats {
  const completed = matches.filter((m) => m.status === 'completed' && m.brsScore !== null && m.opponentScore !== null)
  const wins = completed.filter((m) => resultOf(m) === 'W').length
  const draws = completed.filter((m) => resultOf(m) === 'D').length
  const losses = completed.filter((m) => resultOf(m) === 'L').length
  const goalsFor = completed.reduce((s, m) => s + (m.brsScore ?? 0), 0)
  const goalsAgainst = completed.reduce((s, m) => s + (m.opponentScore ?? 0), 0)
  const cleanSheets = completed.filter((m) => m.opponentScore === 0).length
  return { played: completed.length, wins, draws, losses, winPct: completed.length ? Math.round((wins / completed.length) * 100) : 0, goalsFor, goalsAgainst, cleanSheets }
}

export function ageFromDob(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 ? age : null
}

export function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => (a.date + ' ' + a.kickoff).localeCompare(b.date + ' ' + b.kickoff))
}
