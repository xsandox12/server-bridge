import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Log = { id: string; project_id: string; command: string; status: string; git_commit: string | null; started_at: string; finished_at: string | null }
type Project = { id: string; name: string }

function StatusBadge({ status }: { status: string }) {
  const color = status === 'success' ? '#4ade80' : status === 'running' ? '#facc15' : '#f87171'
  const bg = status === 'success' ? 'rgba(34,197,94,0.15)' : status === 'running' ? 'rgba(250,204,21,0.15)' : 'rgba(239,68,68,0.15)'
  const label = status === 'success' ? '성공' : status === 'running' ? '실행 중' : '실패'
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: bg, color }}>{label}</span>
  )
}

export default function HistoryPage() {
  const logs = db.prepare(
    'SELECT * FROM deploy_logs ORDER BY started_at DESC LIMIT 50'
  ).all() as Log[]

  const projects = db.prepare('SELECT id, name FROM projects').all() as Project[]
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">배포 이력</h1>

      {logs.length === 0 ? (
        <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
          <p className="text-lg">아직 배포 이력이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => {
            const duration = log.finished_at
              ? Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 1000)
              : null
            return (
              <div
                key={log.id}
                className="rounded-xl px-4 py-3 flex items-center gap-4"
                style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
              >
                <StatusBadge status={log.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{projectMap[log.project_id] ?? log.project_id}</span>
                    {log.git_commit && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: '#1e3a5f', color: '#60a5fa' }}>
                        {log.git_commit}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{log.command}</p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs" style={{ color: 'var(--foreground)' }}>
                    {new Date(log.started_at).toLocaleString('ko-KR')}
                  </p>
                  {duration !== null && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{duration}초 소요</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
