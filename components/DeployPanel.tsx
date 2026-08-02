'use client'

import { useState, useRef, useEffect } from 'react'

interface Props {
  projectId: string
  onDeployed?: () => void
}

export default function DeployPanel({ projectId, onDeployed }: Props) {
  const [deploying, setDeploying] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')
  const [notes, setNotes] = useState('')
  const [draftingNotes, setDraftingNotes] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleDraftNotes = async () => {
    setDraftingNotes(true)
    try {
      const res = await fetch('/api/deploy/draft-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json()
      if (data.notes) setNotes(data.notes)
    } finally {
      setDraftingNotes(false)
    }
  }

  const handleDeploy = async () => {
    setDeploying(true)
    setLogs([])
    setStatus('running')

    const res = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, notes }),
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
        if (data.status === 'success') onDeployed?.()
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>업데이트 내역</span>
          <button
            onClick={handleDraftNotes}
            disabled={draftingNotes || deploying}
            className="text-xs px-2 py-0.5 rounded transition-opacity"
            style={{ background: '#1e293b', color: '#94a3b8', opacity: draftingNotes ? 0.6 : 1 }}
          >
            {draftingNotes ? '생성 중…' : '✨ AI 초안 생성'}
          </button>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={deploying}
          placeholder="이번 배포에서 바뀐 내용을 적어주세요"
          rows={3}
          className="rounded-lg p-2 text-xs font-mono resize-y"
          style={{ background: '#020617', border: '1px solid var(--card-border)', color: '#e2e8f0' }}
        />
      </div>

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
