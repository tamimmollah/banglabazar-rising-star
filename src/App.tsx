import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ageFromDob, computeStats, defaultSettings, initialMatches, initialNews, initialPlayers,
  initialStaff, resultOf, sortMatches,
} from './data'
import type { Banner, ClubSettings, Match, NewsArticle, Player, Position, SocialLinks, StaffMember } from './data'
import { isSupabaseConfigured, supabase, validateImageFile } from './supabaseClient'
import {
  checkIsAdmin, deleteBanner, deleteMatch, deleteNews, deletePlayer, deleteStaff,
  loadSite, saveBanner, saveMatch, saveNews, savePlayer, saveSettings, saveStaff, uploadImage,
} from './api'

type Page = 'home' | 'squad' | 'management' | 'matches' | 'stats' | 'news' | 'contact' | 'admin'
type AdminTab = 'overview' | 'players' | 'banners' | 'matches' | 'news' | 'management' | 'social' | 'settings'
const PAGES: { id: Page; label: string; path: string }[] = [
  { id: 'home', label: 'Home', path: '/' },
  { id: 'squad', label: 'Squad', path: '/squad' },
  { id: 'management', label: 'Management', path: '/management' },
  { id: 'matches', label: 'Matches', path: '/matches' },
  { id: 'stats', label: 'Statistics', path: '/stats' },
  { id: 'news', label: 'News', path: '/news' },
  { id: 'contact', label: 'Contact', path: '/contact' },
]
const PATH_TO_PAGE: Record<string, Page> = { '/': 'home', '/squad': 'squad', '/management': 'management', '/matches': 'matches', '/stats': 'stats', '/news': 'news', '/contact': 'contact', '/admin': 'admin' }
function pageFromLocation(): Page {
  const q = new URLSearchParams(window.location.search).get('page')
  if (q && PATH_TO_PAGE['/' + q.replace(/^\/+/, '')]) return PATH_TO_PAGE['/' + q.replace(/^\/+/, '')] as Page
  const p = window.location.pathname.replace(/\/$/, '') || '/'
  return PATH_TO_PAGE[p] || 'home'
}
const POSITIONS: ('All' | Position)[] = ['All', 'Goalkeeper', 'Defender', 'Midfielder', 'Forward']
const NEWS_CATS: NewsArticle['category'][] = ['Match Announcement', 'Match Result', 'Player Announcement', 'Training Update', 'Club Event', 'Tournament News']

function SampleBanner({ backend }: { backend?: boolean }) {
  if (backend) return null
  return (
    <div className="banner">
      <strong>Sample data only.</strong> No real players, staff, scores, sponsors or contact details
      are shown here. Add real data in the Admin panel once Supabase is connected, or replace
      the sample arrays in <code>src/data.ts</code>.
    </div>
  )
}
function BackendBanner() {
  return (
    <div className="banner backend">
      <strong>Backend not connected yet — no fake admin here.</strong> Supabase environment variables
      are missing, so there is deliberately no login form that pretends to work. Follow
      <strong> Admin → Setup</strong> (or <code>docs/DEPLOYMENT.md</code>) to connect Supabase Auth,
      then this page becomes the real login.
    </div>
  )
}
function SocialLinks({ links, dark }: { links: SocialLinks; dark?: boolean }) {
  const items = [
    { key: 'facebook' as const, label: 'Facebook' },
    { key: 'instagram' as const, label: 'Instagram' },
    { key: 'youtube' as const, label: 'YouTube' },
    { key: 'tiktok' as const, label: 'TikTok' },
  ].filter((i) => links[i.key].enabled && links[i.key].url)
  if (!items.length) return <p className="muted small">Social links: to be confirmed — set them in Admin → Social once connected.</p>
  return (
    <div className="social-row">
      {items.map((i) => (
        <a key={i.key} href={links[i.key].url} target="_blank" rel="noreferrer" className={dark ? 'social-btn dark' : 'social-btn'} aria-label={`Open ${labelFor(i.key)} on ${i.label} in a new tab`}>{i.label}</a>
      ))}
    </div>
  )
}
function labelFor(k: string) { return k === 'facebook' ? 'Facebook' : k === 'instagram' ? 'Instagram' : k === 'youtube' ? 'YouTube' : 'TikTok' }

function PlayerCard({ p, onOpen }: { p: Player; onOpen: () => void }) {
  const age = ageFromDob(p.dateOfBirth)
  return (
    <article className="player-card" onClick={onOpen} role="button" tabIndex={0}>
      <div className="player-image-wrapper">
        {p.portraitUrl ? <img className="portrait" src={p.portraitUrl} alt={`${p.name} portrait`} loading="lazy" /> : (
          <div className="avatar"><b>{p.number}</b></div>
        )}
        <div className="player-number">{p.number}</div>
      </div>
      <div className="player-info">
        <h3>{p.name}</h3>
        <p className="position-tag">{p.position}</p>
        <p className="muted small">{p.nationality}{age !== null ? ` • Age ${age}` : ''}{p.captain ? ' • (C)' : ''}{p.viceCaptain ? ' • (VC)' : ''}</p>
      </div>
    </article>
  )
}

function MatchCard({ m }: { m: Match }) {
  const r = resultOf(m)
  return (
    <article className="match-card">
      <div className="match-header">
        <span className="tag">{m.competition || m.homeOrAway}</span>
        {m.status === 'live' && <span className="live-badge">● LIVE</span>}
        {r && <span className={`result-badge ${r}`}>{r === 'W' ? 'W' : r === 'D' ? 'D' : 'L'}</span>}
      </div>
      <div className="match-teams">
        <div className="team">
          <span className="team-name">BRS</span>
        </div>
        <div className="score-box">
          {m.status === 'completed' || m.status === 'live' ? (
            <span>{m.brsScore ?? '-'} : {m.opponentScore ?? '-'}</span>
          ) : <span className="time">{m.kickoff}</span>}
        </div>
        <div className="team">
          {m.opponentLogoUrl && <img className="opp-logo" src={m.opponentLogoUrl} alt={`${m.opponent} logo`} loading="lazy" />}
          <span className="team-name">{m.opponent}</span>
        </div>
      </div>
      <div className="match-footer">
        <p className="muted small">{m.date} • {m.venue}</p>
        {m.status === 'upcoming' && <p className="tag sample" style={{marginTop: '0.5rem'}}>Upcoming</p>}
      </div>
    </article>
  )
}

// Image picker: shows a preview BEFORE saving
function ImagePicker({ label, value, onChange, folder }: { label: string; value: string; onChange: (url: string) => void; folder: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [err, setErr] = useState('')
  const [uploading, setUploading] = useState(false)
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  async function pick(f: File | undefined) {
    if (!f) return
    const v = validateImageFile(f)
    if (v) { setErr(v); return }
    setErr(''); setFile(f); setPreview(URL.createObjectURL(f))
  }
  async function upload() {
    if (!file) return
    setUploading(true)
    try { const url = await uploadImage(file, folder); onChange(url); setFile(null); setErr('') }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) } finally { setUploading(false) }
  }
  return (
    <div>
      <label>{label}</label>
      {(preview || value) && <img className="preview-img" src={preview || value} alt="Preview" />}
      {preview && <p className="muted small">Preview only — press “Upload image” to save it permanently, then save the form.</p>}
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} />
      <input placeholder="Or paste an existing image URL" value={value} onChange={(e) => onChange(e.target.value)} style={{ marginTop: 8 }} />
      {file && <p style={{ marginTop: 8 }}><button type="button" className="btn smallbtn" disabled={uploading || !isSupabaseConfigured} onClick={upload}>{uploading ? 'Uploading…' : 'Upload image'}</button></p>}
      {!isSupabaseConfigured && <p className="muted small">Uploads need Supabase connected (Admin → Setup).</p>}
      {err && <div className="banner backend" role="alert">{err}</div>}
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromLocation())
  const [menuOpen, setMenuOpen] = useState(false)
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff)
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [news, setNews] = useState<NewsArticle[]>(initialNews)
  const [banners, setBanners] = useState<Banner[]>([])
  const [settings, setSettings] = useState<ClubSettings>(defaultSettings)
  const [dataSource, setDataSource] = useState<'sample' | 'supabase'>('sample')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [loadError, setLoadError] = useState('')
  const [positionFilter, setPositionFilter] = useState<'All' | Position>('All')
  const [squadSearch, setSquadSearch] = useState('')
  const [matchTab, setMatchTab] = useState<'upcoming' | 'completed' | 'results'>('upcoming')
  const [resultFilter, setResultFilter] = useState<'All' | 'W' | 'D' | 'L'>('All')
  const [newsCategory, setNewsCategory] = useState<string>('All')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  // Auth
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authUserEmail, setAuthUserEmail] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')

  // Admin UI
  const [adminTab, setAdminTab] = useState<AdminTab>('overview')
  const [adminSearch, setAdminSearch] = useState('')
  const [adminNotice, setAdminNotice] = useState('')
  const [adminError, setAdminError] = useState('')
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async (admin: boolean) => {
    if (!isSupabaseConfigured || !supabase) { setLoading(false); setDataSource('sample'); return }
    setLoading(true); setLoadError('')
    try {
      const data = await loadSite(admin)
      if (data) {
        setPlayers(data.players); setStaff(data.staff); setMatches(data.matches)
        setNews(data.news); setBanners(data.banners); setSettings(data.settings); setDataSource('supabase')
      }
    } catch (e) { setLoadError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const onPop = () => setPage(pageFromLocation())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) { setAuthLoading(false); reload(false); return }
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      const user = data.session?.user
      setAuthUserEmail(user?.email || '')
      const admin = user ? await checkIsAdmin(user.id) : false
      setIsAdmin(admin); setAuthLoading(false); reload(admin)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_ev, session) => {
      const user = session?.user
      setAuthUserEmail(user?.email || '')
      const admin = user ? await checkIsAdmin(user.id) : false
      setIsAdmin(admin); if (user) reload(admin)
      if (!user) { setPlayers(initialPlayers); setStaff(initialStaff); setMatches(initialMatches); setNews(initialNews); setBanners([]); setSettings(defaultSettings); setDataSource('sample') }
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [reload])

  function go(p: Page) {
    const path = p === 'home' ? '/' : '/' + p
    window.history.pushState({}, '', path)
    setPage(p); setMenuOpen(false); setSelectedArticle(null); setSelectedMatch(null)
    window.scrollTo({ top: 0 })
  }
  async function doLogin(e: React.FormEvent) {
    e.preventDefault(); setAuthError(''); setAuthNotice('')
    if (!supabase) return
    if (!loginEmail.trim() || !loginPassword) { setAuthError('Enter your admin email and password.'); return }
    const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword })
    if (error) { setAuthError(error.message); return }
    const user = data.user
    if (!user) { setAuthError('Login failed. Please try again.'); return }
    const admin = await checkIsAdmin(user.id)
    if (!admin) {
      await supabase.auth.signOut()
      setAuthError('This account is signed in, but it is not listed as an admin in admin_roles. Ask the club admin to add your user ID there (docs/DEPLOYMENT.md, Part D), then try again.')
      return
    }
    setIsAdmin(true); setAuthNotice('Signed in as admin.'); reload(true)
  }
  async function doLogout() {
    if (supabase) await supabase.auth.signOut()
    setIsAdmin(false); setAuthUserEmail(''); go('home')
  }
  async function adminSave<T>(fn: () => Promise<T>, okMsg: string) {
    setSaving(true); setAdminError(''); setAdminNotice('')
    try { await fn(); setAdminNotice(okMsg); await reload(true) }
    catch (e) { setAdminError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }
  function confirmDelete(label: string) {
    return window.confirm(`Delete ${label}? This cannot be undone and the public website will update immediately.`)
  }

  const stats = useMemo(() => computeStats(matches), [matches])
  const publishedPlayers = players.filter((p) => p.published)
  const activePlayers = publishedPlayers.filter((p) => p.isActive)
  const visiblePlayers = activePlayers.filter((p) =>
    (positionFilter === 'All' || p.position === positionFilter) &&
    (p.name + ' ' + p.position).toLowerCase().includes(squadSearch.toLowerCase()))
  const featured = publishedPlayers.filter((p) => p.featured && p.isActive)
  const sortedMatches = useMemo(() => sortMatches(matches), [matches])
  const upcoming = sortedMatches.filter((m) => m.status === 'upcoming')
  const liveMatches = sortedMatches.filter((m) => m.status === 'live')
  const completed = [...sortedMatches.filter((m) => m.status === 'completed')].reverse()
  const latest = completed[0]
  const nextMatch = upcoming[0]
  const publishedNews = news.filter((n) => n.published)
  const categories = ['All', ...Array.from(new Set(publishedNews.map((n) => n.category)))]
  const visibleNews = publishedNews.filter((n) => newsCategory === 'All' || n.category === newsCategory)
  const matchList = matchTab === 'upcoming' ? upcoming : completed.filter((m) => resultFilter === 'All' || resultOf(m) === resultFilter)
  const activeBanner = [...banners].filter((b) => b.isActive).sort((a, b) => a.displayOrder - b.displayOrder)[0]
  const logoSrc = settings.logoUrl || '/logo.png'
  const enabledSocialCount = (Object.values(settings.socialLinks) as { url: string; enabled: boolean }[]).filter((l) => l.enabled && l.url).length

  // Admin form state
  const emptyPlayer: Player = { id: '', name: '', number: 0, position: 'Forward', nationality: '', bio: '', captain: false, viceCaptain: false, published: true, featured: false, isActive: true, portraitUrl: null, dateOfBirth: null, appearances: null, goals: null, assists: null }
  const [playerForm, setPlayerForm] = useState<Player>(emptyPlayer)
  const [matchForm, setMatchForm] = useState<Match>({ id: '', opponent: '', opponentLogoUrl: null, date: '', kickoff: '16:00', venue: '', competition: '', homeOrAway: 'Home', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' })
  const [newsForm, setNewsForm] = useState<NewsArticle>({ id: '', title: '', category: 'Club Event', date: new Date().toISOString().slice(0, 10), excerpt: '', body: '', published: true, imageUrl: null })
  const [staffForm, setStaffForm] = useState<StaffMember>({ id: '', name: '', role: 'Head Coach', bio: '', order: 0, portraitUrl: null, published: true })
  const [bannerForm, setBannerForm] = useState<Banner>({ id: '', imageUrl: '', headline: '', subtitle: '', buttonText: '', buttonUrl: '', isActive: false, displayOrder: 0 })
  const [settingsForm, setSettingsForm] = useState<ClubSettings>(defaultSettings)
  useEffect(() => { setSettingsForm(settings) }, [settings])
  const numOrNull = (v: string) => (v === '' ? null : Number(v))

  function heroButtonAction(url: string) {
    if (!url) return
    if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noreferrer')
    else {
      const key = url.replace(/^\/+/, '') as Page
      if (key === '' || (PATH_TO_PAGE['/' + key] && key !== 'admin')) go(key === '' ? 'home' : key)
      else window.location.href = url
    }
  }

  return (
    <div>
      <header className="site">
        <div className="wrap nav">
          <button className="brand" onClick={() => go('home')} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <img src={logoSrc} alt={`${settings.clubName} official logo`} />
            <span><b>{settings.clubName}</b><span>{settings.shortName} • OFFICIAL CLUB SITE</span></span>
          </button>
          <button className="burger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation menu">MENU</button>
          <nav className={`navlinks ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
            {PAGES.map((p) => (
              <button key={p.id} className={page === p.id ? 'active' : ''} onClick={() => go(p.id)}>{p.label}</button>
            ))}
            <button className={page === 'admin' ? 'active' : ''} onClick={() => go('admin')}>Admin</button>
          </nav>
        </div>
      </header>
      
      {loading && <div className="wrap"><div className="banner" role="status">Loading club data…</div></div>}
      {loadError && <div className="wrap"><div className="banner backend" role="alert">Could not load live data: {loadError} Showing sample data instead.</div></div>}

      {page === 'home' && (
        <main>
          <div className="hero" style={activeBanner ? { backgroundImage: `url(${activeBanner.imageUrl})` } : undefined}>
            <div className="wrap hero-inner">
              <div className="hero-content">
                <span className="tag">{settings.clubName} • {settings.shortName}</span>
                <h1>{activeBanner ? activeBanner.headline || settings.heroHeadline : settings.heroHeadline}</h1>
                <p>{activeBanner ? activeBanner.subtitle || settings.heroSubtitle : settings.heroSubtitle}</p>
                <p className="muted small">{settings.description}</p>
                <div className="hero-cta">
                  {activeBanner?.buttonText ? <button className="btn" onClick={() => heroButtonAction(activeBanner.buttonUrl)}>{activeBanner.buttonText}</button> : null}
                  <button className="btn" onClick={() => go('squad')}>Meet the squad</button>
                  <button className="btn ghost" onClick={() => go('matches')}>View matches</button>
                </div>
                {dataSource === 'sample' && <SampleBanner />}
              </div>
              <div className="hero-crest">
                <img src={logoSrc} alt={`${settings.clubName} official logo`} />
                <p>Official club crest</p>
              </div>
            </div>
          </div>

          {liveMatches.length > 0 && (
            <section className="block wrap">
              <span className="tag warn">Live now</span><h2>Live matches</h2>
              <div className="grid three">{liveMatches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            </section>
          )}
          <section className="block wrap">
            <span className="tag">Match centre</span><h2>Latest &amp; next</h2>
            <div className="grid two">
              <div className="card"><h3>Latest result{dataSource === 'sample' ? ' (sample)' : ''}</h3>{latest ? <MatchCard m={latest} /> : <p className="muted">No completed matches yet.</p>}</div>
              <div className="card"><h3>Upcoming match{dataSource === 'sample' ? ' (sample)' : ''}</h3>{nextMatch ? <MatchCard m={nextMatch} /> : <p className="muted">No upcoming matches scheduled yet.</p>}</div>
            </div>
          </section>
          <section className="block wrap">
            <span className="tag">Team record — calculated from {dataSource === 'sample' ? 'sample' : 'recorded'} matches</span><h2>At a glance</h2>
            <div className="grid">
              <div className="card"><div className="stat-num">{stats.played}</div><div className="stat-label">Matches played</div></div>
              <div className="card"><div className="stat-num">{stats.wins}</div><div className="stat-label">Wins</div></div>
              <div className="card"><div className="stat-num">{stats.draws}</div><div className="stat-label">Draws</div></div>
              <div className="card"><div className="stat-num">{stats.losses}</div><div className="stat-label">Losses</div></div>
            </div>
          </section>
          <section className="block wrap">
            <span className="tag">Featured players{dataSource === 'sample' ? ' (sample)' : ''}</span><h2>Featured squad</h2>
            {featured.length === 0 ? <div className="empty">No featured players yet.</div> : (
              <div className="grid three">{featured.map((p) => <PlayerCard key={p.id} p={p} onOpen={() => setSelectedPlayer(p)} />)}</div>
            )}
            <p style={{ marginTop: 16 }}><button className="btn" onClick={() => go('squad')}>View full squad</button></p>
          </section>
          <section className="block wrap">
            <span className="tag">Club news</span><h2>Latest announcements</h2>
            {publishedNews.length === 0 ? <div className="empty">No published news yet.</div> : (
              <div className="grid three">
                {publishedNews.slice(0, 3).map((n) => (
                  <article className="card" key={n.id}>
                    {n.imageUrl && <img className="news-img" src={n.imageUrl} alt="" loading="lazy" />}
                    <span className="tag sample">{n.category}</span><h3>{n.title}</h3>
                    <p className="muted small">{n.date}</p><p className="small">{n.excerpt}</p>
                    <button className="btn smallbtn" onClick={() => setSelectedArticle(n)}>Read article</button>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="block wrap">
            <span className="tag">Follow the club</span><h2>Social media</h2>
            <SocialLinks links={settings.socialLinks} />
          </section>
        </main>
      )}

      {page === 'squad' && (
        <main className="wrap"><section className="block">
          <span className="tag">Team / Squad</span><h2>The squad</h2>
          {dataSource === 'sample' && <SampleBanner />}
          <label htmlFor="squad-search">Search players</label>
          <input id="squad-search" value={squadSearch} onChange={(e) => setSquadSearch(e.target.value)} placeholder="Search by name or position" />
          <div className="filters" role="group" aria-label="Filter by position">
            {POSITIONS.map((pos) => (
              <button key={pos} className={positionFilter === pos ? 'active' : ''} onClick={() => setPositionFilter(pos)}>{pos === 'All' ? 'All positions' : pos}</button>
            ))}
          </div>
          {visiblePlayers.length === 0 ? <div className="empty">No published, active players match this search yet.</div> : (
            <div className="grid three">{visiblePlayers.map((p) => <PlayerCard key={p.id} p={p} onOpen={() => setSelectedPlayer(p)} />)}</div>
          )}
        </section></main>
      )}

      {page === 'management' && (
        <main className="wrap"><section className="block">
          <span className="tag">Team management</span><h2>Management team</h2>
          {dataSource === 'sample' && <SampleBanner />}
          {staff.filter((s) => s.published).length === 0 ? <div className="empty">No management members published yet.</div> : (
            <div className="grid three">
              {[...staff].filter((s) => s.published).sort((a, b) => a.order - b.order).map((s) => (
                <article className="card" key={s.id}>
                  {s.portraitUrl ? <img className="news-img" src={s.portraitUrl} alt={`${s.name} portrait`} loading="lazy" /> : <div className="avatar" style={{fontSize:'3rem',opacity:0.2}}><b>{s.role.charAt(0)}</b></div>}
                  <h3>{s.name}</h3><p className="tag">{s.role}</p><p className="small">{s.bio}</p>
                </article>
              ))}
            </div>
          )}
        </section></main>
      )}

      {page === 'matches' && (
        <main className="wrap"><section className="block">
          <span className="tag">Matches &amp; results</span><h2>Match centre</h2>
          {dataSource === 'sample' && <SampleBanner />}
          {liveMatches.length > 0 && <div className="banner"><strong>Live now:</strong> {liveMatches.map((m) => `BRS ${m.brsScore ?? '—'} – ${m.opponentScore ?? '—'} ${m.opponent}`).join(' • ')}</div>}
          <div className="filters">
            <button className={matchTab === 'upcoming' ? 'active' : ''} onClick={() => setMatchTab('upcoming')}>Upcoming matches</button>
            <button className={matchTab === 'completed' ? 'active' : ''} onClick={() => setMatchTab('completed')}>Completed matches</button>
            <button className={matchTab === 'results' ? 'active' : ''} onClick={() => setMatchTab('results')}>Match results</button>
          </div>
          {matchTab !== 'upcoming' && (
            <div className="filters">
              <span className="muted small" style={{ alignSelf: 'center' }}>Filter by result:</span>
              {(['All', 'W', 'D', 'L'] as const).map((r) => (
                <button key={r} className={resultFilter === r ? 'active' : ''} onClick={() => setResultFilter(r)}>{r === 'All' ? 'All results' : r === 'W' ? 'Wins' : r === 'D' ? 'Draws' : 'Losses'}</button>
              ))}
            </div>
          )}
          {matchList.length === 0 ? <div className="empty">No matches in this category yet.</div> : (
            <div className="grid two">{matchList.map((m) => <div key={m.id} onClick={() => setSelectedMatch(m)} style={{ cursor: 'pointer' }}><MatchCard m={m} /></div>)}</div>
          )}
          <p className="muted small" style={{ marginTop: 16 }}>Tap a match card for its full report and goalscorers, when available.</p>
        </section></main>
      )}

      {page === 'stats' && (
        <main className="wrap"><section className="block">
          <span className="tag">Club statistics</span><h2>Statistics</h2>
          <p className="muted">All figures are calculated live from {dataSource === 'sample' ? 'sample' : 'recorded'} completed matches. Correcting a score in Admin updates these figures.</p>
          {stats.played === 0 ? <div className="empty">No completed matches yet — statistics will appear here once results are recorded.</div> : (
            <div className="grid">
              <div className="card"><div className="stat-num">{stats.played}</div><div className="stat-label">Total matches</div></div>
              <div className="card"><div className="stat-num">{stats.wins}</div><div className="stat-label">Wins</div></div>
              <div className="card"><div className="stat-num">{stats.draws}</div><div className="stat-label">Draws</div></div>
              <div className="card"><div className="stat-num">{stats.losses}</div><div className="stat-label">Losses</div></div>
              <div className="card"><div className="stat-num">{stats.winPct}%</div><div className="stat-label">Win percentage</div></div>
              <div className="card"><div className="stat-num">{stats.goalsFor}</div><div className="stat-label">Goals scored</div></div>
              <div className="card"><div className="stat-num">{stats.goalsAgainst}</div><div className="stat-label">Goals conceded</div></div>
              <div className="card"><div className="stat-num">{stats.cleanSheets}</div><div className="stat-label">Clean sheets</div></div>
            </div>
          )}
          <h3 style={{ marginTop: 28 }}>Top scorers</h3>
          <div className="empty">Top scorers are shown only when real goalscorer data is recorded per match. No scorer figures are invented.</div>
        </section></main>
      )}

      {page === 'news' && (
        <main className="wrap"><section className="block">
          <span className="tag">News &amp; announcements</span><h2>Newsroom</h2>
          {dataSource === 'sample' && <SampleBanner />}
          <div className="filters">
            {categories.map((c) => (
              <button key={c} className={newsCategory === c ? 'active' : ''} onClick={() => setNewsCategory(c)}>{c}</button>
            ))}
          </div>
          {visibleNews.length === 0 ? <div className="empty">No published articles in this category yet.</div> : (
            <div className="grid three">
              {visibleNews.map((n) => (
                <article className="card" key={n.id}>
                  {n.imageUrl && <img className="news-img" src={n.imageUrl} alt="" loading="lazy" />}
                  <span className="tag sample">{n.category}</span><h3>{n.title}</h3>
                  <p className="muted small">{n.date}</p><p className="small">{n.excerpt}</p>
                  <button className="btn smallbtn" onClick={() => setSelectedArticle(n)}>Read article</button>
                </article>
              ))}
            </div>
          )}
        </section></main>
      )}

      {page === 'contact' && (
        <main className="wrap"><section className="block">
          <span className="tag">Contact</span><h2>Contact the club</h2>
          <div className="grid two">
            <div className="card">
              <h3>Official details</h3>
              <p><strong>Club:</strong> {settings.clubName} ({settings.shortName})</p>
              <p><strong>Email:</strong> {settings.contactEmail ? <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a> : <span className="muted">To be confirmed — not yet supplied</span>}</p>
              <p><strong>Phone:</strong> {settings.contactPhone || <span className="muted">To be confirmed — not yet supplied</span>}</p>
              <p><strong>Location:</strong> {settings.location || <span className="muted">To be confirmed — not yet supplied</span>}</p>
              <p><strong>Social media:</strong></p>
              <SocialLinks links={settings.socialLinks} />
              {dataSource === 'sample' && <div className="banner" style={{marginTop: '1rem'}}>Do not publish invented contact details. Fill in the real details in Admin → Settings once Supabase is connected.</div>}
            </div>
            <div className="card">
              <h3>Send a message</h3>
              <p className="muted small">This form prepares a draft in your browser. It does not send email, because no email backend is configured in this project.</p>
              <ContactForm clubName={settings.clubName} contactEmail={settings.contactEmail} />
            </div>
          </div>
        </section></main>
      )}

      {page === 'admin' && (
        <main className="wrap"><section className="block">
          <span className="tag">Admin panel</span>
          <h2>Admin dashboard</h2>
          {!isSupabaseConfigured && (
            <div>
              <BackendBanner />
              <h3>Setup — do this once, from your phone</h3>
              <ol style={{ lineHeight: '1.8' }}>
                <li>Create a free project at supabase.com, then open <strong>SQL Editor → New query</strong> and run <code>supabase/schema.sql</code>, then <code>supabase/schema-v2.sql</code> from this project.</li>
                <li>In Supabase <strong>Storage</strong>, confirm the public bucket <code>club-images</code> exists (the v2 SQL creates it).</li>
                <li>In Supabase <strong>Authentication → Users → Add user</strong>, create the admin account, copy its UUID, and run: <code>insert into public.admin_roles (user_id, role) values ('&lt;uuid&gt;', 'admin');</code></li>
                <li>Copy <strong>Project URL</strong> and the <strong>anon / public key</strong> from Project Settings → API. Never use the service_role key.</li>
                <li>In Cloudflare Pages → your site → <strong>Settings → Environment variables (Production)</strong>, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then redeploy.</li>
                <li>Open <code>/admin</code> on your phone and sign in. Full steps: <code>docs/DEPLOYMENT.md</code>.</li>
              </ol>
              <pre style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-surface)', padding: 12, fontSize: '.85rem' }}>{`VITE_SUPABASE_URL=https://your-project-ref.supabase.co\nVITE_SUPABASE_ANON_KEY=your-supabase-anon-public-key-here`}</pre>
              <p className="muted small">Until those steps are done, the public site keeps showing clearly labelled sample data and no admin changes are saved anywhere.</p>
            </div>
          )}
          {isSupabaseConfigured && authLoading && <div className="banner" role="status">Checking your session…</div>}
          {isSupabaseConfigured && !authLoading && !isAdmin && (
            <div className="card" style={{ maxWidth: 520 }}>
              <h3>Admin sign-in</h3>
              <p className="muted small">Only administrators listed in Supabase <code>admin_roles</code> can sign in here. Visitors cannot reach any admin table without this login.</p>
              <form onSubmit={doLogin}>
                <label htmlFor="admin-email">Email</label>
                <input id="admin-email" type="email" autoComplete="username" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
                <label htmlFor="admin-password">Password</label>
                <input id="admin-password" type="password" autoComplete="current-password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                {authError && <div className="banner backend" role="alert">{authError}</div>}
                {authNotice && <div className="banner" role="status">{authNotice}</div>}
                <p style={{ marginTop: 16 }}><button className="btn" type="submit">Sign in</button></p>
              </form>
              <p className="muted small">Forgot your password? Reset it in Supabase Authentication → Users. This site has no password-reset email of its own.</p>
            </div>
          )}
          {isSupabaseConfigured && isAdmin && (
            <div>
              <p className="muted" style={{ marginBottom: '2rem' }}>Signed in as <strong>{authUserEmail}</strong> • Data source: Supabase (changes save permanently and update the public site). <button className="btn smallbtn ghost" style={{marginLeft:'1rem'}} onClick={doLogout}>Log out</button></p>
              <div className="admin">
                <nav className="filters" aria-label="Admin navigation">
                  {(['overview', 'players', 'banners', 'matches', 'news', 'management', 'social', 'settings'] as AdminTab[]).map((t) => (
                    <button key={t} className={adminTab === t ? 'active' : ''} onClick={() => { setAdminTab(t); setAdminNotice(''); setAdminError('') }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                  ))}
                </nav>
                <div className="admin main">
                  {adminNotice && <div className="banner" role="status">{adminNotice}</div>}
                  {adminError && <div className="banner backend" role="alert">{adminError}</div>}
                  {saving && <div className="banner" role="status">Saving…</div>}

                  {adminTab === 'overview' && (
                    <div>
                      <h3>Overview</h3>
                      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                        <div className="card"><div className="stat-num">{players.length}</div><div className="stat-label">Total players</div></div>
                        <div className="card"><div className="stat-num">{staff.length}</div><div className="stat-label">Management members</div></div>
                        <div className="card"><div className="stat-num">{stats.played}</div><div className="stat-label">Matches played</div></div>
                        <div className="card"><div className="stat-num">{upcoming.length}</div><div className="stat-label">Upcoming matches</div></div>
                        <div className="card"><div className="stat-num">{stats.wins}W • {stats.draws}D • {stats.losses}L</div><div className="stat-label">Record</div></div>
                        <div className="card"><div className="stat-num">{publishedNews.length}</div><div className="stat-label">Published news</div></div>
                        <div className="card"><div className="stat-num">{banners.filter((b) => b.isActive).length}</div><div className="stat-label">Active banners</div></div>
                        <div className="card"><div className="stat-num">{enabledSocialCount}</div><div className="stat-label">Social links enabled</div></div>
                      </div>
                      <h3 style={{ marginTop: 24 }}>Quick actions</h3>
                      <p className="filters">
                        <button className="btn smallbtn" onClick={() => setAdminTab('players')}>Add player</button>
                        <button className="btn smallbtn ghost" onClick={() => setAdminTab('matches')}>Add match</button>
                        <button className="btn smallbtn ghost" onClick={() => setAdminTab('banners')}>Add banner</button>
                        <button className="btn smallbtn ghost" onClick={() => setAdminTab('news')}>Add news</button>
                      </p>
                      <h3>Recent matches</h3>
                      {matches.length === 0 ? <div className="empty">No matches yet.</div> : (
                        <div className="table-wrap"><table>
                          <thead><tr><th>Date</th><th>Match</th><th>Score</th><th>Status</th></tr></thead>
                          <tbody>{[...sortedMatches].reverse().slice(0, 5).map((m) => (
                            <tr key={m.id}><td>{m.date}</td><td>BRS vs {m.opponent}</td><td>{m.status === 'completed' || m.status === 'live' ? `${m.brsScore ?? '—'} – ${m.opponentScore ?? '—'}` : '—'}</td><td>{m.status}</td></tr>
                          ))}</tbody>
                        </table></div>
                      )}
                    </div>
                  )}

                  {adminTab === 'players' && (
                    <div>
                      <h3>Player management</h3>
                      <label htmlFor="admin-search">Search players</label>
                      <input id="admin-search" value={adminSearch} onChange={(e) => setAdminSearch(e.target.value)} placeholder="Search by name or position" />
                      <form onSubmit={(e) => { e.preventDefault(); if (!playerForm.name.trim()) { setAdminError('Player name is required.'); return } adminSave(() => savePlayer(playerForm, playerForm.id || undefined).then(() => setPlayerForm(emptyPlayer)), playerForm.id ? 'Player updated. The public squad is updated.' : 'Player added. The public squad is updated.') }}>
                        <div className="form-grid">
                          <div><label>Full name *</label><input value={playerForm.name} onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })} /></div>
                          <div><label>Jersey number *</label><input type="number" min={0} max={99} value={playerForm.number} onChange={(e) => setPlayerForm({ ...playerForm, number: Number(e.target.value) })} /></div>
                          <div><label>Position *</label><select value={playerForm.position} onChange={(e) => setPlayerForm({ ...playerForm, position: e.target.value as Position })}><option>Goalkeeper</option><option>Defender</option><option>Midfielder</option><option>Forward</option></select></div>
                          <div><label>Nationality</label><input value={playerForm.nationality} onChange={(e) => setPlayerForm({ ...playerForm, nationality: e.target.value })} /></div>
                          <div><label>Date of birth</label><input type="date" value={playerForm.dateOfBirth || ''} onChange={(e) => setPlayerForm({ ...playerForm, dateOfBirth: e.target.value || null })} /></div>
                          <div><label>Appearances (optional)</label><input type="number" min={0} value={playerForm.appearances ?? ''} onChange={(e) => setPlayerForm({ ...playerForm, appearances: numOrNull(e.target.value) })} /></div>
                          <div><label>Goals (optional)</label><input type="number" min={0} value={playerForm.goals ?? ''} onChange={(e) => setPlayerForm({ ...playerForm, goals: numOrNull(e.target.value) })} /></div>
                          <div><label>Assists (optional)</label><input type="number" min={0} value={playerForm.assists ?? ''} onChange={(e) => setPlayerForm({ ...playerForm, assists: numOrNull(e.target.value) })} /></div>
                        </div>
                        <label>Biography</label><textarea value={playerForm.bio} onChange={(e) => setPlayerForm({ ...playerForm, bio: e.target.value })} />
                        <ImagePicker label="Player photo (JPG, PNG or WebP, max 5 MB)" value={playerForm.portraitUrl || ''} folder="players" onChange={(url) => setPlayerForm({ ...playerForm, portraitUrl: url || null })} />
                        <p style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', margin: '1rem 0' }}>
                          <label><input type="checkbox" checked={playerForm.captain} onChange={(e) => setPlayerForm({ ...playerForm, captain: e.target.checked })} /> Captain</label>
                          <label><input type="checkbox" checked={playerForm.viceCaptain} onChange={(e) => setPlayerForm({ ...playerForm, viceCaptain: e.target.checked })} /> Vice-captain</label>
                          <label><input type="checkbox" checked={playerForm.published} onChange={(e) => setPlayerForm({ ...playerForm, published: e.target.checked })} /> Published</label>
                          <label><input type="checkbox" checked={playerForm.featured} onChange={(e) => setPlayerForm({ ...playerForm, featured: e.target.checked })} /> Featured</label>
                          <label><input type="checkbox" checked={playerForm.isActive} onChange={(e) => setPlayerForm({ ...playerForm, isActive: e.target.checked })} /> Active</label>
                        </p>
                        <p><button className="btn" type="submit" disabled={saving}>{playerForm.id ? 'Update player' : 'Add player'}</button>{' '}
                          {playerForm.id && <button type="button" className="btn ghost" onClick={() => setPlayerForm(emptyPlayer)}>Cancel edit</button>}</p>
                      </form>
                      <div className="table-wrap"><table>
                        <thead><tr><th>Name</th><th>No.</th><th>Position</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{players.filter((p) => (p.name + ' ' + p.position).toLowerCase().includes(adminSearch.toLowerCase())).map((p) => (
                          <tr key={p.id}>
                            <td>{p.name}{p.captain ? ' (C)' : ''}{p.viceCaptain ? ' (VC)' : ''}</td><td>{p.number}</td><td>{p.position}</td><td>{p.published ? (p.isActive ? 'Pub/Active' : 'Pub/Inactive') : 'Draft'}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn smallbtn" onClick={() => setPlayerForm(p)}>Edit</button>
                              <button className="btn smallbtn danger" onClick={() => { if (confirmDelete(p.name)) adminSave(() => deletePlayer(p.id), 'Player deleted. The public squad is updated.') }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      {players.length === 0 && <div className="empty">No players yet. Add the first player above.</div>}
                    </div>
                  )}

                  {adminTab === 'banners' && (
                    <div>
                      <h3>Hero banner management</h3>
                      <p className="muted small">The first active banner (lowest order) is shown on the home hero. Preview an image below before you publish it — the preview is temporary; pressing “Upload image” saves it to Supabase Storage and the stored public URL is what visitors see after reload.</p>
                      <form onSubmit={(e) => { e.preventDefault(); if (!bannerForm.imageUrl.trim()) { setAdminError('A banner image is required. Upload one or paste its URL.'); return } adminSave(() => saveBanner(bannerForm, bannerForm.id || undefined).then(() => setBannerForm({ id: '', imageUrl: '', headline: '', subtitle: '', buttonText: '', buttonUrl: '', isActive: false, displayOrder: 0 })), 'Banner saved.') }}>
                        <ImagePicker label="Banner image (JPG, PNG or WebP, max 5 MB) *" value={bannerForm.imageUrl} folder="banners" onChange={(url) => setBannerForm({ ...bannerForm, imageUrl: url })} />
                        <label>Headline</label><input value={bannerForm.headline} onChange={(e) => setBannerForm({ ...bannerForm, headline: e.target.value })} placeholder="Leave blank to use the club headline" />
                        <label>Subtitle</label><input value={bannerForm.subtitle} onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })} />
                        <div className="form-grid">
                          <div><label>Button text</label><input value={bannerForm.buttonText} onChange={(e) => setBannerForm({ ...bannerForm, buttonText: e.target.value })} placeholder="e.g. Meet the squad" /></div>
                          <div><label>Button URL</label><input value={bannerForm.buttonUrl} onChange={(e) => setBannerForm({ ...bannerForm, buttonUrl: e.target.value })} placeholder="/squad or https://…" /></div>
                        </div>
                        <label>Order (lowest first)</label><input type="number" value={bannerForm.displayOrder} onChange={(e) => setBannerForm({ ...bannerForm, displayOrder: Number(e.target.value) })} />
                        <p style={{ margin: '1rem 0' }}><label><input type="checkbox" checked={bannerForm.isActive} onChange={(e) => setBannerForm({ ...bannerForm, isActive: e.target.checked })} /> Active — show on the home hero</label></p>
                        <p><button className="btn" type="submit" disabled={saving}>{bannerForm.id ? 'Update banner' : 'Add banner'}</button>{' '}
                          {bannerForm.id && <button type="button" className="btn ghost" onClick={() => setBannerForm({ id: '', imageUrl: '', headline: '', subtitle: '', buttonText: '', buttonUrl: '', isActive: false, displayOrder: 0 })}>Cancel edit</button>}</p>
                      </form>
                      <div className="table-wrap"><table>
                        <thead><tr><th>Order</th><th>Headline</th><th>Active</th><th>Actions</th></tr></thead>
                        <tbody>{[...banners].sort((a, b) => a.displayOrder - b.displayOrder).map((b) => (
                          <tr key={b.id}><td>{b.displayOrder}</td><td>{b.headline || '(club headline)'}</td><td>{b.isActive ? 'Yes' : 'No'}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn smallbtn" onClick={() => setBannerForm(b)}>Edit</button>
                              <button className="btn smallbtn ghost" onClick={() => adminSave(() => saveBanner({ ...b, isActive: !b.isActive }, b.id), b.isActive ? 'Banner deactivated.' : 'Banner activated.')}>{b.isActive ? 'Deactivate' : 'Activate'}</button>
                              <button className="btn smallbtn danger" onClick={() => { if (confirmDelete('this banner')) adminSave(() => deleteBanner(b.id), 'Banner deleted.') }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      {banners.length === 0 && <div className="empty">No banners yet. The home hero uses the cinematic navy/teal design until you add one.</div>}
                    </div>
                  )}

                  {adminTab === 'matches' && (
                    <div>
                      <h3>Match and fixture management</h3>
                      <form onSubmit={(e) => { e.preventDefault(); if (!matchForm.opponent.trim()) { setAdminError('Opponent name is required.'); return } if (!matchForm.date) { setAdminError('Match date is required.'); return } if (matchForm.status === 'completed' && (matchForm.brsScore === null || matchForm.opponentScore === null)) { setAdminError('A completed match needs both scores.'); return } adminSave(() => saveMatch(matchForm, matchForm.id || undefined).then(() => setMatchForm({ id: '', opponent: '', opponentLogoUrl: null, date: '', kickoff: '16:00', venue: '', competition: '', homeOrAway: 'Home', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' })), 'Match saved. Fixtures, results and statistics are updated.') }}>
                        <div className="form-grid">
                          <div><label>Opponent *</label><input value={matchForm.opponent} onChange={(e) => setMatchForm({ ...matchForm, opponent: e.target.value })} /></div>
                          <div><label>Competition</label><input value={matchForm.competition} onChange={(e) => setMatchForm({ ...matchForm, competition: e.target.value })} placeholder="e.g. League, Cup" /></div>
                          <div><label>Date *</label><input type="date" value={matchForm.date} onChange={(e) => setMatchForm({ ...matchForm, date: e.target.value })} /></div>
                          <div><label>Kickoff</label><input type="time" value={matchForm.kickoff} onChange={(e) => setMatchForm({ ...matchForm, kickoff: e.target.value })} /></div>
                          <div><label>Venue</label><input value={matchForm.venue} onChange={(e) => setMatchForm({ ...matchForm, venue: e.target.value })} /></div>
                          <div><label>Home / Away</label><select value={matchForm.homeOrAway} onChange={(e) => setMatchForm({ ...matchForm, homeOrAway: e.target.value as 'Home' | 'Away' })}><option>Home</option><option>Away</option></select></div>
                          <div><label>Status *</label><select value={matchForm.status} onChange={(e) => setMatchForm({ ...matchForm, status: e.target.value as Match['status'] })}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="completed">Completed</option></select></div>
                          <div><label>BRS score</label><input type="number" min={0} value={matchForm.brsScore ?? ''} onChange={(e) => setMatchForm({ ...matchForm, brsScore: numOrNull(e.target.value) })} /></div>
                          <div><label>Opponent score</label><input type="number" min={0} value={matchForm.opponentScore ?? ''} onChange={(e) => setMatchForm({ ...matchForm, opponentScore: numOrNull(e.target.value) })} /></div>
                        </div>
                        <label>Goalscorers (optional, e.g. “Player Name 23', Player Name 67'”)</label><input value={matchForm.goalscorers} onChange={(e) => setMatchForm({ ...matchForm, goalscorers: e.target.value })} />
                        <label>Match summary / report (optional)</label><textarea value={matchForm.report} onChange={(e) => setMatchForm({ ...matchForm, report: e.target.value })} />
                        <ImagePicker label="Opponent logo (optional, JPG/PNG/WebP, max 5 MB)" value={matchForm.opponentLogoUrl || ''} folder="opponents" onChange={(url) => setMatchForm({ ...matchForm, opponentLogoUrl: url || null })} />
                        <p><button className="btn" type="submit" disabled={saving}>{matchForm.id ? 'Update match' : 'Add match'}</button>{' '}
                          {matchForm.id && <button type="button" className="btn ghost" onClick={() => setMatchForm({ id: '', opponent: '', opponentLogoUrl: null, date: '', kickoff: '16:00', venue: '', competition: '', homeOrAway: 'Home', status: 'upcoming', brsScore: null, opponentScore: null, report: '', goalscorers: '' })}>Cancel edit</button>}</p>
                      </form>
                      <div className="table-wrap"><table>
                        <thead><tr><th>Date</th><th>Match</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{[...sortedMatches].reverse().map((m) => (
                          <tr key={m.id}><td>{m.date}</td><td>BRS vs {m.opponent}</td><td>{m.status === 'completed' || m.status === 'live' ? `${m.brsScore ?? '—'} – ${m.opponentScore ?? '—'}` : 'Upcoming'}</td><td>{m.status}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn smallbtn" onClick={() => setMatchForm(m)}>Edit</button>
                              <button className="btn smallbtn danger" onClick={() => { if (confirmDelete(`the match vs ${m.opponent}`)) adminSave(() => deleteMatch(m.id), 'Match deleted.') }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      {matches.length === 0 && <div className="empty">No matches yet.</div>}
                    </div>
                  )}

                  {adminTab === 'news' && (
                    <div>
                      <h3>News and announcements</h3>
                      <form onSubmit={(e) => { e.preventDefault(); if (!newsForm.title.trim()) { setAdminError('News title is required.'); return } if (!newsForm.date) { setAdminError('Published date is required.'); return } adminSave(() => saveNews(newsForm, newsForm.id || undefined).then(() => setNewsForm({ id: '', title: '', category: 'Club Event', date: new Date().toISOString().slice(0, 10), excerpt: '', body: '', published: true, imageUrl: null })), 'News article saved.') }}>
                        <label>Title *</label><input value={newsForm.title} onChange={(e) => setNewsForm({ ...newsForm, title: e.target.value })} />
                        <div className="form-grid">
                          <div><label>Category *</label><select value={newsForm.category} onChange={(e) => setNewsForm({ ...newsForm, category: e.target.value as NewsArticle['category'] })}>{NEWS_CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
                          <div><label>Published date *</label><input type="date" value={newsForm.date} onChange={(e) => setNewsForm({ ...newsForm, date: e.target.value })} /></div>
                        </div>
                        <label>Excerpt</label><textarea value={newsForm.excerpt} onChange={(e) => setNewsForm({ ...newsForm, excerpt: e.target.value })} />
                        <label>Body</label><textarea value={newsForm.body} onChange={(e) => setNewsForm({ ...newsForm, body: e.target.value })} />
                        <ImagePicker label="Article image (optional, JPG/PNG/WebP, max 5 MB)" value={newsForm.imageUrl || ''} folder="news" onChange={(url) => setNewsForm({ ...newsForm, imageUrl: url || null })} />
                        <p style={{ margin: '1rem 0' }}><label><input type="checkbox" checked={newsForm.published} onChange={(e) => setNewsForm({ ...newsForm, published: e.target.checked })} /> Published</label></p>
                        <p><button className="btn" type="submit" disabled={saving}>{newsForm.id ? 'Update article' : 'Add article'}</button>{' '}
                          {newsForm.id && <button type="button" className="btn ghost" onClick={() => setNewsForm({ id: '', title: '', category: 'Club Event', date: new Date().toISOString().slice(0, 10), excerpt: '', body: '', published: true, imageUrl: null })}>Cancel edit</button>}</p>
                      </form>
                      <div className="table-wrap"><table>
                        <thead><tr><th>Date</th><th>Title</th><th>Category</th><th>Published</th><th>Actions</th></tr></thead>
                        <tbody>{news.map((n) => (
                          <tr key={n.id}><td>{n.date}</td><td>{n.title}</td><td>{n.category}</td><td>{n.published ? 'Yes' : 'No'}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn smallbtn" onClick={() => setNewsForm(n)}>Edit</button>
                              <button className="btn smallbtn danger" onClick={() => { if (confirmDelete(`“${n.title}”`)) adminSave(() => deleteNews(n.id), 'News article deleted.') }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      {news.length === 0 && <div className="empty">No news articles yet.</div>}
                    </div>
                  )}

                  {adminTab === 'management' && (
                    <div>
                      <h3>Management and club staff</h3>
                      <form onSubmit={(e) => { e.preventDefault(); if (!staffForm.name.trim() || !staffForm.role.trim()) { setAdminError('Management name and role are required.'); return } adminSave(() => saveStaff(staffForm, staffForm.id || undefined).then(() => setStaffForm({ id: '', name: '', role: 'Head Coach', bio: '', order: 0, portraitUrl: null, published: true })), 'Management member saved.') }}>
                        <div className="form-grid">
                          <div><label>Full name *</label><input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></div>
                          <div><label>Role *</label><input value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} placeholder="e.g. Head Coach" /></div>
                          <div><label>Display order</label><input type="number" value={staffForm.order} onChange={(e) => setStaffForm({ ...staffForm, order: Number(e.target.value) })} /></div>
                        </div>
                        <label>Biography</label><textarea value={staffForm.bio} onChange={(e) => setStaffForm({ ...staffForm, bio: e.target.value })} />
                        <ImagePicker label="Portrait (optional, JPG/PNG/WebP, max 5 MB)" value={staffForm.portraitUrl || ''} folder="management" onChange={(url) => setStaffForm({ ...staffForm, portraitUrl: url || null })} />
                        <p style={{ margin: '1rem 0' }}><label><input type="checkbox" checked={staffForm.published} onChange={(e) => setStaffForm({ ...staffForm, published: e.target.checked })} /> Published</label></p>
                        <p><button className="btn" type="submit" disabled={saving}>{staffForm.id ? 'Update member' : 'Add member'}</button>{' '}
                          {staffForm.id && <button type="button" className="btn ghost" onClick={() => setStaffForm({ id: '', name: '', role: 'Head Coach', bio: '', order: 0, portraitUrl: null, published: true })}>Cancel edit</button>}</p>
                      </form>
                      <div className="table-wrap"><table>
                        <thead><tr><th>Order</th><th>Name</th><th>Role</th><th>Actions</th></tr></thead>
                        <tbody>{[...staff].sort((a, b) => a.order - b.order).map((s) => (
                          <tr key={s.id}><td>{s.order}</td><td>{s.name}</td><td>{s.role}</td>
                            <td style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn smallbtn" onClick={() => setStaffForm(s)}>Edit</button>
                              <button className="btn smallbtn danger" onClick={() => { if (confirmDelete(s.name)) adminSave(() => deleteStaff(s.id), 'Management member deleted.') }}>Delete</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table></div>
                      {staff.length === 0 && <div className="empty">No management members yet.</div>}
                    </div>
                  )}

                  {adminTab === 'social' && (
                    <div>
                      <h3>Social media settings</h3>
                      <p className="muted small">These links are loaded from saved website settings — they are not hardcoded in the public components. Each enabled link opens in a new tab from the footer and the home social section.</p>
                      <form onSubmit={(e) => { e.preventDefault(); adminSave(() => saveSettings(settingsForm), 'Social links saved. The public footer and social section are updated.') }}>
                        {(['facebook', 'instagram', 'youtube', 'tiktok'] as const).map((k) => (
                          <div key={k} style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <label>{k.charAt(0).toUpperCase() + k.slice(1)} URL</label>
                            <input placeholder={`https://${k}.com/…`} value={settingsForm.socialLinks[k].url} onChange={(e) => setSettingsForm({ ...settingsForm, socialLinks: { ...settingsForm.socialLinks, [k]: { ...settingsForm.socialLinks[k], url: e.target.value } } })} />
                            <label><input type="checkbox" checked={settingsForm.socialLinks[k].enabled} onChange={(e) => setSettingsForm({ ...settingsForm, socialLinks: { ...settingsForm.socialLinks, [k]: { ...settingsForm.socialLinks[k], enabled: e.target.checked } } })} /> Show this link on the public site</label>
                          </div>
                        ))}
                        <p><button className="btn" type="submit" disabled={saving}>Save social links</button></p>
                      </form>
                    </div>
                  )}

                  {adminTab === 'settings' && (
                    <div>
                      <h3>Website branding and club settings</h3>
                      <form onSubmit={(e) => { e.preventDefault(); if (!settingsForm.clubName.trim()) { setAdminError('Club name is required.'); return } adminSave(() => saveSettings(settingsForm), 'Club settings saved. The public site is updated.') }}>
                        <div className="form-grid">
                          <div><label>Club name *</label><input value={settingsForm.clubName} onChange={(e) => setSettingsForm({ ...settingsForm, clubName: e.target.value })} /></div>
                          <div><label>Short name</label><input value={settingsForm.shortName} onChange={(e) => setSettingsForm({ ...settingsForm, shortName: e.target.value })} /></div>
                        </div>
                        <label>Club description</label><textarea value={settingsForm.description} onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })} />
                        <label>Hero headline</label><input value={settingsForm.heroHeadline} onChange={(e) => setSettingsForm({ ...settingsForm, heroHeadline: e.target.value })} />
                        <label>Hero subtitle</label><input value={settingsForm.heroSubtitle} onChange={(e) => setSettingsForm({ ...settingsForm, heroSubtitle: e.target.value })} />
                        <ImagePicker label="Club logo (JPG/PNG/WebP, max 5 MB) — changing this replaces the header, hero and footer logo" value={settingsForm.logoUrl || ''} folder="branding" onChange={(url) => setSettingsForm({ ...settingsForm, logoUrl: url || null })} />
                        <p className="muted small">The original official logo in <code>public/logo.png</code> is kept in the project. Uploading a new logo here only changes the live site setting.</p>
                        <div className="form-grid">
                          <div><label>Contact email</label><input type="email" value={settingsForm.contactEmail} onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })} /></div>
                          <div><label>Contact phone</label><input value={settingsForm.contactPhone} onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })} /></div>
                        </div>
                        <label>Location</label><input value={settingsForm.location} onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })} />
                        <label>Footer text</label><input value={settingsForm.footerText} onChange={(e) => setSettingsForm({ ...settingsForm, footerText: e.target.value })} />
                        <p><button className="btn" type="submit" disabled={saving}>Save club settings</button></p>
                      </form>
                      <h3 style={{marginTop: '2rem'}}>Branding</h3>
                      <p className="muted small">Dark Navy #061321, Deep Teal #00E6C3, White #F5F7FA — defined in <code>src/styles.css</code>. Colours are not editable from the admin panel, so the club identity cannot drift by accident.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section></main>
      )}

      {selectedPlayer && (
        <div className="modal-back" onClick={() => setSelectedPlayer(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedPlayer(null)}>Close</button>
            {selectedPlayer.portraitUrl && <img className="preview-img" style={{maxHeight:'150px'}} src={selectedPlayer.portraitUrl} alt={`${selectedPlayer.name} portrait`} />}
            <span className="tag">{selectedPlayer.position}</span>
            <h2 style={{color: 'var(--accent-teal)'}}>{selectedPlayer.name}</h2>
            <p><strong>Jersey number:</strong> {selectedPlayer.number}</p>
            <p><strong>Nationality:</strong> {selectedPlayer.nationality}</p>
            {ageFromDob(selectedPlayer.dateOfBirth) !== null && <p><strong>Age:</strong> {ageFromDob(selectedPlayer.dateOfBirth)}</p>}
            {selectedPlayer.captain && <p><strong>Captain</strong></p>}
            {selectedPlayer.viceCaptain && <p><strong>Vice-Captain</strong></p>}
            {(selectedPlayer.appearances !== null || selectedPlayer.goals !== null || selectedPlayer.assists !== null) && (
              <p><strong>Record:</strong> {selectedPlayer.appearances ?? '—'} appearances • {selectedPlayer.goals ?? '—'} goals • {selectedPlayer.assists ?? '—'} assists</p>
            )}
            <p style={{marginTop: '1rem'}}>{selectedPlayer.bio}</p>
            {dataSource === 'sample' && <p className="muted small">Sample placeholder profile. Replace with real player information.</p>}
          </div>
        </div>
      )}
      {selectedArticle && (
        <div className="modal-back" onClick={() => setSelectedArticle(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedArticle(null)}>Close</button>
            {selectedArticle.imageUrl && <img className="news-img" src={selectedArticle.imageUrl} alt="" />}
            <span className="tag sample">{selectedArticle.category}</span>
            <h2 style={{color: 'var(--accent-teal)'}}>{selectedArticle.title}</h2>
            <p className="muted small">{selectedArticle.date}</p>
            <p style={{marginTop: '1rem', whiteSpace: 'pre-wrap'}}>{selectedArticle.body}</p>
            {dataSource === 'sample' && <p className="muted small">Sample article. Replace with real club news.</p>}
          </div>
        </div>
      )}
      {selectedMatch && (
        <div className="modal-back" onClick={() => setSelectedMatch(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedMatch(null)}>Close</button>
            <span className="tag">{selectedMatch.competition || selectedMatch.homeOrAway}</span>
            <h2 style={{color: 'var(--accent-teal)'}}>BRS vs {selectedMatch.opponent}</h2>
            {selectedMatch.status === 'completed' || selectedMatch.status === 'live' ? <p style={{fontFamily:'Oswald, sans-serif', fontSize:'2rem'}}>BRS {selectedMatch.brsScore ?? '—'} — {selectedMatch.opponentScore ?? '—'} {selectedMatch.opponent}</p> : <p style={{fontFamily:'Oswald, sans-serif', fontSize:'1.5rem'}}>vs {selectedMatch.opponent}</p>}
            <p className="muted small">{selectedMatch.date} • Kickoff {selectedMatch.kickoff} • {selectedMatch.venue}</p>
            {selectedMatch.goalscorers && <p style={{marginTop: '1rem'}}><strong>Goalscorers:</strong> {selectedMatch.goalscorers}</p>}
            {selectedMatch.report && <p style={{marginTop: '1rem', whiteSpace: 'pre-wrap'}}>{selectedMatch.report}</p>}
          </div>
        </div>
      )}

      <footer className="site">
        <div className="wrap foot">
          <div>
            <img src={logoSrc} alt={`${settings.clubName} official logo`} />
            <h3 style={{ marginBottom: 4 }}>{settings.clubName}</h3>
            <p className="muted small">{settings.footerText}<br />English-only official club website.</p>
          </div>
          <div>
            <p><strong>Explore</strong></p>
            {PAGES.map((p) => <p key={p.id} style={{ margin: '4px 0' }}><button style={{ background: 'none', border: 0, color: 'var(--accent-teal)', textTransform: 'uppercase', fontFamily: 'Oswald, sans-serif', padding: 0, cursor: 'pointer' }} onClick={() => go(p.id)}>{p.label}</button></p>)}
          </div>
          <div>
            <p><strong>Contact</strong></p>
            <p className="muted small">
              {settings.contactEmail ? <>Email: <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a><br /></> : <>Email: To be confirmed<br /></>}
              {settings.contactPhone ? <>Phone: {settings.contactPhone}<br /></> : <>Phone: To be confirmed<br /></>}
              {settings.location ? <>Location: {settings.location}<br /></> : <>Location: To be confirmed<br /></>}
            </p>
            <SocialLinks links={settings.socialLinks} />
            <p style={{marginTop: '1.5rem'}}><button className="btn smallbtn ghost" onClick={() => go('admin')}>Admin</button></p>
          </div>
        </div>
        <div className="wrap"><p className="muted small" style={{textAlign: 'center', paddingBottom: '1rem'}}>© {settings.clubName}. {dataSource === 'sample' ? 'Sample data only in this build until Supabase is connected — see Admin → Setup.' : 'Live data from Supabase.'}</p></div>
      </footer>
    </div>
  )
}

function ContactForm({ clubName, contactEmail }: { clubName: string; contactEmail: string }) {
  const [contact, setContact] = useState({ name: '', email: '', subject: '', message: '' })
  const [errors, setErrors] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!contact.name.trim()) errs.push('Please enter your name.')
    if (!contact.email.trim()) errs.push('Please enter your email address.')
    if (!contact.subject.trim()) errs.push('Please enter a subject.')
    if (!contact.message.trim()) errs.push('Please enter your message.')
    setErrors(errs)
    if (errs.length) { setDraft(''); return }
    setDraft(`To: ${clubName}${contactEmail ? ` <${contactEmail}>` : ' (contact details to be confirmed)'}\nFrom: ${contact.name} <${contact.email}>\nSubject: ${contact.subject}\n\n${contact.message}\n\n— This draft was prepared in the browser only. It was NOT sent by email, because no email backend is configured in this project.`)
  }
  function download() {
    const blob = new Blob([draft], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'brs-contact-draft.txt'; a.click(); URL.revokeObjectURL(url)
  }
  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="c-name">Name</label>
      <input id="c-name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />
      <label htmlFor="c-email">Email</label>
      <input id="c-email" type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} />
      <label htmlFor="c-subject">Subject</label>
      <input id="c-subject" value={contact.subject} onChange={(e) => setContact({ ...contact, subject: e.target.value })} />
      <label htmlFor="c-message">Message</label>
      <textarea id="c-message" rows={4} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} />
      {errors.length > 0 && <div className="banner backend" role="alert">{errors.map((er) => <div key={er}>{er}</div>)}</div>}
      <p style={{ marginTop: 16 }}><button className="btn" type="submit">Prepare message draft</button></p>
      {draft && (
        <div style={{ marginTop: '1.5rem', background: 'var(--bg-navy)', padding: '1rem', border: '1px solid var(--border-color)' }}>
          <p><strong>Message draft prepared.</strong> It was not sent.</p>
          <pre style={{ whiteSpace: 'pre-wrap', padding: '12px 0', fontSize: '.85rem' }}>{draft}</pre>
          <button type="button" className="btn smallbtn" onClick={() => navigator.clipboard?.writeText(draft).catch(() => {})}>Copy draft</button>{' '}
          <button type="button" className="btn smallbtn ghost" onClick={download}>Download draft</button>
        </div>
      )}
    </form>
  )
}
