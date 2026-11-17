'use client'

import { useCallback, useEffect, useState } from 'react'
import cosmeticList from './cosmetics.json'

// Cubrawl 운영: 공지 팝업 · 원격 설정 · 계정(보기·지급·제재) · 전적 · 통계 · 버그성 플레이 체크 · 유료 결제 장부.
// 모든 요청은 /api/cubrawl/* (server-bridge 서버 쪽에서 관리 토큰을 붙여 cubrawl-stats /admin/* 로 넘긴다).

type Tab = 'notices' | 'config' | 'players' | 'records' | 'stats' | 'flags' | 'purchases'
const TABS: { id: Tab; label: string }[] = [
  { id: 'notices', label: '공지' },
  { id: 'config', label: '원격 설정' },
  { id: 'players', label: '계정' },
  { id: 'records', label: '전적' },
  { id: 'stats', label: '통계' },
  { id: 'flags', label: '플레이 체크' },
  { id: 'purchases', label: '결제' },
]

type Notice = { id: number; title: string; body: string; active: number; starts_at: string | null; ends_at: string | null; updated_at: string }
type ConfigRow = { key: string; value: string }
type Player = {
  install_id: string; steam_id: string; name: string; version: string; coins: number; gems: number; level: number
  matches: number; wins: number; kills: number; owned_count: number; first_seen: string; last_seen: string
  banned: number; ban_reason: string; open_flags?: number; snapshot?: unknown
}
type PlayerMatch = { played_at: string; mode: string; rank: number; players: number; kills: number; deaths: number; won: number; coins: number; excluded: number }
type Grant = { id: number; coins: number; gems: number; item_id: string; note: string; created_at: string; claimed_at: string | null }
type Flag = { id: number; install_id: string; rule: string; detail: string; created_at: string; resolved: number; name?: string }
type Detail = { player: Player; matches: PlayerMatch[]; grants: Grant[]; flags: Flag[]; hostedMatches: number }
type Summary = { players: number; activeToday: number; banned: number; openFlags: number; pendingGrants: number; activeNotices: number }

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }
const input: React.CSSProperties = { background: 'var(--background)', border: '1px solid var(--card-border)' }
const muted: React.CSSProperties = { color: 'var(--muted)' }

const KNOWN_CONFIG: { key: string; desc: string; placeholder: string }[] = [
  { key: 'coinMultiplier', desc: '매치 코인 배수 (이벤트). 1 = 평소, 2 = 두 배', placeholder: '1' },
  { key: 'gachaCost', desc: '가챠 한 번에 드는 포인트 (기본 300)', placeholder: '300' },
]

// 게임 내부 이름 → 화면 이름 (모드: Resources/Data/Modes, 캐릭터: Player/Heroes.cs)
const MODE_NAMES: Record<string, string> = {
  QuickMatch: '빠른 판', Deathmatch: '데스매치', SuddenDeath: '서든데스', TeamMatch: '팀매치', CaptureFlag: '깃발뺏기',
}
const HERO_NAMES: Record<string, string> = {
  pixel: '픽셀', brick: '브릭', scope: '스코프', tank: '몽땅', mason: '벽돌', bolt: '나사',
  rapid: '따발', blaze: '불똥', boom: '쾅쾅', flash: '반짝', tracker: '추적', spark: '찌릿',
}
const modeName = (m: string) => MODE_NAMES[m] ?? m
const heroName = (h: string) => HERO_NAMES[h] ?? h

// 선물로 줄 수 있는 꾸미기 (Cubrawl 의 tools/export-cosmetics.mjs 로 만든다)
const COSMETICS: { id: string; name: string; kind: string }[] = cosmeticList
const cosmeticName = (id: string) => COSMETICS.find((c) => c.id === id)?.name

const RULES: Record<string, string> = {
  kills: '한 판 킬 수가 너무 많음',
  rank: '순위가 인원보다 큼',
  match_coins: '한 판 코인이 공식 최대치보다 많음',
  clock: '미래 시각 기록 (PC 시계 조작 의심)',
  volume: '하루 판 수가 너무 많음',
  coin_jump: '업로드 사이 코인 급증',
  gem_jump: '업로드 사이 젬 급증',
  reset: '판 수가 줄었음 (계정 초기화·되돌리기)',
}

async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/cubrawl/${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : {}
  if (!res.ok) throw new Error(data.error || (data.errors ? data.errors.join(', ') : `HTTP ${res.status}`))
  return data as T
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ko-KR', { hour12: false }) : '—')
/** datetime-local 입력값 ↔ ISO */
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
/** 서버가 쓴 문장 안의 ISO 시각(UTC)을 이 PC 시간으로 */
const localize = (text: string) => text.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, (iso) => when(iso))
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function Button({ children, onClick, tone = 'default', disabled }: { children: React.ReactNode; onClick?: () => void; tone?: 'default' | 'accent' | 'danger'; disabled?: boolean }) {
  const bg = tone === 'accent' ? 'var(--accent)' : tone === 'danger' ? '#b33a3a' : 'transparent'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-sm disabled:opacity-40"
      style={{ background: bg, border: tone === 'default' ? '1px solid var(--card-border)' : 'none', color: tone === 'default' ? 'var(--foreground)' : '#fff' }}
    >
      {children}
    </button>
  )
}

export default function CubrawlPage() {
  const [tab, setTab] = useState<Tab>('notices')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string>('')

  // 읽기·고치기가 끝날 때마다 위 숫자도 새로 읽는다 (공지를 올리면 "켜진 공지"가 바로 바뀌게)
  const run = useCallback(async (work: () => Promise<unknown>) => {
    try {
      await work()
      setError('')
      setSummary(await api<Summary>('summary'))
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const openPlayer = (install: string, to: Tab = 'players') => { setSelected(install); setTab(to) }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">Cubrawl 운영</h1>
        <p className="text-sm mt-1" style={muted}>
          cubrawl-stats(cubrawl.agonyang.com)의 공지·설정·계정을 관리합니다. 계정 원본은 각 PC의 profile.json이고, 여기에는 계정 연동에 동의한 사람이 올린 요약만 있어요.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {[
            ['계정', summary.players], ['24시간 접속', summary.activeToday], ['제재', summary.banned],
            ['처리 안 한 표시', summary.openFlags], ['안 받은 지급', summary.pendingGrants], ['켜진 공지', summary.activeNotices],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-xl p-3" style={card}>
              <div className="text-xs" style={muted}>{label}</div>
              <div className="text-xl font-bold mt-1">{n as number}</div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-lg text-sm"
            style={{ background: tab === t.id ? 'var(--accent)' : 'var(--card)', color: tab === t.id ? '#fff' : 'var(--foreground)', border: '1px solid var(--card-border)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#3a1c1c', border: '1px solid #b33a3a' }}>{error}</div>}

      {tab === 'notices' && <Notices run={run} />}
      {tab === 'config' && <Config run={run} />}
      {tab === 'players' && <Players run={run} selected={selected} setSelected={setSelected} onRecords={(i) => openPlayer(i, 'records')} />}
      {tab === 'records' && <Records run={run} selected={selected} setSelected={setSelected} />}
      {tab === 'stats' && <Stats run={run} />}
      {tab === 'flags' && <Flags run={run} onOpen={(i) => openPlayer(i)} />}
      {tab === 'purchases' && <Purchases run={run} />}
    </div>
  )
}

type Run = (work: () => Promise<unknown>) => Promise<void>

// ───────── 공지 ─────────

const EMPTY_NOTICE = { title: '', body: '', active: true, startsAt: '', endsAt: '' }

function Notices({ run }: { run: Run }) {
  const [list, setList] = useState<Notice[]>([])
  const [form, setForm] = useState(EMPTY_NOTICE)
  const [editing, setEditing] = useState<number | null>(null)

  const load = useCallback(() => run(async () => setList(await api<Notice[]>('notices'))), [run])
  useEffect(() => { load() }, [load])

  const payload = (f: typeof form) => ({ title: f.title, body: f.body, active: f.active, startsAt: fromLocalInput(f.startsAt), endsAt: fromLocalInput(f.endsAt) })
  const save = () => run(async () => {
    if (editing === null) await api('notices', 'POST', payload(form))
    else await api(`notices/${editing}`, 'PUT', payload(form))
    setForm(EMPTY_NOTICE)
    setEditing(null)
    await load()
  })
  const toggle = (n: Notice) => run(async () => {
    await api(`notices/${n.id}`, 'PUT', { title: n.title, body: n.body, active: n.active !== 1, startsAt: n.starts_at, endsAt: n.ends_at })
    await load()
  })
  const remove = (n: Notice) => run(async () => {
    if (!confirm(`공지 "${n.title}" 를 지울까요?`)) return
    await api(`notices/${n.id}`, 'DELETE')
    await load()
  })
  const edit = (n: Notice) => {
    setEditing(n.id)
    setForm({ title: n.title, body: n.body, active: n.active === 1, startsAt: toLocalInput(n.starts_at), endsAt: toLocalInput(n.ends_at) })
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
        <h2 className="font-semibold">{editing === null ? '새 공지' : `공지 #${editing} 고치기`}</h2>
        <p className="text-xs" style={muted}>게임을 켜면 로비에서 팝업으로 뜹니다. 켜져 있고 기간 안인 공지만 보여요. 플레이어가 &quot;다시 보지 않기&quot;를 누르면 그 공지는 다시 뜨지 않아요.</p>
        <input className="rounded-lg px-3 py-2 text-sm" style={input} placeholder="제목 (80자)" maxLength={80} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea className="rounded-lg px-3 py-2 text-sm h-40" style={input} placeholder="내용 (2000자, 줄바꿈 그대로)" maxLength={2000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="flex flex-col gap-1"><span style={muted}>시작 (비우면 바로)</span>
            <input type="datetime-local" className="rounded-lg px-3 py-2" style={input} value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} /></label>
          <label className="flex flex-col gap-1"><span style={muted}>끝 (비우면 계속)</span>
            <input type="datetime-local" className="rounded-lg px-3 py-2" style={input} value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> 켜기</label>
        <div className="flex gap-2">
          <Button tone="accent" onClick={save} disabled={!form.title.trim()}>{editing === null ? '공지 올리기' : '저장'}</Button>
          {editing !== null && <Button onClick={() => { setEditing(null); setForm(EMPTY_NOTICE) }}>취소</Button>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {list.length === 0 && <div className="rounded-xl p-5 text-sm" style={{ ...card, ...muted }}>아직 공지가 없어요.</div>}
        {list.map((n) => (
          <div key={n.id} className="rounded-xl p-4 flex flex-col gap-2" style={{ ...card, opacity: n.active ? 1 : 0.55 }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold flex-1">#{n.id} {n.title}</span>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: n.active ? '#1f5132' : '#444' }}>{n.active ? '켜짐' : '꺼짐'}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap" style={muted}>{n.body || '(내용 없음)'}</p>
            <div className="text-xs" style={muted}>기간: {when(n.starts_at)} ~ {when(n.ends_at)} · 고친 시각 {when(n.updated_at)}</div>
            <div className="flex gap-2">
              <Button onClick={() => edit(n)}>고치기</Button>
              <Button onClick={() => toggle(n)}>{n.active ? '끄기' : '켜기'}</Button>
              <Button tone="danger" onClick={() => remove(n)}>지우기</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────── 원격 설정 ─────────

function Config({ run }: { run: Run }) {
  const [rows, setRows] = useState<ConfigRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [newKey, setNewKey] = useState('')
  const [extra, setExtra] = useState<string[]>([])

  const load = useCallback(() => run(async () => {
    const list = await api<ConfigRow[]>('config')
    setRows(list)
    setDraft(Object.fromEntries(list.map((r) => [r.key, r.value])))
  }), [run])
  useEffect(() => { load() }, [load])

  const save = (key: string) => run(async () => { await api(`config/${encodeURIComponent(key)}`, 'PUT', { value: draft[key] ?? '' }); await load() })
  const remove = (key: string) => run(async () => { await api(`config/${encodeURIComponent(key)}`, 'DELETE'); await load() })
  const keys = [...new Set([...KNOWN_CONFIG.map((k) => k.key), ...rows.map((r) => r.key), ...extra])]

  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={card}>
      <p className="text-sm" style={muted}>게임이 켜질 때 받아 갑니다 (이미 켜진 게임은 다음 실행부터). 비워 두면 게임 기본값을 써요.</p>
      {keys.map((key) => {
        const known = KNOWN_CONFIG.find((k) => k.key === key)
        const saved = rows.find((r) => r.key === key)
        return (
          <div key={key} className="flex items-center gap-3 flex-wrap">
            <code className="w-40 text-sm">{key}</code>
            <input className="rounded-lg px-3 py-2 text-sm w-40" style={input} placeholder={known?.placeholder ?? ''} value={draft[key] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} />
            <Button tone="accent" onClick={() => save(key)}>저장</Button>
            {saved && <Button onClick={() => remove(key)}>기본값으로</Button>}
            <span className="text-xs" style={muted}>{known?.desc ?? '(게임이 아직 읽지 않는 키)'}{saved ? ` · 지금 ${saved.value}` : ' · 설정 안 됨'}</span>
          </div>
        )
      })}
      <div className="flex gap-2 items-center border-t pt-4" style={{ borderColor: 'var(--card-border)' }}>
        <input className="rounded-lg px-3 py-2 text-sm w-60" style={input} placeholder="새 키 (영문·숫자)" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <Button onClick={() => { setExtra([...extra, newKey]); setNewKey('') }} disabled={!/^[A-Za-z0-9_.]{1,40}$/.test(newKey)}>키 추가</Button>
      </div>
    </div>
  )
}

// ───────── 계정 ─────────

function usePlayers(run: Run) {
  const [list, setList] = useState<Player[]>([])
  const [q, setQ] = useState('')
  const load = useCallback((query = '') => run(async () => setList(await api<Player[]>(`players?q=${encodeURIComponent(query)}`))), [run])
  useEffect(() => { load() }, [load])
  return { list, q, setQ, load }
}

function PlayerList({ players, selected, onSelect }: { players: ReturnType<typeof usePlayers>; selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={card}>
      <div className="flex gap-2">
        <input className="rounded-lg px-3 py-2 text-sm flex-1" style={input} placeholder="이름 · Steam ID · install ID" value={players.q}
          onChange={(e) => players.setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') players.load(players.q) }} />
        <Button onClick={() => players.load(players.q)}>찾기</Button>
      </div>
      <div className="flex flex-col gap-1 max-h-[560px] overflow-auto">
        {players.list.length === 0 && <div className="text-sm" style={muted}>올라온 계정이 없어요.</div>}
        {players.list.map((p) => (
          <button key={p.install_id} onClick={() => onSelect(p.install_id)} className="text-left rounded-lg px-3 py-2 text-sm"
            style={{ background: selected === p.install_id ? 'var(--accent)' : 'transparent', color: selected === p.install_id ? '#fff' : 'var(--foreground)' }}>
            <div className="flex gap-2 items-center">
              <span className="font-semibold flex-1 truncate">{p.name || '(이름 없음)'}</span>
              {p.banned ? <span className="text-xs px-1.5 rounded" style={{ background: '#b33a3a' }}>제재</span> : null}
              {p.open_flags ? <span className="text-xs px-1.5 rounded" style={{ background: '#8a6d1f' }}>⚠ {p.open_flags}</span> : null}
            </div>
            <div className="text-xs opacity-75">Lv.{p.level} · {p.matches}판 · 코인 {p.coins.toLocaleString()} · 젬 {p.gems} · {when(p.last_seen)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function useDetail(run: Run, install: string) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const load = useCallback(() => {
    if (!install) return Promise.resolve()
    return run(async () => setDetail(await api<Detail>(`players/${encodeURIComponent(install)}`)))
  }, [run, install])
  useEffect(() => { load() }, [load])
  // 다른 계정을 고르면 새 상세가 올 때까지 비운다
  return { detail: detail && detail.player.install_id === install ? detail : null, load }
}

function Players({ run, selected, setSelected, onRecords }: { run: Run; selected: string; setSelected: (s: string) => void; onRecords: (install: string) => void }) {
  const players = usePlayers(run)
  const { detail, load } = useDetail(run, selected)
  const [grant, setGrant] = useState({ coins: '', gems: '', item: '', note: '' })
  const [reason, setReason] = useState('')
  const reloadAll = async () => { await load(); await players.load(players.q) }

  const sendGrant = () => run(async () => {
    await api('grants', 'POST', { installId: selected, coins: Number(grant.coins) || 0, gems: Number(grant.gems) || 0, item: grant.item.trim(), note: grant.note })
    setGrant({ coins: '', gems: '', item: '', note: '' })
    await load()
  })
  const ban = (banned: boolean) => run(async () => {
    if (banned && !confirm('이 계정을 제재할까요? 통계·계정 업로드를 막고 게임 시작 때 안내를 띄워요.')) return
    await api(`players/${encodeURIComponent(selected)}/ban`, 'POST', { banned, reason })
    setReason('')
    await reloadAll()
  })
  const removeGrant = (id: number) => run(async () => { await api(`grants/${id}`, 'DELETE'); await load() })
  const removePlayer = () => run(async () => {
    if (!confirm('이 계정의 서버 기록(요약·전적·표시·안 받은 지급)을 모두 지울까요? 게임 PC의 계정은 그대로예요.')) return
    await api(`players/${encodeURIComponent(selected)}`, 'DELETE')
    setSelected('')
    await players.load(players.q)
  })

  const p = detail?.player
  return (
    <div className="grid md:grid-cols-[340px_1fr] gap-5">
      <PlayerList players={players} selected={selected} onSelect={setSelected} />
      {!p ? (
        <div className="rounded-xl p-5 text-sm" style={{ ...card, ...muted }}>왼쪽에서 계정을 고르세요.</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-5 flex flex-col gap-2" style={card}>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold flex-1">{p.name || '(이름 없음)'}</h2>
              {p.banned ? <span className="text-sm px-2 py-0.5 rounded" style={{ background: '#b33a3a' }}>제재 중: {p.ban_reason || '사유 없음'}</span> : null}
            </div>
            <div className="text-xs font-mono" style={muted}>install {p.install_id} · Steam {p.steam_id || '—'} · 버전 {p.version || '—'}</div>
            <div className="grid grid-cols-4 gap-3 text-sm mt-2">
              {[['레벨', p.level], ['판 수', p.matches], ['승리', p.wins], ['킬', p.kills], ['코인', p.coins.toLocaleString()], ['젬', p.gems], ['보유 꾸미기', p.owned_count], ['방장으로 올린 매치', detail.hostedMatches]].map(([k, v]) => (
                <div key={k as string}><div className="text-xs" style={muted}>{k}</div><div className="font-semibold">{v}</div></div>
              ))}
            </div>
            <div className="text-xs mt-1" style={muted}>처음 {when(p.first_seen)} · 마지막 {when(p.last_seen)}</div>
            <div className="flex gap-2 mt-2">
              <Button onClick={() => onRecords(p.install_id)}>전적 보기</Button>
              <Button tone="danger" onClick={removePlayer}>서버 기록 지우기</Button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
              <h3 className="font-semibold">지급</h3>
              <p className="text-xs" style={muted}>다음에 게임을 켤 때 받아 가고 &quot;운영자 선물&quot; 팝업이 떠요.</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="rounded-lg px-3 py-2 text-sm" style={input} placeholder="코인" inputMode="numeric" value={grant.coins} onChange={(e) => setGrant({ ...grant, coins: e.target.value.replace(/\D/g, '') })} />
                <input className="rounded-lg px-3 py-2 text-sm" style={input} placeholder="젬" inputMode="numeric" value={grant.gems} onChange={(e) => setGrant({ ...grant, gems: e.target.value.replace(/\D/g, '') })} />
              </div>
              <select className="rounded-lg px-3 py-2 text-sm" style={input} value={grant.item} onChange={(e) => setGrant({ ...grant, item: e.target.value })}>
                <option value="">꾸미기 없음</option>
                {[...new Set(COSMETICS.map((c) => c.kind))].map((kind) => (
                  <optgroup key={kind} label={kind}>
                    {COSMETICS.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.id})</option>)}
                  </optgroup>
                ))}
              </select>
              <input className="rounded-lg px-3 py-2 text-sm" style={input} placeholder="메모 (게임에도 보여요)" maxLength={200} value={grant.note} onChange={(e) => setGrant({ ...grant, note: e.target.value })} />
              <Button tone="accent" onClick={sendGrant} disabled={!grant.coins && !grant.gems && !grant.item}>지급하기</Button>
              <div className="flex flex-col gap-1 text-xs">
                {detail.grants.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <span className="flex-1">#{g.id} 코인 {g.coins} · 젬 {g.gems}{g.item_id ? ` · ${cosmeticName(g.item_id) ?? g.item_id}` : ''}{g.note ? ` — ${g.note}` : ''}</span>
                    <span style={muted}>{g.claimed_at ? `받음 ${when(g.claimed_at)}` : '대기'}</span>
                    {!g.claimed_at && <button className="underline" onClick={() => removeGrant(g.id)}>취소</button>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
              <h3 className="font-semibold">제재</h3>
              <p className="text-xs" style={muted}>통계·계정 업로드를 403으로 막고, 게임 시작 때 사유를 띄워요. 계정은 각자 PC에 있어서 게임을 아예 못 하게 막지는 못해요.</p>
              {p.banned ? (
                <Button tone="accent" onClick={() => ban(false)}>제재 풀기</Button>
              ) : (
                <>
                  <input className="rounded-lg px-3 py-2 text-sm" style={input} placeholder="사유 (게임에 보여요)" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />
                  <Button tone="danger" onClick={() => ban(true)}>제재하기</Button>
                </>
              )}
              <h3 className="font-semibold mt-2">플레이 체크</h3>
              {detail.flags.length === 0 ? <div className="text-xs" style={muted}>표시 없음</div> : detail.flags.map((f) => (
                <div key={f.id} className="text-xs" style={{ opacity: f.resolved ? 0.5 : 1 }}>{f.resolved ? '✓ 처리함' : '⚠'} {RULES[f.rule] ?? f.rule} — {localize(f.detail)}</div>
              ))}
            </div>
          </div>

          <details className="rounded-xl p-5" style={card}>
            <summary className="cursor-pointer font-semibold">게임이 올린 계정 값 (JSON)</summary>
            <pre className="text-xs mt-3 overflow-auto max-h-96">{JSON.stringify(p.snapshot, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  )
}

// ───────── 전적 ─────────

function Records({ run, selected, setSelected }: { run: Run; selected: string; setSelected: (s: string) => void }) {
  const players = usePlayers(run)
  const { detail, load } = useDetail(run, selected)
  const exclude = (m: PlayerMatch) => run(async () => {
    await api(`players/${encodeURIComponent(selected)}/matches/exclude`, 'POST', { playedAt: m.played_at, excluded: m.excluded !== 1 })
    await load()
  })
  const counted = detail?.matches.filter((m) => !m.excluded) ?? []
  const wins = counted.filter((m) => m.won).length

  return (
    <div className="grid md:grid-cols-[340px_1fr] gap-5">
      <PlayerList players={players} selected={selected} onSelect={setSelected} />
      {!detail ? (
        <div className="rounded-xl p-5 text-sm" style={{ ...card, ...muted }}>왼쪽에서 계정을 고르세요.</div>
      ) : (
        <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
          <h2 className="font-semibold">{detail.player.name || '(이름 없음)'} — 최근 {detail.matches.length}판</h2>
          <p className="text-xs" style={muted}>게임이 계정을 올릴 때 함께 보낸 판들이에요 (최근 20판씩 쌓임). 버그·조작으로 보이는 판은 &quot;제외&quot;하면 규칙 검사(하루 판 수)에서 빠져요.</p>
          <div className="text-sm">집계: {counted.length}판 · 승 {wins} ({counted.length ? Math.round((wins / counted.length) * 100) : 0}%) · 평균 킬 {counted.length ? (counted.reduce((s, m) => s + m.kills, 0) / counted.length).toFixed(1) : 0}</div>
          <table className="text-sm w-full">
            <thead><tr className="text-left text-xs" style={muted}><th className="py-1">시각</th><th>모드</th><th>순위</th><th>킬/데스</th><th>승</th><th>코인</th><th></th></tr></thead>
            <tbody>
              {detail.matches.map((m) => (
                <tr key={m.played_at} className="border-t" style={{ borderColor: 'var(--card-border)', opacity: m.excluded ? 0.45 : 1 }}>
                  <td className="py-1.5">{when(m.played_at)}</td>
                  <td>{modeName(m.mode)}</td>
                  <td>{m.rank} / {m.players}</td>
                  <td>{m.kills} / {m.deaths}</td>
                  <td>{m.won ? '🏆' : ''}</td>
                  <td>{m.coins}</td>
                  <td className="text-right"><button className="underline text-xs" onClick={() => exclude(m)}>{m.excluded ? '되돌리기' : '제외'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ───────── 통계 ─────────

type Overview = {
  totals: { matches: number; installs: number; avg_duration: number | null; humans: number | null; avg_players: number | null }
  perDay: { day: string; matches: number; installs: number }[]
  modes: { mode: string; matches: number; avg_duration: number }[]
  versions: { version: string; matches: number; first_seen: string }[]
}
type HeroRow = { hero: string; n: number; winRate: number; expectedWin: number; avgRank: number; rankSe: number; kills: number; deaths: number; accuracy: number; verdict: -1 | 0 | 1 }

function Stats({ run }: { run: Run }) {
  const [ov, setOv] = useState<Overview | null>(null)
  const [heroes, setHeroes] = useState<HeroRow[]>([])
  const [source, setSource] = useState('release')
  const [who, setWho] = useState('human')

  useEffect(() => {
    run(async () => {
      const q = `source=${source}&who=${who}`
      setOv(await api<Overview>(`stats/overview?${q}`))
      setHeroes(await api<HeroRow[]>(`stats/heroes?${q}`))
    })
  }, [run, source, who])

  const pct = (v: number) => `${Math.round(v * 100)}%`
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3 text-sm items-center">
        <select className="rounded-lg px-3 py-2" style={input} value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="release">출시 빌드</option><option value="dev">개발 빌드</option><option value="sim">시뮬레이션</option>
        </select>
        <select className="rounded-lg px-3 py-2" style={input} value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="human">사람만</option><option value="all">봇 포함</option>
        </select>
        <a href="https://cubrawl.agonyang.com/" target="_blank" rel="noreferrer" className="underline" style={muted}>자세한 대시보드 ↗</a>
      </div>
      {ov && ov.totals.matches === 0 && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ ...card, ...muted }}>
          이 조건으로 올라온 매치가 없어요. {source === 'release' ? '아직 출시 빌드 기록이 없다면 위에서 "개발 빌드"를 골라 보세요.' : '다른 빌드·조건을 골라 보세요.'}
        </div>
      )}
      {ov && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl p-5" style={card}>
            <h3 className="font-semibold mb-2">전체</h3>
            <div className="text-sm flex flex-col gap-1">
              <div>매치 {ov.totals.matches} · 설치 {ov.totals.installs}</div>
              <div>평균 {Math.round(ov.totals.avg_duration ?? 0)}초 · 평균 {(ov.totals.avg_players ?? 0).toFixed(1)}명</div>
            </div>
            <h3 className="font-semibold mt-4 mb-2">모드</h3>
            {ov.modes.map((m) => <div key={m.mode} className="text-sm">{modeName(m.mode)} — {m.matches}판 · {Math.round(m.avg_duration)}초</div>)}
          </div>
          <div className="rounded-xl p-5" style={card}>
            <h3 className="font-semibold mb-2">날짜별 <span className="text-xs font-normal" style={muted}>(UTC 날짜 · 한국 오전 9시에 바뀜)</span></h3>
            <div className="text-sm max-h-64 overflow-auto">
              {ov.perDay.slice(0, 30).map((d) => <div key={d.day} className="flex justify-between"><span>{d.day}</span><span>{d.matches}판 · {d.installs}명</span></div>)}
            </div>
          </div>
          <div className="rounded-xl p-5" style={card}>
            <h3 className="font-semibold mb-2">버전</h3>
            {ov.versions.map((v) => <div key={v.version} className="text-sm">{v.version} — {v.matches}판 (처음 {when(v.first_seen)})</div>)}
          </div>
        </div>
      )}
      <div className="rounded-xl p-5" style={card}>
        <h3 className="font-semibold mb-2">캐릭터별</h3>
        <table className="text-sm w-full">
          <thead><tr className="text-left text-xs" style={muted}><th className="py-1">캐릭터</th><th>판</th><th>승률 (기준)</th><th>평균 순위</th><th>킬/데스</th><th>명중률</th><th>판정</th></tr></thead>
          <tbody>
            {heroes.map((h) => (
              <tr key={h.hero} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
                <td className="py-1.5">{heroName(h.hero)}</td><td>{h.n}</td><td>{pct(h.winRate)} ({pct(h.expectedWin)})</td>
                <td>{h.avgRank.toFixed(2)} ± {h.rankSe.toFixed(2)}</td><td>{h.kills.toFixed(1)} / {h.deaths.toFixed(1)}</td><td>{pct(h.accuracy)}</td>
                <td>{h.verdict === 1 ? '🔺 강함' : h.verdict === -1 ? '🔻 약함' : '적정'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ───────── 플레이 체크 ─────────

function Flags({ run, onOpen }: { run: Run; onOpen: (install: string) => void }) {
  const [list, setList] = useState<Flag[]>([])
  const [resolved, setResolved] = useState(false)
  const load = useCallback(() => run(async () => setList(await api<Flag[]>(`flags?resolved=${resolved ? 1 : 0}`))), [run, resolved])
  useEffect(() => { load() }, [load])
  const mark = (f: Flag) => run(async () => { await api(`flags/${f.id}`, 'POST', { resolved: !f.resolved }); await load() })

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
      <div className="flex items-center gap-3">
        <p className="text-sm flex-1" style={muted}>계정을 올릴 때 규칙에 걸린 것들이에요. 확인했으면 &quot;처리&quot;를 누르세요. 조작이면 계정 탭에서 제재하세요.</p>
        <Button onClick={() => setResolved(!resolved)}>{resolved ? '처리 안 한 것 보기' : '처리한 것 보기'}</Button>
      </div>
      <div className="text-xs flex flex-wrap gap-x-4 gap-y-1" style={muted}>
        {Object.entries(RULES).map(([k, v]) => <span key={k}><code>{k}</code> {v}</span>)}
      </div>
      <table className="text-sm w-full">
        <thead><tr className="text-left text-xs" style={muted}><th className="py-1">시각</th><th>계정</th><th>규칙</th><th>내용</th><th></th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={5} className="py-3" style={muted}>없어요.</td></tr>}
          {list.map((f) => (
            <tr key={f.id} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
              <td className="py-1.5 whitespace-nowrap">{when(f.created_at)}</td>
              <td><button className="underline" onClick={() => onOpen(f.install_id)}>{f.name || f.install_id.slice(0, 8)}</button></td>
              <td title={RULES[f.rule]}>{f.rule}</td>
              <td>{localize(f.detail)}</td>
              <td className="text-right"><button className="underline text-xs" onClick={() => mark(f)}>{f.resolved ? '되돌리기' : '처리'}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────── 결제 (Steam 게임 안 결제 장부) ─────────

type Order = { orderid: string; steam_id: string; install_id: string; product: string; currency: string; amount: number; status: string; error: string; created_at: string; updated_at: string }
type PurchaseInfo = { enabled: boolean; sandbox: boolean; summary: { currency: string; status: string; count: number; total: number }[]; orders: Order[] }

const PRODUCT_NAMES: Record<string, string> = { gems_100: '젬 100', gems_550: '젬 550', gems_1150: '젬 1,150', pass_s1: '프리미엄 패스 (시즌 1)' }
const ORDER_STATUS: Record<string, string> = { pending: '승인 기다림', done: '완료', canceled: '취소', failed: '실패', refunded: '환불' }
const money = (currency: string, amount: number) => currency === 'KRW' ? `₩${amount.toLocaleString('ko-KR')}` : `${amount.toFixed(2)} ${currency}`

function Purchases({ run }: { run: Run }) {
  const [info, setInfo] = useState<PurchaseInfo | null>(null)
  const [steam, setSteam] = useState('')
  const load = useCallback(() => run(async () => setInfo(await api<PurchaseInfo>(`purchases${/^\d+$/.test(steam) ? `?steam=${steam}` : ''}`))), [run, steam])
  useEffect(() => { load() }, [load])
  if (!info) return null
  const done = info.summary.filter((r) => r.status === 'done')

  return (
    <div className="rounded-xl p-5 flex flex-col gap-3" style={card}>
      <p className="text-sm" style={muted}>
        {info.enabled
          ? (info.sandbox ? '결제 열림 — 시험 결제(돈이 나가지 않음). 출시 때 STEAM_SANDBOX=0.' : '결제 열림 — 실제 결제.')
          : '결제 닫힘 — cubrawl-stats .env 에 STEAM_WEBAPI_KEY·STEAM_APP_ID 를 넣으면 열려요.'}
        {' '}환불은 Steam 보고서를 30분마다 읽어 반영하고, 게임이 다음에 들어올 때 회수해요.
      </p>
      <div className="flex flex-wrap gap-3">
        {done.length === 0 && <span className="text-sm" style={muted}>아직 완료된 결제가 없어요.</span>}
        {done.map((r) => (
          <div key={r.currency} className="rounded-lg px-4 py-2" style={input}>
            <div className="text-xs" style={muted}>{r.currency} 매출 ({r.count}건)</div>
            <div className="text-lg font-semibold">{money(r.currency, r.total)}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <input className="rounded px-2 py-1 text-sm w-64" style={input} placeholder="Steam ID 로 찾기" value={steam} onChange={(e) => setSteam(e.target.value.trim())} />
        <Button onClick={load}>새로고침</Button>
      </div>
      <table className="text-sm w-full">
        <thead><tr className="text-left text-xs" style={muted}><th className="py-1">시각</th><th>Steam ID</th><th>상품</th><th>금액</th><th>상태</th><th>주문 번호</th></tr></thead>
        <tbody>
          {info.orders.length === 0 && <tr><td colSpan={6} className="py-3" style={muted}>없어요.</td></tr>}
          {info.orders.map((o) => (
            <tr key={o.orderid} className="border-t" style={{ borderColor: 'var(--card-border)' }}>
              <td className="py-1.5 whitespace-nowrap">{when(o.created_at)}</td>
              <td><code>{o.steam_id}</code></td>
              <td>{PRODUCT_NAMES[o.product] ?? o.product}</td>
              <td>{money(o.currency, o.amount / 100)}</td>
              <td title={o.error}>{ORDER_STATUS[o.status] ?? o.status}{o.error ? ' ⚠' : ''}</td>
              <td className="text-xs" style={muted}><code>{o.orderid}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
