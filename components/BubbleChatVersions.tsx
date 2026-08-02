'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import DeployPanel from './DeployPanel'

type Version = { hash: string; message: string; date: string; notes: string | null } | null
type HistoryEntry = { id: string; git_commit: string | null; notes: string | null; status: string; started_at: string; finished_at: string | null }
type VersionsResponse = { current: Version; history: HistoryEntry[] }

const TEST_PROJECT = 'bubblechat-test'
const PROD_PROJECT = 'bubblechat'

async function fetchVersions(projectId: string): Promise<VersionsResponse> {
  const res = await fetch(`/api/deploy/versions?projectId=${projectId}`)
  return res.json()
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'success' ? '#4ade80' : status === 'running' ? '#facc15' : '#f87171'
  return <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
}

function HistoryList({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) return <p className="text-xs" style={{ color: 'var(--muted)' }}>배포 이력이 없습니다.</p>
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {history.map((h) => (
        <div key={h.id} className="flex items-start gap-2 text-xs">
          <StatusDot status={h.status} />
          <span className="font-mono flex-shrink-0" style={{ color: 'var(--muted)' }}>{h.git_commit ?? '?'}</span>
          <span className="flex-1 min-w-0 truncate" style={{ color: 'var(--foreground)' }}>{h.notes || '(내역 없음)'}</span>
          <span className="flex-shrink-0" style={{ color: 'var(--muted)' }}>{new Date(h.started_at).toLocaleDateString('ko-KR')}</span>
        </div>
      ))}
    </div>
  )
}

export default function BubbleChatVersions() {
  const [testData, setTestData] = useState<VersionsResponse | null>(null)
  const [prodData, setProdData] = useState<VersionsResponse | null>(null)
  const [promoteNotes, setPromoteNotes] = useState('')
  const notesTouchedRef = useRef(false)

  const [promoting, setPromoting] = useState(false)
  const [promoteLogs, setPromoteLogs] = useState<string[]>([])
  const [promoteStatus, setPromoteStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle')

  const refresh = useCallback(async () => {
    const [t, p] = await Promise.all([fetchVersions(TEST_PROJECT), fetchVersions(PROD_PROJECT)])
    setTestData(t)
    setProdData(p)
    if (!notesTouchedRef.current) setPromoteNotes(t.current?.notes ?? '')
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handlePromote = async () => {
    setPromoting(true)
    setPromoteLogs([])
    setPromoteStatus('running')

    const res = await fetch('/api/deploy/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromProjectId: TEST_PROJECT, toProjectId: PROD_PROJECT, notes: promoteNotes }),
    })
    if (!res.ok) {
      setPromoteLogs(['배포 시작 실패: ' + (await res.text())])
      setPromoteStatus('failed')
      setPromoting(false)
      return
    }

    const { jobId } = await res.json()
    const es = new EventSource(`/api/deploy/${jobId}/stream`)
    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'log') {
        setPromoteLogs((prev) => [...prev, data.line])
      } else if (data.type === 'done') {
        setPromoteStatus(data.status)
        setPromoting(false)
        es.close()
        if (data.status === 'success') {
          notesTouchedRef.current = false
          refresh()
        }
      } else if (data.type === 'error') {
        setPromoteLogs((prev) => [...prev, '❌ ' + data.message])
        setPromoteStatus('failed')
        setPromoting(false)
        es.close()
      }
    }
    es.onerror = () => {
      setPromoteStatus('failed')
      setPromoting(false)
      es.close()
    }
  }

  const promoteStatusLabel = { idle: '', running: '배포 중…', success: '✓ 배포 완료', failed: '✗ 배포 실패' }[promoteStatus]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 테스트 서버 */}
      <section className="rounded-xl p-5 flex flex-col gap-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">테스트 서버</h2>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(250,204,21,0.15)', color: '#facc15' }}>TEST</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>http://112.168.76.70:9401</p>
        </div>

        {testData?.current ? (
          <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#60a5fa' }}>{testData.current.hash}</span>
              <span>{testData.current.date}</span>
            </div>
            <p className="text-sm mt-1.5">{testData.current.message}</p>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>버전 정보를 불러오는 중…</p>
        )}

        <div>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>새 코드 배포 (git pull → 빌드 → 재기동)</p>
          <DeployPanel projectId={TEST_PROJECT} onDeployed={refresh} />
        </div>

        <div className="pt-3 flex flex-col gap-1.5" style={{ borderTop: '1px solid var(--card-border)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>이 버전을 프로덕션으로 배포</p>
          <textarea
            value={promoteNotes}
            onChange={(e) => { notesTouchedRef.current = true; setPromoteNotes(e.target.value) }}
            disabled={promoting}
            placeholder="본서버에 반영할 업데이트 내역"
            rows={3}
            className="rounded-lg p-2 text-xs font-mono resize-y"
            style={{ background: '#020617', border: '1px solid var(--card-border)', color: '#e2e8f0' }}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handlePromote}
              disabled={promoting || !testData?.current}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity"
              style={{ background: promoting ? '#374151' : '#b91c1c', color: '#fff', opacity: promoting ? 0.7 : 1 }}
            >
              {promoting ? '배포 중…' : '🚀 이 버전을 프로덕션에 배포'}
            </button>
            {promoteStatusLabel && <span className="text-sm" style={{ color: promoteStatus === 'success' ? 'var(--success)' : promoteStatus === 'failed' ? 'var(--danger)' : 'var(--muted)' }}>{promoteStatusLabel}</span>}
          </div>
          {promoteLogs.length > 0 && (
            <div className="rounded-lg p-3 text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap" style={{ background: '#020617', border: '1px solid var(--card-border)', color: '#94a3b8' }}>
              {promoteLogs.join('')}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>최근 배포 이력</p>
          <HistoryList history={testData?.history ?? []} />
        </div>
      </section>

      {/* 프로덕션 */}
      <section className="rounded-xl p-5 flex flex-col gap-4" style={{ background: 'var(--card)', border: '1px solid #7f1d1d' }}>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">프로덕션</h2>
            <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>PROD</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>https://bubblechat.agonyang.com</p>
        </div>

        {prodData?.current ? (
          <div className="rounded-lg p-3" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <span className="font-mono px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#60a5fa' }}>{prodData.current.hash}</span>
              <span>{prodData.current.date}</span>
            </div>
            <p className="text-sm mt-1.5">{prodData.current.message}</p>
            {prodData.current.notes && (
              <p className="text-xs mt-2 whitespace-pre-wrap" style={{ color: 'var(--foreground)' }}>{prodData.current.notes}</p>
            )}
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--muted)' }}>버전 정보를 불러오는 중…</p>
        )}

        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          프로덕션은 왼쪽 테스트 서버에서 검증한 버전을 "배포" 버튼으로 승격하는 방식으로만 갱신됩니다.
        </p>

        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>최근 배포 이력</p>
          <HistoryList history={prodData?.history ?? []} />
        </div>
      </section>
    </div>
  )
}
