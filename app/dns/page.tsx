'use client'

import { useState, useEffect } from 'react'

interface DnsRecord {
  id: string
  type: string
  name: string
  content: string
  proxied: boolean
  ttl: number
  modified_on: string
}

function EditableRecord({ record }: { record: DnsRecord }) {
  const [content, setContent] = useState(record.content)
  const [proxied, setProxied] = useState(record.proxied)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const dirty = content !== record.content || proxied !== record.proxied

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/dns/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, proxied }),
    })
    setMsg(res.ok ? '저장됨' : '실패')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <span
        className="text-xs font-mono px-2 py-0.5 rounded font-semibold flex-shrink-0"
        style={{ background: '#1e3a5f', color: '#60a5fa' }}
      >
        {record.type}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{record.name}</p>
        <div className="flex items-center gap-2 mt-1">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="text-xs font-mono rounded px-2 py-1 flex-1 min-w-0"
            style={{ background: '#0f172a', border: `1px solid ${dirty ? 'var(--accent)' : 'var(--card-border)'}`, color: 'var(--foreground)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
          <input
            type="checkbox"
            checked={proxied}
            onChange={(e) => setProxied(e.target.checked)}
            className="rounded"
          />
          Proxied
        </label>

        {dirty && (
          <button
            onClick={save}
            disabled={saving}
            className="text-xs px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--accent)', color: '#fff', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        )}
        {msg && <span className="text-xs" style={{ color: msg === '저장됨' ? '#4ade80' : '#f87171' }}>{msg}</span>}

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          TTL: {record.ttl === 1 ? 'Auto' : record.ttl}
        </p>
      </div>
    </div>
  )
}

export default function DnsPage() {
  const [records, setRecords] = useState<DnsRecord[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetch('/api/dns')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(typeof d.error === 'string' ? d.error : JSON.stringify(d.error))
        else setRecords(d.records ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = records.filter(
    (r) => !filter || r.name.includes(filter) || r.content.includes(filter) || r.type.includes(filter.toUpperCase())
  )

  const aRecords = filtered.filter((r) => r.type === 'A' || r.type === 'CNAME')
  const otherRecords = filtered.filter((r) => r.type !== 'A' && r.type !== 'CNAME')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">DNS 관리</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Cloudflare</p>
      </div>

      {loading && <p style={{ color: 'var(--muted)' }}>불러오는 중…</p>}

      {error && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <p className="text-sm font-semibold mb-1">Cloudflare 연결 오류</p>
          <p className="text-xs">{error}</p>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>설정 페이지에서 Cloudflare API Token과 Zone ID를 입력하세요.</p>
        </div>
      )}

      {!loading && !error && (
        <>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="레코드 이름 또는 값 검색…"
            className="w-full max-w-sm rounded-lg px-3 py-2 text-sm mb-4"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />

          {aRecords.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>A / CNAME ({aRecords.length})</p>
              <div className="flex flex-col gap-2">
                {aRecords.map((r) => <EditableRecord key={r.id} record={r} />)}
              </div>
            </div>
          )}

          {otherRecords.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>기타 레코드 ({otherRecords.length})</p>
              <div className="flex flex-col gap-2">
                {otherRecords.map((r) => <EditableRecord key={r.id} record={r} />)}
              </div>
            </div>
          )}

          {filtered.length === 0 && <p style={{ color: 'var(--muted)' }}>레코드 없음</p>}
        </>
      )}
    </div>
  )
}
