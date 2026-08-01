'use client'

import { useEffect, useState } from 'react'

type WordEntry = { word: string; count: number; lastAt: string }
type AddStatus = 'adding' | 'added' | 'exists' | 'error'
type Lang = 'kr' | 'en'
type MainTab = 'dict' | 'accounts' | 'stats'

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

export default function BubbleChatPage() {
  const [tab, setTab] = useState<MainTab>('dict')

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">bubbleChat</h1>
        <div className="flex gap-2">
          <MainTabButton active={tab === 'dict'} label="사전 관리" onClick={() => setTab('dict')} />
          <MainTabButton active={tab === 'accounts'} label="계정 관리" onClick={() => setTab('accounts')} />
          <MainTabButton active={tab === 'stats'} label="통계" onClick={() => setTab('stats')} />
        </div>
      </div>

      {tab === 'dict' && <DictionaryTab />}
      {tab === 'accounts' && <AccountsTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}

function DictionaryTab() {
  const [lang, setLang] = useState<Lang>('kr')
  const apiBase = lang === 'kr' ? '/api/bubblechat' : '/api/bubblechat-en'

  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addStatus, setAddStatus] = useState<Record<string, AddStatus>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})

  const [customWords, setCustomWords] = useState<string[]>([])
  const [customLoading, setCustomLoading] = useState(true)
  const [customBusy, setCustomBusy] = useState<Record<string, boolean>>({})

  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<{ word: string; valid: boolean } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [checking, setChecking] = useState(false)

  const fetchWords = async (base: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${base}/unknown-words`)
      const data = await res.json()
      if (data.error) setError(data.error)
      setWords(data.words ?? [])
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  const fetchCustomWords = async (base: string) => {
    setCustomLoading(true)
    try {
      const res = await fetch(`${base}/dictionary/custom`)
      const data = await res.json()
      setCustomWords(data.words ?? [])
    } catch {
      // 표시용 목록이므로 실패해도 조용히 무시
    }
    setCustomLoading(false)
  }

  useEffect(() => {
    setQuery('')
    setLookup(null)
    setLookupError('')
    setAddStatus({})
    fetchWords(apiBase)
    fetchCustomWords(apiBase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  const checkWord = async () => {
    const word = query.trim()
    if (!word) return
    setChecking(true)
    setLookup(null)
    setLookupError('')
    try {
      const res = await fetch(`${apiBase}/dictionary?word=${encodeURIComponent(word)}`)
      const data = await res.json()
      if (data.error) setLookupError(data.error)
      else setLookup(data)
    } catch (err) {
      setLookupError(String(err))
    }
    setChecking(false)
  }

  const addToDictionary = async (word: string) => {
    setAddStatus((s) => ({ ...s, [word]: 'adding' }))
    try {
      const res = await fetch(`${apiBase}/dictionary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (data.error) {
        setAddStatus((s) => ({ ...s, [word]: 'error' }))
        return
      }
      setAddStatus((s) => ({ ...s, [word]: data.added ? 'added' : 'exists' }))
      if (data.added) setCustomWords((list) => [...list, word])
    } catch {
      setAddStatus((s) => ({ ...s, [word]: 'error' }))
    }
  }

  const resolveWord = async (word: string) => {
    setResolving((s) => ({ ...s, [word]: true }))
    try {
      const res = await fetch(`${apiBase}/unknown-words`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (!data.error) setWords((list) => list.filter((w) => w.word !== word))
    } finally {
      setResolving((s) => ({ ...s, [word]: false }))
    }
  }

  const deleteCustomWord = async (word: string) => {
    setCustomBusy((s) => ({ ...s, [word]: true }))
    try {
      const res = await fetch(`${apiBase}/dictionary`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (!data.error && data.removed) {
        setCustomWords((list) => list.filter((w) => w !== word))
        setAddStatus((s) => {
          const next = { ...s }
          delete next[word]
          return next
        })
      }
    } finally {
      setCustomBusy((s) => ({ ...s, [word]: false }))
    }
  }

  const LangTabButton = ({ value, label }: { value: Lang; label: string }) => (
    <button
      onClick={() => setLang(value)}
      className="text-sm px-4 py-1.5 rounded-lg"
      style={{
        background: lang === value ? 'var(--accent)' : 'var(--background)',
        color: lang === value ? '#fff' : 'var(--foreground)',
        border: '1px solid var(--card-border)',
      }}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex gap-2">
        <LangTabButton value="kr" label="KR" />
        <LangTabButton value="en" label="EN" />
      </div>

      <section className="rounded-xl p-5" style={card}>
        <h2 className="text-lg font-semibold mb-3">사전 조회</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkWord()}
            placeholder="단어 입력"
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={checkWord}
            disabled={checking}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            조회
          </button>
        </div>
        {lookupError && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{lookupError}</p>}
        {lookup && (
          <p className="text-sm mt-3">
            <strong>{lookup.word}</strong>{' '}
            {lookup.valid ? (
              <span style={{ color: '#4ade80' }}>사전에 있음</span>
            ) : (
              <span style={{ color: '#f87171' }}>사전에 없음</span>
            )}
          </p>
        )}
      </section>

      <section className="rounded-xl p-5" style={card}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">오타/미등록 단어 로그</h2>
          <button
            onClick={() => fetchWords(apiBase)}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
        ) : error ? (
          <p style={{ color: '#f87171' }}>{error}</p>
        ) : words.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--muted)' }} className="text-left">
                <th className="pb-2 font-normal">단어</th>
                <th className="pb-2 font-normal">등장 횟수</th>
                <th className="pb-2 font-normal">마지막 등장</th>
                <th className="pb-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.word} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td className="py-2">{w.word}</td>
                  <td className="py-2">{w.count}</td>
                  <td className="py-2" style={{ color: 'var(--muted)' }}>
                    {new Date(w.lastAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      {addStatus[w.word] === 'added' ? (
                        <span className="text-xs" style={{ color: '#4ade80' }}>추가됨</span>
                      ) : addStatus[w.word] === 'exists' ? (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>이미 있음</span>
                      ) : addStatus[w.word] === 'error' ? (
                        <span className="text-xs" style={{ color: '#f87171' }}>실패</span>
                      ) : (
                        <button
                          onClick={() => addToDictionary(w.word)}
                          disabled={addStatus[w.word] === 'adding'}
                          className="text-xs px-3 py-1 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          사전에 추가
                        </button>
                      )}
                      <button
                        onClick={() => resolveWord(w.word)}
                        disabled={resolving[w.word]}
                        className="text-xs px-3 py-1 rounded-lg"
                        style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
                      >
                        해결
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-xl p-5" style={card}>
        <h2 className="text-lg font-semibold mb-3">추가된 단어 목록</h2>
        {customLoading ? (
          <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
        ) : customWords.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>(추가된 단어 없음)</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customWords.map((w) => (
              <div
                key={w}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
              >
                {w}
                <button
                  onClick={() => deleteCustomWord(w)}
                  disabled={customBusy[w]}
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: '#7f1d1d', color: '#fca5a5' }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

type AdminUser = {
  id: number
  provider: string
  nickname: string
  rating: number
  games_played: number
  wins: number
  losses: number
  draws: number
  points: number
  equipped_skin_id: string | null
  best_cpm: number
  best_accuracy: number
  best_survival_ms: number
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
      const res = await fetch(`/api/bubblechat/users?query=${encodeURIComponent(q)}&limit=50`)
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
      const res = await fetch('/api/bubblechat/users/points', {
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
      const res = await fetch('/api/bubblechat/users/admin', {
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
                  <th className="pb-2 font-normal">레이팅</th>
                  <th className="pb-2 font-normal">전적</th>
                  <th className="pb-2 font-normal">포인트</th>
                  <th className="pb-2 font-normal">최고기록(CPM/정확도)</th>
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
                    <td className="py-2">{u.rating}</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>
                      {u.wins}승 {u.losses}패 {u.draws}무
                    </td>
                    <td className="py-2">{u.points}P</td>
                    <td className="py-2" style={{ color: 'var(--muted)' }}>
                      {u.best_cpm} / {u.best_accuracy}%
                    </td>
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

  const [history, setHistory] = useState<GameHistoryEntry[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(true)
  const HISTORY_PAGE = 20

  const fetchStats = async () => {
    setStatsLoading(true)
    setStatsError('')
    try {
      const res = await fetch('/api/bubblechat/stats')
      const data = await res.json()
      if (data.error) setStatsError(data.error)
      else setStats(data)
    } catch (err) {
      setStatsError(String(err))
    }
    setStatsLoading(false)
  }

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
    fetchStats()
    fetchHistory(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMoreHistory = () => {
    const next = historyOffset + HISTORY_PAGE
    setHistoryOffset(next)
    fetchHistory(next, true)
  }

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
            <StatCard label="현재 접속자" value={stats.live.onlineCount} />
            <StatCard label="진행중인 방" value={stats.live.activeRooms} />
            <StatCard label="총 게임 수" value={stats.games.total} />
            <StatCard label="오늘 게임 수" value={stats.games.today} />
          </div>

          <section className="rounded-xl p-5" style={card}>
            <h3 className="text-base font-semibold mb-3">모드별 게임 수</h3>
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
          </section>

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

      <section className="rounded-xl p-5" style={card}>
        <h3 className="text-base font-semibold mb-3">최근 매치 ({historyTotal}건)</h3>
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
      </section>
    </div>
  )
}
