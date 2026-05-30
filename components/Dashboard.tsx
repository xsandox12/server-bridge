'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Container {
  id: string
  name: string
  status: string
  state: string
  ports: { host: number; container: number; protocol: string }[]
  image: string
  created: number
}

function statusColor(state: string) {
  if (state === 'running') return 'var(--success)'
  if (state === 'exited') return 'var(--muted)'
  return 'var(--danger)'
}

function ContainerCard({ c, onAction }: { c: Container; onAction: (id: string, action: string) => void }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: statusColor(c.state), boxShadow: c.state === 'running' ? `0 0 6px ${statusColor(c.state)}` : 'none' }}
          />
          <span className="font-medium text-sm truncate max-w-[180px]">{c.name}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#0f172a', color: 'var(--muted)' }}>
          {c.state}
        </span>
      </div>

      <div className="text-xs" style={{ color: 'var(--muted)' }}>
        {c.image.length > 36 ? c.image.slice(0, 36) + '…' : c.image}
      </div>

      {c.ports.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {c.ports.map((p) => (
            <a
              key={p.host}
              href={`http://localhost:${p.host}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: '#0f172a', color: 'var(--accent)' }}
            >
              :{p.host}
            </a>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-1">
        {c.state === 'running' ? (
          <>
            <button
              onClick={() => onAction(c.id, 'restart')}
              className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: '#1d4ed8', color: '#fff' }}
            >
              재시작
            </button>
            <button
              onClick={() => onAction(c.id, 'stop')}
              className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: '#7f1d1d', color: '#fca5a5' }}
            >
              중지
            </button>
          </>
        ) : (
          <button
            onClick={() => onAction(c.id, 'start')}
            className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: '#14532d', color: '#86efac' }}
          >
            시작
          </button>
        )}
        <Link
          href={`/logs/${c.id}`}
          className="text-xs px-3 py-1 rounded-lg transition-opacity hover:opacity-80"
          style={{ background: '#1e293b', color: 'var(--muted)', border: '1px solid var(--card-border)' }}
        >
          로그
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')

  const fetchContainers = async () => {
    try {
      const res = await fetch('/api/docker/containers')
      if (!res.ok) throw new Error(await res.text())
      setContainers(await res.json())
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContainers()
    const id = setInterval(fetchContainers, 15000)
    return () => clearInterval(id)
  }, [])

  const handleAction = async (id: string, action: string) => {
    setActionMsg(`${action} 중...`)
    await fetch(`/api/docker/containers/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    await fetchContainers()
    setActionMsg('')
  }

  const running = containers.filter((c) => c.state === 'running')
  const stopped = containers.filter((c) => c.state !== 'running')

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            112.168.76.70 — Docker 서비스 현황
          </p>
        </div>
        <div className="flex items-center gap-3">
          {actionMsg && (
            <span className="text-sm" style={{ color: 'var(--warning)' }}>{actionMsg}</span>
          )}
          <button
            onClick={fetchContainers}
            className="text-sm px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: '전체', value: containers.length, color: 'var(--foreground)' },
          { label: '실행 중', value: running.length, color: 'var(--success)' },
          { label: '중지됨', value: stopped.length, color: 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <div className="text-3xl font-bold" style={{ color }}>{value}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {loading && (
        <p className="text-center py-12" style={{ color: 'var(--muted)' }}>컨테이너 정보 로딩 중…</p>
      )}
      {error && (
        <div className="rounded-xl p-4 mb-6" style={{ background: '#450a0a', border: '1px solid #991b1b', color: '#fca5a5' }}>
          Docker 연결 오류: {error}
        </div>
      )}

      {running.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            실행 중 ({running.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {running.map((c) => (
              <ContainerCard key={c.id} c={c} onAction={handleAction} />
            ))}
          </div>
        </section>
      )}

      {stopped.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            중지됨 ({stopped.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stopped.map((c) => (
              <ContainerCard key={c.id} c={c} onAction={handleAction} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
