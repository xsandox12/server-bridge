'use client'

import { useEffect, useState } from 'react'

type MainTab = 'accounts' | 'stats'

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }

function MainTabButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-sm px-4 py-2 rounded-lg font-medium"
      style={{
        background: active ? 'var(--accent)' : 'var(--card)',
        color: active ? '#fff' : 'var(--foreground)',
        border: '1px solid var(--card-border)',
      }}
    >
      {label}
    </button>
  )
}

export default function Hex21Page() {
  const [tab, setTab] = useState<MainTab>('accounts')

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Hex21</h1>
        <div className="flex gap-2">
          <MainTabButton active={tab === 'accounts'} label="계정 관리" onClick={() => setTab('accounts')} />
          <MainTabButton active={tab === 'stats'} label="통계" onClick={() => setTab('stats')} />
        </div>
      </div>

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

type AdminUser = {
  id: number
  provider: string
  nickname: string
  points: number
  best_score: number
  best_chain: number
  rounds_played: number
  login_streak: number
  equipped_tile_id: string | null
  equipped_deck_style_id: string | null
  equipped_avatar_id: string | null
  equipped_border_id: string | null
  created_at: number
  last_login_at: number | null
  is_admin: number
}

function AccountsTab() {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pointsInput, setPointsInput] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<Record<number, boolean>>({})
  const [pointsMsg, setPointsMsg] = useState<Record<number, string>>({})
  const [adminBusy, setAdminBusy] = useState<Record<number, boolean>>({})

  const search = async (q: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/hex21/users?query=${encodeURIComponent(q)}&limit=50`)
      const data = await res.json()
      if (data.error) setError(data.error)
      setUsers(data.users ?? [])
      setTotal(data.total ?? 0)
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  useEffect(() => {
    search('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyPoints = async (userId: number) => {
    const amount = Number(pointsInput[userId])
    if (!Number.isFinite(amount) || amount === 0) return
    setBusy((s) => ({ ...s, [userId]: true }))
    setPointsMsg((s) => ({ ...s, [userId]: '' }))
    try {
      const res = await fetch('/api/hex21/users/points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount }),
      })
      const data = await res.json()
      if (data.error) {
        setPointsMsg((s) => ({ ...s, [userId]: data.error }))
        return
      }
      setUsers((list) => list.map((u) => (u.id === userId ? data.user : u)))
      setPointsInput((s) => ({ ...s, [userId]: '' }))
      setPointsMsg((s) => ({ ...s, [userId]: '완료' }))
    } catch (err) {
      setPointsMsg((s) => ({ ...s, [userId]: String(err) }))
    } finally {
      setBusy((s) => ({ ...s, [userId]: false }))
    }
  }

  const applyAdmin = async (userId: number, nextIsAdmin: boolean) => {
    setAdminBusy((s) => ({ ...s, [userId]: true }))
    try {
      const res = await fetch('/api/hex21/users/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin: nextIsAdmin }),
      })
      const data = await res.json()
      if (!data.error) setUsers((list) => list.map((u) => (u.id === userId ? data.user : u)))
    } finally {
      setAdminBusy((s) => ({ ...s, [userId]: false }))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl p-5" style={card}>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search(query)}
            placeholder="닉네임으로 검색 (비워두면 전체 최신순)"
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={() => search(query)}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            검색
          </button>
        </div>
      </section>

      <section className="rounded-xl p-5" style={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">계정 목록 ({total}명)</h2>
        </div>
        {loading ? (
          <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
        ) : error ? (
          <p style={{ color: '#f87171' }}>{error}</p>
        ) : users.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>(결과 없음)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--muted)' }} className="text-left">
                  <th className="pb-2 font-normal">닉네임</th>
                  <th className="pb-2 font-normal">제공자</th>
                  <th className="pb-2 font-normal">포인트</th>
                  <th className="pb-2 font-normal">최고점수/최대연결</th>
                  <th className="pb-2 font-normal">플레이횟수</th>
                  <th className="pb-2 font-normal">출석연속</th>
                  <th className="pb-2 font-normal">가입일</th>
                  <th className="pb-2 font-normal">마지막 로그인</th>
                  <th className="pb-2 font-normal">포인트 지급/회수</th>
                  <th className="pb-2 font-normal">관리자(커뮤니티)</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                    <td className="py-2">{u.nickname}</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>{u.provider}</td>
                    <td className="py-2">{u.points}P</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>
                      {u.best_score} / {u.best_chain}
                    </td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>{u.rounds_played}회</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>{u.login_streak}일</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>
                      {new Date(u.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          value={pointsInput[u.id] ?? ''}
                          onChange={(e) => setPointsInput((s) => ({ ...s, [u.id]: e.target.value }))}
                          placeholder="±숫자"
                          className="w-20 px-2 py-1 rounded-lg text-xs"
                          style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                        />
                        <button
                          onClick={() => applyPoints(u.id)}
                          disabled={busy[u.id]}
                          className="text-xs px-2.5 py-1 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          적용
                        </button>
                        {pointsMsg[u.id] && (
                          <span className="text-xs" style={{ color: 'var(--muted)' }}>{pointsMsg[u.id]}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => applyAdmin(u.id, !u.is_admin)}
                        disabled={adminBusy[u.id]}
                        className="text-xs px-2.5 py-1 rounded-lg"
                        style={
                          u.is_admin
                            ? { background: 'var(--accent)', color: '#fff' }
                            : { background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }
                        }
                      >
                        {u.is_admin ? '관리자 ✓ (해제)' : '관리자 지정'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

type StatsResponse = {
  users: { total: number; newToday: number; activeLast7d: number; activeLast30d: number }
  rounds: { total: number; today: number; topScore: number }
  dailyVisits: { day: string; n: number }[]
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-4" style={card}>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  )
}

function StatsTab() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsError, setStatsError] = useState('')
  const [statsLoading, setStatsLoading] = useState(true)

  const fetchStats = async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const res = await fetch('/api/hex21/stats')
      const data = await res.json()
      if (data.error) setStatsError(data.error)
      else setStats(data)
    } catch (err) {
      setStatsError(String(err))
    }
    setStatsLoading(false)
  }

  useEffect(() => {
    fetchStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">현황</h2>
        <button
          onClick={fetchStats}
          className="text-sm px-4 py-2 rounded-lg"
          style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
        >
          새로고침
        </button>
      </div>

      {statsLoading ? (
        <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
      ) : statsError ? (
        <p style={{ color: '#f87171' }}>{statsError}</p>
      ) : stats ? (
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

          <section className="rounded-xl p-5" style={card}>
            <h3 className="text-base font-semibold mb-3">adv-admin 방문자 추이 (최근 7일)</h3>
            {stats.dailyVisits.length === 0 ? (
              <p style={{ color: 'var(--muted)' }}>(연동 정보 없음)</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--muted)' }} className="text-left">
                    <th className="pb-2 font-normal">날짜</th>
                    <th className="pb-2 font-normal">방문 수</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dailyVisits.map((v) => (
                    <tr key={v.day} style={{ borderTop: '1px solid var(--card-border)' }}>
                      <td className="py-2">{v.day}</td>
                      <td className="py-2">{v.n}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
