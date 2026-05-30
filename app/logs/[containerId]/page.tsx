'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'

export default function LogsPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = use(params)
  const [logs, setLogs] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const fetchLogs = async () => {
    const res = await fetch(`/api/docker/containers/${containerId}?tail=200`)
    const data = await res.json()
    setLogs(data.logs ?? data.error ?? '')
    setLoading(false)
  }

  useEffect(() => {
    fetchLogs()
  }, [containerId])

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">로그 — <code className="text-lg">{containerId}</code></h1>
        <button
          onClick={fetchLogs}
          className="text-sm px-4 py-2 rounded-lg"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          새로고침
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>로그 로딩 중…</p>
      ) : (
        <pre
          className="rounded-xl p-4 text-xs overflow-auto max-h-[75vh] whitespace-pre-wrap"
          style={{ background: '#020617', border: '1px solid var(--card-border)', color: '#94a3b8', fontFamily: 'monospace' }}
        >
          {logs || '(로그 없음)'}
        </pre>
      )}
    </div>
  )
}
