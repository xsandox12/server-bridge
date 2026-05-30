'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  projectId: string
}

export default function DeployPanel({ projectId }: Props) {
  const [deploying, setDeploying] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleDeploy = async () => {
    setDeploying(true)
    setLogs([])
    setStatus('running')

    const res = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    })

    if (!res.ok) {
      setLogs(['배포 시작 실패: ' + (await res.text())])
      setStatus('failed')
      setDeploying(false)
      return
    }

    const { jobId } = await res.json()
    const es = new EventSource(`/api/deploy/${jobId}/stream`)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'log') {
        setLogs((prev) => [...prev, data.line])
      } else if (data.type === 'done') {
        setStatus(data.status)
        setDeploying(false)
        es.close()
      } else if (data.type === 'error') {
        setLogs((prev) => [...prev, '❌ ' + data.message])
        setStatus('failed')
        setDeploying(false)
        es.close()
      }
    }

    es.onerror = () => {
      setStatus('failed')
      setDeploying(false)
      es.close()
    }
  }

  const statusColor = status === 'success' ? 'var(--success)' : status === 'failed' ? 'var(--danger)' : 'var(--muted)'
  const statusLabel = { idle: '', running: '배포 중…', success: '✓ 배포 완료', failed: '✗ 배포 실패' }[status]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
          style={{ background: deploying ? '#374151' : '#1d4ed8', color: '#fff', opacity: deploying ? 0.7 : 1 }}
        >
          {deploying ? '배포 중…' : '🚀 배포'}
        </button>
        {statusLabel && (
          <span className="text-sm" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        )}
      </div>

      {logs.length > 0 && (
        <div
          ref={logRef}
          className="rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap"
          style={{ background: '#020617', border: '1px solid var(--card-border)', color: '#94a3b8' }}
        >
          {logs.join('')}
        </div>
      )}
    </div>
  )
}
