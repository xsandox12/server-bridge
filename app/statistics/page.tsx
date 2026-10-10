'use client'

import { useEffect, useState } from 'react'

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }

type ProjectId = 'bubblechat' | 'hex21' | 'necrodance' | 'mindmaper' | 'game-factory'

const PROJECTS: { id: ProjectId; label: string; icon: string }[] = [
  { id: 'bubblechat', label: '버블타자', icon: '🫧' },
  { id: 'hex21', label: 'Hex21', icon: '🎴' },
  { id: 'necrodance', label: '네크로댄스', icon: '💀' },
  { id: 'mindmaper', label: '마인드매퍼', icon: '🧠' },
  { id: 'game-factory', label: '게임 공장', icon: '🏭' },
]

export default function StatisticsPage() {
  const [project, setProject] = useState<ProjectId>('bubblechat')

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">통계</h1>
        <div className="flex gap-2 flex-wrap">
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProject(p.id)}
              className="text-sm px-4 py-2 rounded-lg font-medium"
              style={{
                background: project === p.id ? 'var(--accent)' : 'var(--card)',
                color: project === p.id ? '#fff' : 'var(--foreground)',
                border: '1px solid var(--card-border)',
              }}
            >
              {p.icon} {p.label}
            </button>
          ))}
        </div>
      </div>

      {project === 'bubblechat' && <BubbleChatStats />}
      {project === 'hex21' && <Hex21Stats />}
      {project === 'necrodance' && <NecrodanceStats />}
      {project === 'mindmaper' && <MindmaperStats />}
      {project === 'game-factory' && <GameFactoryStats />}
    </div>
  )
}

// ── 공용 조각 ──

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-4" style={card}>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5" style={card}>
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      {children}
    </section>
  )
}

function RefreshHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold">현황</h2>
      <button
        onClick={onRefresh}
        className="text-sm px-4 py-2 rounded-lg"
        style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
      >
        새로고침
      </button>
    </div>
  )
}

function DailyTable({ rows, columns }: { rows: Record<string, string | number>[]; columns: { key: string; label: string }[] }) {
  if (rows.length === 0) return <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--muted)' }} className="text-left">
            {columns.map((c) => (
              <th key={c.key} className="pb-2 font-normal">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--card-border)' }}>
              {columns.map((c) => (
                <td key={c.key} className="py-2">{row[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** 네 프로젝트 모두 adv-admin 비콘으로 방문을 집계하므로 표 하나를 공유한다. */
function AdvVisitsSection({ rows }: { rows: { day: string; n: number }[] }) {
  return (
    <Section title="adv-admin 방문자 추이 (최근 7일)">
      {rows.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>(집계된 방문 없음)</p>
      ) : (
        <DailyTable
          rows={rows.map((v) => ({ day: v.day, n: v.n }))}
          columns={[{ key: 'day', label: '날짜' }, { key: 'n', label: '방문 수' }]}
        />
      )}
    </Section>
  )
}

/** 각 프로젝트 패널이 공통으로 쓰는 로딩/에러/데이터 상태. */
function useStats<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) setError(json.error)
      else setData(json)
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  return { data, error, loading, refresh }
}

function StatsState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
  if (error) return <p style={{ color: '#f87171' }}>{error}</p>
  return null
}

// ── 버블타자 ──

type BubbleChatStatsResponse = {
  users: { total: number; newToday: number; activeLast7d: number; activeLast30d: number }
  games: { total: number; today: number; byMode: { modeId: string; n: number }[] }
  live: { onlineCount: number; activeRooms: number }
  dailyVisits: { day: string; n: number }[]
}

type GameHistoryEntry = {
  id: number
  roomCode: string
  modeId: string
  ranked: boolean
  durationMs: number
  players: { userId: number | null; nickname: string; score: number; rank: number; survivalMs?: number }[]
  playedAt: number
}

const HISTORY_PAGE = 20

function BubbleChatStats() {
  const { data: stats, error, loading, refresh } = useStats<BubbleChatStatsResponse>('/api/bubblechat/stats')

  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)

  const fetchHistory = async (offset: number, append: boolean) => {
    setHistoryLoading(true)
    try {
      const res = await fetch(`/api/bubblechat/game-history?limit=${HISTORY_PAGE}&offset=${offset}`)
      const data = await res.json()
      setHistoryTotal(data.total ?? 0)
      setHistory((prev) => (append ? [...prev, ...(data.games ?? [])] : data.games ?? []))
    } catch {
      // 목록만 비어있게 두고 조용히 무시
    }
    setHistoryLoading(false)
  }

  useEffect(() => {
    fetchHistory(0, false)
  }, [])

  const loadMoreHistory = () => {
    const next = historyOffset + HISTORY_PAGE
    setHistoryOffset(next)
    fetchHistory(next, true)
  }

  return (
    <div className="flex flex-col gap-6">
      <RefreshHeader onRefresh={refresh} />
      <StatsState loading={loading} error={error} />

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="총 가입자" value={stats.users.total} />
            <StatCard label="오늘 신규가입" value={stats.users.newToday} />
            <StatCard label="최근 7일 로그인" value={stats.users.activeLast7d} />
            <StatCard label="현재 접속자" value={stats.live.onlineCount} />
            <StatCard label="진행중인 방" value={stats.live.activeRooms} />
            <StatCard label="총 게임 수" value={stats.games.total} />
            <StatCard label="오늘 게임 수" value={stats.games.today} />
          </div>

          <Section title="모드별 게임 수">
            {stats.games.byMode.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {stats.games.byMode.map((m) => (
                  <div
                    key={m.modeId}
                    className="text-sm px-3 py-1.5 rounded-lg"
                    style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
                  >
                    {m.modeId}: {m.n}회
                  </div>
                ))}
              </div>
            )}
          </Section>

          <AdvVisitsSection rows={stats.dailyVisits} />
        </>
      )}

      <Section title={`최근 매치 (${historyTotal}건)`}>
        {history.length === 0 && !historyLoading ? (
          <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((g) => (
              <div key={g.id} className="rounded-lg p-3 text-sm" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ color: 'var(--muted)' }}>
                    {new Date(g.playedAt).toLocaleString('ko-KR')} · 방 {g.roomCode} · {g.modeId}
                    {g.ranked ? ' · 랭크' : ''} · {Math.round(g.durationMs / 1000)}초
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.players
                    .slice()
                    .sort((a, b) => a.rank - b.rank)
                    .map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-xs" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                        {p.rank}위 {p.nickname} ({p.score}점)
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {history.length < historyTotal && (
          <button
            onClick={loadMoreHistory}
            disabled={historyLoading}
            className="mt-3 text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
          >
            더 보기
          </button>
        )}
      </Section>
    </div>
  )
}

// ── Hex21 ──

type Hex21StatsResponse = {
  users: { total: number; newToday: number; activeLast7d: number; activeLast30d: number }
  rounds: { total: number; today: number; topScore: number }
  dailyVisits: { day: string; n: number }[]
}

function Hex21Stats() {
  const { data: stats, error, loading, refresh } = useStats<Hex21StatsResponse>('/api/hex21/stats')

  return (
    <div className="flex flex-col gap-6">
      <RefreshHeader onRefresh={refresh} />
      <StatsState loading={loading} error={error} />

      {stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="총 가입자" value={stats.users.total} />
            <StatCard label="오늘 신규가입" value={stats.users.newToday} />
            <StatCard label="최근 7일 로그인" value={stats.users.activeLast7d} />
            <StatCard label="최근 30일 로그인" value={stats.users.activeLast30d} />
            <StatCard label="총 라운드 수" value={stats.rounds.total} />
            <StatCard label="오늘 라운드 수" value={stats.rounds.today} />
            <StatCard label="최고 점수" value={stats.rounds.topScore} />
          </div>

          <AdvVisitsSection rows={stats.dailyVisits} />
        </>
      )}
    </div>
  )
}

// ── 네크로댄스 ──

type NecrodanceStatsResponse = {
  runs: {
    total: number
    today: number
    last7d: number
    players: number
    topScore: number
    avgScore: number
    avgSurvivalMs: number
  }
  dailyPlays: { day: string; n: number }[]
  dailyVisits: { day: string; n: number }[]
  top: {
    nickname: string
    score: number
    survival_ms: number
    kills_normal: number
    kills_elite: number
    kills_boss: number
    created_at: string
  }[]
}

function NecrodanceStats() {
  const { data: stats, error, loading, refresh } = useStats<NecrodanceStatsResponse>('/api/necrodance/stats')

  return (
    <div className="flex flex-col gap-6">
      <RefreshHeader onRefresh={refresh} />
      <StatsState loading={loading} error={error} />

      {stats && (
        <>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            계정이 없는 게임이라 랭킹에 등록된 기록(scores)만 집계합니다.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="총 기록 수" value={stats.runs.total} />
            <StatCard label="오늘 기록 수" value={stats.runs.today} />
            <StatCard label="최근 7일 기록" value={stats.runs.last7d} />
            <StatCard label="등록 닉네임 수" value={stats.runs.players} />
            <StatCard label="최고 점수" value={stats.runs.topScore} />
            <StatCard label="평균 점수" value={stats.runs.avgScore} />
            <StatCard label="평균 생존" value={`${Math.round(stats.runs.avgSurvivalMs / 1000)}초`} />
          </div>

          <AdvVisitsSection rows={stats.dailyVisits} />

          <Section title="일별 기록 수 (최근 7일)">
            <DailyTable
              rows={stats.dailyPlays.map((d) => ({ day: d.day, n: d.n }))}
              columns={[{ key: 'day', label: '날짜' }, { key: 'n', label: '기록 수' }]}
            />
          </Section>

          <Section title="상위 랭킹 (10위)">
            {stats.top.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
            ) : (
              <DailyTable
                rows={stats.top.map((t, i) => ({
                  rank: `${i + 1}위`,
                  nickname: t.nickname,
                  score: t.score,
                  survival: `${Math.round(t.survival_ms / 1000)}초`,
                  kills: `${t.kills_normal}/${t.kills_elite}/${t.kills_boss}`,
                  at: new Date(t.created_at).toLocaleString('ko-KR'),
                }))}
                columns={[
                  { key: 'rank', label: '순위' },
                  { key: 'nickname', label: '닉네임' },
                  { key: 'score', label: '점수' },
                  { key: 'survival', label: '생존' },
                  { key: 'kills', label: '처치(일반/정예/보스)' },
                  { key: 'at', label: '기록 시각' },
                ]}
              />
            )}
          </Section>
        </>
      )}
    </div>
  )
}

// ── 마인드매퍼 ──

type MindmaperStatsResponse = {
  dailyVisits: { day: string; n: number }[]
  source: string
  coveredFrom: string | null
  tail: number
  totals: { views: number; requests: number; visitors: number; viewsToday: number; visitorsToday: number }
  daily: { day: string; views: number; requests: number; visitors: number }[]
}

function MindmaperStats() {
  const { data: stats, error, loading, refresh } = useStats<MindmaperStatsResponse>('/api/mindmaper/stats')

  return (
    <div className="flex flex-col gap-6">
      <RefreshHeader onRefresh={refresh} />
      <StatsState loading={loading} error={error} />

      {stats && (
        <>
          <AdvVisitsSection rows={stats.dailyVisits} />

          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            아래는 nginx 접속 로그({stats.source}) 기준 원본 요청 집계입니다. JS를 안 켠 접속까지 잡히지만 컨테이너
            재시작 이후 로그만 남아 누적 수치가 아닙니다 — 누적은 위 adv-admin 방문자 추이를 보세요. 집계 범위:{' '}
            {stats.coveredFrom ? new Date(stats.coveredFrom).toLocaleString('ko-KR') : '(로그 없음)'} 이후 최근{' '}
            {stats.tail.toLocaleString()}줄.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="오늘 페이지뷰" value={stats.totals.viewsToday} />
            <StatCard label="오늘 방문 IP" value={stats.totals.visitorsToday} />
            <StatCard label="총 페이지뷰" value={stats.totals.views} />
            <StatCard label="총 방문 IP" value={stats.totals.visitors} />
            <StatCard label="총 요청 수" value={stats.totals.requests} />
          </div>

          <Section title="일별 방문 추이">
            <DailyTable
              rows={stats.daily.map((d) => ({ day: d.day, views: d.views, visitors: d.visitors, requests: d.requests }))}
              columns={[
                { key: 'day', label: '날짜' },
                { key: 'views', label: '페이지뷰' },
                { key: 'visitors', label: '방문 IP' },
                { key: 'requests', label: '요청 수' },
              ]}
            />
          </Section>
        </>
      )}
    </div>
  )
}

// ── 게임 공장 ──
// game-factory 레벨 서버(game-factory-server)의 관리 API. 예전 game-factory.agonyang.com/admin 페이지를 옮겨 왔다.

type GfCurveRow = { from: number; to: number; min: number; avg: number; max: number; new_gimmicks: string[] }
type GfFactory = {
  title?: string; stage: string; round?: number; verdict?: string; scores?: Record<string, number | null>
  check?: { ok: boolean; level_count: number; gimmicks: unknown[]; curve: GfCurveRow[]; errors: string[] }
  versions: number; art_approved?: boolean; web_built_at?: string; error?: string; open_issues?: number; reviewed_at?: string
}
type GfRun = { at: string; from: number; to: number; ok: boolean; log?: string; secs: number }
type GfGame = {
  slug: string; migrated: boolean; factory: GfFactory | null
  generated_max?: number; bundled_packs?: number; server_packs?: number[]; max_played?: number; remaining?: number; threshold?: number
  worker?: string; fail_until?: number; clears?: Record<string, number>; downloads?: Record<string, number>; runs?: GfRun[]
}
type GfState = {
  now: number; synced_at: string | null; games: GfGame[]
  system: { uptime_s: number; load: number[]; disk: { free: number; total: number } | null; worker_last_tick: number | null; worker_running: string | null }
}
type GfFeedback = { at: string; slug: string; text: string }

const GF_TITLES: Record<string, string> = {
  'penguin-ferry': '펭귄 페리', 'moon-cargo': '문 카고', 'frog-feast': '프로그 피스트', 'sprinkle-siege': '스프링클 시즈',
  'kite-rush': '카이트 러시', 'frost-sort': '프로스트 소트', 'lantern-roll': '랜턴 롤',
}
const GF_STAGE: Record<string, string> = {
  idle: '대기', concept: '기획', 'concept-gate': '컨셉 승인 대기', build: '개발', 'art-target': '아트 목표', 'art-gate': '아트 승인 대기',
  'art-dev': '아트', check: '검사', review: '검수', fix: '수정', done: '완료', stopped: '중단',
}
const GF_WORKER: Record<string, [string, string]> = {
  idle: ['여유 충분', '#4ade80'], generate: ['생성 대기', 'var(--warning)'], running: ['생성 중', 'var(--warning)'],
  backoff: ['생성 실패 — 대기', '#f87171'], 'daily-cap': ['하루 상한 도달', 'var(--warning)'],
}

function gfAgo(t: string | number | null | undefined) {
  if (!t) return '—'
  const s = (Date.now() - new Date(t).getTime()) / 1000
  if (s < 90) return '방금'
  if (s < 5400) return Math.round(s / 60) + '분 전'
  if (s < 172800) return Math.round(s / 3600) + '시간 전'
  return Math.round(s / 86400) + '일 전'
}
const gfKst = (t: string | number) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
const gfName = (slug: string, title?: string) => GF_TITLES[slug] || title || slug

function Badge({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="text-xs px-2 py-1 rounded-md" style={{ border: '1px solid var(--card-border)', color: color || 'var(--foreground)' }}>
      {children}
    </span>
  )
}

/** 레벨별 클리어 수 → 레벨 묶음 막대. 막대가 급히 낮아지는 곳이 이탈 지점. */
function GfDropoff({ clears, maxLevel }: { clears: Record<string, number>; maxLevel: number }) {
  const top = Math.max(maxLevel, ...Object.keys(clears).map(Number), 10)
  const bucket = Math.max(10, Math.ceil(top / 60 / 10) * 10)
  const bars: { from: number; n: number }[] = []
  for (let from = 1; from <= top; from += bucket) {
    let n = 0
    for (let l = from; l < from + bucket; l++) n += clears[l] || 0
    bars.push({ from, n: n / bucket })
  }
  const max = Math.max(...bars.map((b) => b.n), 1)
  const w = 600 / bars.length
  return (
    <div>
      <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="w-full" style={{ height: 120 }} role="img" aria-label="레벨별 클리어 수">
        {bars.map((b, i) => (
          <rect key={i} x={i * w + 0.5} y={110 - (b.n / max) * 105} width={Math.max(w - 1, 1)} height={(b.n / max) * 105} fill="var(--accent)">
            <title>{`${b.from}~${b.from + bucket - 1}레벨: 평균 ${b.n.toFixed(1)}회`}</title>
          </rect>
        ))}
        <line x1="0" y1="110.5" x2="600" y2="110.5" stroke="var(--card-border)" />
      </svg>
      <div className="flex justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
        <span>1</span><span>{bucket}레벨 단위 · 막대에 마우스를 올리면 수치</span><span>{top}</span>
      </div>
    </div>
  )
}

function GfFactoryPart({ f }: { f: GfFactory | null }) {
  if (!f) return <p style={{ color: 'var(--muted)' }}>공장 요약 없음 — PC에서 tools/sync-server.sh 실행</p>
  const c = f.check
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge>{(GF_STAGE[f.stage] || f.stage) + (f.round ? ` · R${f.round}` : '')}</Badge>
        {f.verdict
          ? <Badge color={f.verdict === 'pass' ? '#4ade80' : f.verdict === 'fail' ? 'var(--warning)' : '#f87171'}>검수 {f.verdict}</Badge>
          : <Badge>검수 전</Badge>}
        {c ? (
          <>
            <Badge color={c.ok ? '#4ade80' : '#f87171'}>검사 {c.ok ? '통과' : '실패'}</Badge>
            <Badge>레벨 {c.level_count}</Badge>
            <Badge>기믹 {c.gimmicks.length}</Badge>
          </>
        ) : <Badge>검사 전</Badge>}
        <Badge>버전 {f.versions}</Badge>
        {f.art_approved && <Badge color="#4ade80">아트 승인</Badge>}
        <Badge>웹 빌드 {f.web_built_at ? gfAgo(f.web_built_at) : '없음'}</Badge>
      </div>
      {f.error && <pre className="text-xs whitespace-pre-wrap" style={{ color: '#f87171' }}>{f.error}</pre>}
      {f.scores && (
        <div className="grid gap-x-3 gap-y-1 items-center text-sm" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
          {Object.entries(f.scores).map(([k, v]) => (
            <div key={k} className="contents">
              <span style={{ color: 'var(--muted)' }}>{k}</span>
              <span className="h-2 rounded" style={{ background: 'var(--background)' }}>
                <i className="block h-2 rounded" style={{ width: `${(v ?? 0) * 10}%`, background: 'var(--accent)' }} />
              </span>
              <b>{v ?? '—'}</b>
            </div>
          ))}
        </div>
      )}
      {!!f.open_issues && <p className="text-sm" style={{ color: 'var(--muted)' }}>검수 지적 {f.open_issues}건 · {gfAgo(f.reviewed_at)}</p>}
      {c && c.curve.length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer">난이도 곡선·기믹 로드맵</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <DailyTable
              rows={c.curve.map((r) => ({ range: `${r.from}~${r.to}`, moves: `${r.min} / ${r.avg} / ${r.max}`, gim: r.new_gimmicks.join(', ') }))}
              columns={[{ key: 'range', label: '구간' }, { key: 'moves', label: '이동 수 min/avg/max' }, { key: 'gim', label: '새 기믹' }]}
            />
          </div>
        </details>
      )}
      {c && c.errors.length > 0 && <pre className="text-xs whitespace-pre-wrap" style={{ color: '#f87171' }}>{c.errors.join('\n')}</pre>}
    </div>
  )
}

function GfServerPart({ g, now }: { g: GfGame; now: number }) {
  if (!g.migrated) return <p style={{ color: 'var(--muted)' }}>아직 레벨 팩(1000레벨) 방식으로 이전되지 않음</p>
  const clears = g.clears || {}
  const totalClears = Object.values(clears).reduce((a, b) => a + b, 0)
  const [wl, wc] = GF_WORKER[g.worker || ''] || [g.worker || '—', 'var(--foreground)']
  const downloads = Object.entries(g.downloads || {}).sort((a, b) => Number(a[0]) - Number(b[0]))
  const runs = g.runs || []
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="생성된 레벨" value={g.generated_max ?? 0} />
        <StatCard label="최고 도달 레벨" value={g.max_played ?? 0} />
        <StatCard label={`남은 레벨 (기준 ${g.threshold})`} value={g.remaining ?? 0} />
        <StatCard label="총 클리어" value={totalClears.toLocaleString()} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge color={wc}>생성기: {wl}</Badge>
        <Badge>내장 팩 {g.bundled_packs}</Badge>
        <Badge>서버 팩 {(g.server_packs || []).length}</Badge>
        {(g.fail_until || 0) > now && <Badge color="#f87171">재시도 {gfKst(g.fail_until!)}</Badge>}
      </div>
      <p className="text-sm font-semibold">레벨별 클리어 (익명 집계)</p>
      {totalClears ? <GfDropoff clears={clears} maxLevel={g.max_played ?? 0} /> : <p style={{ color: 'var(--muted)' }}>아직 기록 없음</p>}
      <p className="text-sm font-semibold">팩 다운로드</p>
      {downloads.length
        ? <div className="flex flex-wrap gap-2">{downloads.map(([i, n]) => <Badge key={i}>#{i} {n}회</Badge>)}</div>
        : <p style={{ color: 'var(--muted)' }}>없음</p>}
      <p className="text-sm font-semibold">생성 기록</p>
      {runs.length ? (
        <div className="max-h-60 overflow-auto">
          <DailyTable
            rows={runs.map((r) => ({ at: gfKst(r.at), range: `${r.from}~${r.to}`, ok: r.ok ? '성공' : `실패${r.log ? ' — ' + r.log.slice(0, 200) : ''}`, secs: r.secs }))}
            columns={[{ key: 'at', label: '시각' }, { key: 'range', label: '레벨' }, { key: 'ok', label: '결과' }, { key: 'secs', label: '초' }]}
          />
        </div>
      ) : <p style={{ color: 'var(--muted)' }}>아직 생성 기록 없음</p>}
    </div>
  )
}

function GfFeedbackSection({ games }: { games: string[] }) {
  const [slug, setSlug] = useState('')
  const [items, setItems] = useState<GfFeedback[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const json = await (await fetch(`/api/game-factory/feedback?slug=${encodeURIComponent(slug)}&limit=300`)).json()
        if (!alive) return
        if (json.error) setError(json.error)
        else { setError(''); setItems(json) }
      } catch (e) {
        if (alive) setError(String(e))
      }
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [slug])

  return (
    <Section title={`피드백${items ? ` (${items.length}건)` : ''}`}>
      <div className="flex flex-wrap gap-2 mb-3">
        {['', ...games].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setSlug(s)}
            className="text-xs px-3 py-1 rounded-md"
            style={{ background: slug === s ? 'var(--accent)' : 'var(--background)', color: slug === s ? '#fff' : 'var(--foreground)', border: '1px solid var(--card-border)' }}
          >
            {s ? gfName(s) : '전체'}
          </button>
        ))}
      </div>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {items && items.length === 0 && <p style={{ color: 'var(--muted)' }}>(피드백 없음)</p>}
      {items && items.length > 0 && (
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--muted)' }} className="text-left">
                <th className="pb-2 font-normal whitespace-nowrap pr-3">시각</th>
                <th className="pb-2 font-normal whitespace-nowrap pr-3">게임</th>
                <th className="pb-2 font-normal">내용</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--card-border)' }} className="align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{gfKst(f.at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{gfName(f.slug)}</td>
                  <td className="py-2 whitespace-pre-wrap break-words">{f.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

function GameFactoryStats() {
  const { data: s, error, loading, refresh } = useStats<GfState>('/api/game-factory/state')

  // 예전 관리페이지처럼 30초마다 갱신한다. 이미 데이터가 있으면 로딩 문구 대신 기존 화면을 유지한다.
  useEffect(() => {
    const t = setInterval(refresh, 30000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <RefreshHeader onRefresh={refresh} />
      {!s && <StatsState loading={loading} error={error} />}
      {s && (
        <>
          {error && <p style={{ color: '#f87171' }}>{error}</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--muted)' }}>
            <span>공장 동기화 {gfAgo(s.synced_at)}</span>
            <span>서버 가동 {Math.round(s.system.uptime_s / 3600)}시간</span>
            {s.system.disk && <span>디스크 여유 {(s.system.disk.free / 1e9).toFixed(1)}GB / {(s.system.disk.total / 1e9).toFixed(1)}GB</span>}
            <span>생성기 확인 {gfAgo(s.system.worker_last_tick)}{s.system.worker_running ? ` · ${s.system.worker_running} 생성 중` : ''}</span>
            <span>부하 {s.system.load.map((x) => x.toFixed(2)).join(' ')}</span>
          </div>

          <GfFeedbackSection games={s.games.filter((g) => g.migrated).map((g) => g.slug)} />

          {s.games.map((g) => (
            <Section key={g.slug} title={`${gfName(g.slug, g.factory?.title)} · ${g.slug}`}>
              <div className="flex flex-col gap-5">
                <GfFactoryPart f={g.factory} />
                <div>
                  <p className="text-sm font-semibold mb-2">레벨 서버</p>
                  <GfServerPart g={g} now={s.now} />
                </div>
              </div>
            </Section>
          ))}
        </>
      )}
    </div>
  )
}
