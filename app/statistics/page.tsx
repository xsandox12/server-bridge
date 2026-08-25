'use client'

import { useEffect, useState } from 'react'

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }

type ProjectId = 'bubblechat' | 'hex21' | 'necrodance' | 'mindmaper'

const PROJECTS: { id: ProjectId; label: string; icon: string }[] = [
  { id: 'bubblechat', label: '버블타자', icon: '🫧' },
  { id: 'hex21', label: 'Hex21', icon: '🎴' },
  { id: 'necrodance', label: '네크로댄스', icon: '💀' },
  { id: 'mindmaper', label: '마인드매퍼', icon: '🧠' },
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
