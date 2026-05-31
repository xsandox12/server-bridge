'use client'

import { useState, useEffect, useRef } from 'react'

interface Project {
  id: string
  name: string
  path: string
  deploy_cmd: string | null
  git_repo: string | null
  git_branch: string | null
}

interface Domain { id: string; label: string; url: string }

interface GitStatus {
  local: { branch: string; commit: string; message: string; dirty: boolean }
  remote: { commit: string; message: string; date: string } | null
}

interface Container { id: string; name: string; status: string; state: string }

interface DeployLog { git_commit: string | null; status: string; started_at: string }

type ActionState = 'idle' | 'running' | 'done' | 'error'

function StageBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 min-w-0 rounded-lg p-3 flex flex-col gap-1" style={{ background: '#0f172a', border: '1px solid var(--card-border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
      {children}
    </div>
  )
}

function Commit({ hash, message }: { hash: string; message: string }) {
  return (
    <div>
      <span className="text-xs font-mono px-1 py-0.5 rounded mr-1" style={{ background: '#1e3a5f', color: '#60a5fa' }}>{hash}</span>
      <span className="text-xs" style={{ color: 'var(--foreground)' }}>{message?.slice(0, 40)}</span>
    </div>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{
      background: ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      color: ok ? '#4ade80' : '#f87171',
    }}>{label}</span>
  )
}

function Arrow() {
  return <div className="flex items-center flex-shrink-0 px-1" style={{ color: 'var(--muted)' }}>→</div>
}

export default function PipelineCard({ project, domains }: { project: Project; domains: Domain[] }) {
  const [git, setGit] = useState<GitStatus | null>(null)
  const [containers, setContainers] = useState<Container[]>([])
  const [lastDeploy, setLastDeploy] = useState<DeployLog | null>(null)
  const [action, setAction] = useState<ActionState>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const fetchStatus = async () => {
    const [gitRes, dockerRes] = await Promise.all([
      fetch(`/api/git/${project.id}/status`).then((r) => r.json()).catch(() => null),
      fetch('/api/docker/containers').then((r) => r.json()).catch(() => []),
    ])
    if (gitRes && !gitRes.error) setGit(gitRes)
    if (Array.isArray(dockerRes)) setContainers(dockerRes)

    const deployRes = await fetch(`/api/deploy?projectId=${project.id}`).then((r) => r.json()).catch(() => null)
    if (Array.isArray(deployRes) && deployRes[0]) setLastDeploy(deployRes[0])
  }

  useEffect(() => {
    fetchStatus()
    const t = setInterval(fetchStatus, 30000)
    return () => clearInterval(t)
  }, [project.id])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const streamAction = async (url: string, method = 'POST') => {
    setAction('running')
    setLogs([])
    setShowLogs(true)
    const res = await fetch(url, { method })
    if (!res.body) { setAction('error'); return }
    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const msg = line.slice(6)
          if (msg === '__DONE__') { setAction('done'); await fetchStatus(); return }
          setLogs((l) => [...l, msg])
        }
      }
    }
    setAction('done')
    await fetchStatus()
  }

  const runPull = () => streamAction(`/api/git/${project.id}/pull`)
  const runDeploy = async () => {
    setAction('running')
    setLogs([])
    setShowLogs(true)
    const postRes = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    })
    const { jobId } = await postRes.json()
    return streamAction(`/api/deploy/${jobId}/stream`, 'GET')
  }
  const runPullAndDeploy = async () => {
    await runPull()
    await runDeploy()
  }

  const isDirty = git?.local.dirty
  const isAhead = git?.remote && git.local.commit !== git.remote.commit
  const projectContainers = containers.filter((c) =>
    c.name.toLowerCase().includes(project.id.toLowerCase()) ||
    c.name.toLowerCase().replace(/-/g, '').includes(project.id.toLowerCase().replace(/-/g, ''))
  )

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{project.name}</h3>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{project.path}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.deploy_cmd && (
            <>
              <button
                onClick={runPull}
                disabled={action === 'running'}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#1e3a5f', color: '#60a5fa', opacity: action === 'running' ? 0.5 : 1 }}
              >
                Pull
              </button>
              <button
                onClick={runDeploy}
                disabled={action === 'running'}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#2d1a4a', color: '#c084fc', opacity: action === 'running' ? 0.5 : 1 }}
              >
                Deploy
              </button>
              <button
                onClick={runPullAndDeploy}
                disabled={action === 'running'}
                className="text-xs px-3 py-1.5 rounded-lg font-medium"
                style={{ background: '#1a3a2a', color: '#4ade80', opacity: action === 'running' ? 0.5 : 1 }}
              >
                {action === 'running' ? '실행 중…' : 'Pull + Deploy'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 파이프라인 4단계 */}
      <div className="flex items-stretch gap-1">
        {/* GitHub */}
        <StageBox label="GitHub">
          {git?.remote ? (
            <>
              <Commit hash={git.remote.commit} message={git.remote.message} />
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{new Date(git.remote.date).toLocaleDateString('ko-KR')}</p>
              {project.git_repo && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{project.git_repo}</p>}
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{project.git_repo ? '연결 중…' : 'git_repo 미설정'}</p>
          )}
        </StageBox>

        <Arrow />

        {/* 미니PC */}
        <StageBox label="미니PC (git)">
          {git?.local ? (
            <>
              <Commit hash={git.local.commit} message={git.local.message} />
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{git.local.branch}</span>
                {isDirty && <StatusBadge ok={false} label="변경 있음" />}
                {isAhead && <StatusBadge ok={false} label="Pull 필요" />}
                {!isDirty && !isAhead && git.remote && <StatusBadge ok={true} label="최신" />}
              </div>
            </>
          ) : (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>git 없음</p>
          )}
        </StageBox>

        <Arrow />

        {/* Docker */}
        <StageBox label="Docker">
          {projectContainers.length > 0 ? projectContainers.map((c) => (
            <div key={c.id}>
              <StatusBadge ok={c.state === 'running'} label={c.state === 'running' ? '실행 중' : '중지됨'} />
              <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--muted)' }}>{c.name}</p>
            </div>
          )) : (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>컨테이너 없음</p>
          )}
          {lastDeploy && (
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
              마지막: {new Date(lastDeploy.started_at).toLocaleDateString('ko-KR')}
            </p>
          )}
        </StageBox>

        <Arrow />

        {/* DNS / 도메인 */}
        <StageBox label="도메인">
          {domains.length > 0 ? domains.map((d) => (
            <a key={d.id} href={d.url} target="_blank" rel="noopener noreferrer"
              className="text-xs hover:underline block"
              style={{ color: '#60a5fa' }}
            >
              {d.label}
            </a>
          )) : (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>도메인 없음</p>
          )}
          <a href="/dns" className="text-xs mt-1 block" style={{ color: 'var(--muted)' }}>DNS 관리 →</a>
        </StageBox>
      </div>

      {/* 로그 패널 */}
      {showLogs && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {action === 'running' ? '실행 중…' : action === 'done' ? '완료' : '오류'}
            </span>
            <button onClick={() => setShowLogs(false)} className="text-xs" style={{ color: 'var(--muted)' }}>닫기</button>
          </div>
          <div
            ref={logRef}
            className="rounded-lg p-3 text-xs font-mono overflow-y-auto max-h-40"
            style={{ background: '#020817', color: '#a3e635' }}
          >
            {logs.map((l, i) => <div key={i}>{l}</div>)}
            {action === 'running' && <div className="animate-pulse">▌</div>}
          </div>
        </div>
      )}
    </div>
  )
}
