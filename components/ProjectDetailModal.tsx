'use client'

import { useEffect, useState } from 'react'

interface Project {
  id: string
  name: string
  path: string
  deploy_cmd: string | null
  git_repo: string | null
  git_branch: string | null
  docker_service: string | null
  description: string | null
  group_name: string | null
}

interface Domain { id: string; label: string; url: string; env: string }
interface Container { id: string; name: string; status: string; state: string }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</p>
      {children}
    </div>
  )
}

export default function ProjectDetailModal({ project, domains, existingGroups, onClose, onUpdate }: { project: Project; domains: Domain[]; existingGroups: string[]; onClose: () => void; onUpdate: (patch: Partial<Project>) => void }) {
  const [containers, setContainers] = useState<Container[]>([])
  const [description, setDescription] = useState(project.description ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)
  const [groupName, setGroupName] = useState(project.group_name ?? '')
  const [editingGroup, setEditingGroup] = useState(false)

  useEffect(() => {
    fetch('/api/docker/containers').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setContainers(data)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveDescription = async () => {
    setEditingDesc(false)
    if (description === (project.description ?? '')) return
    setSavingDesc(true)
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description }),
    })
    setSavingDesc(false)
    onUpdate({ description })
  }

  const saveGroup = async () => {
    setEditingGroup(false)
    const next = groupName.trim()
    setGroupName(next)
    if (next === (project.group_name ?? '')) return
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_name: next || null }),
    })
    onUpdate({ group_name: next || null })
  }

  const projectContainers = containers.filter((c) => {
    const n = c.name.toLowerCase()
    if (project.docker_service) return n.includes(project.docker_service.toLowerCase())
    return n.includes(project.id.toLowerCase()) ||
      n.replace(/-/g, '').includes(project.id.toLowerCase().replace(/-/g, ''))
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl flex flex-col gap-4 max-h-[85vh] overflow-y-auto"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)', padding: '24px 28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold">{project.name}</h2>
          <button onClick={onClose} className="text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>✕ 닫기</button>
        </div>

        <Row label="경로">
          <p className="text-sm font-mono">{project.path}</p>
        </Row>

        <Row label="그룹">
          {editingGroup ? (
            <>
              <input
                autoFocus
                list="group-suggestions"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onBlur={saveGroup}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                placeholder="그룹 이름 (비워두면 미분류)"
                className="text-sm w-full rounded-md p-2"
                style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              />
              <datalist id="group-suggestions">
                {existingGroups.map((g) => <option key={g} value={g} />)}
              </datalist>
            </>
          ) : (
            <p
              onClick={() => setEditingGroup(true)}
              className="text-sm cursor-pointer hover:underline"
              style={{ color: groupName ? 'var(--foreground)' : 'var(--muted)' }}
              title="클릭해서 그룹 편집"
            >
              {groupName || '미분류 (클릭해서 그룹 지정)'}
            </p>
          )}
        </Row>

        <Row label="설명">
          {editingDesc ? (
            <textarea
              autoFocus
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={saveDescription}
              placeholder="프로젝트 설명 입력…"
              rows={4}
              className="text-sm w-full rounded-md p-2 resize-none"
              style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
            />
          ) : (
            <p
              onClick={() => setEditingDesc(true)}
              className="text-sm cursor-pointer hover:underline whitespace-pre-wrap"
              style={{ color: description ? 'var(--foreground)' : 'var(--muted)' }}
              title="클릭해서 설명 편집"
            >
              {savingDesc ? '저장 중…' : description || '설명 없음 (클릭해서 추가)'}
            </p>
          )}
        </Row>

        <Row label="Git">
          {project.git_repo ? (
            <p className="text-sm font-mono">{project.git_repo} ({project.git_branch ?? 'main'})</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>git_repo 미설정</p>
          )}
        </Row>

        <Row label="Docker 컨테이너">
          {projectContainers.length > 0 ? (
            <div className="flex flex-col gap-1">
              {projectContainers.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      background: c.state === 'running' ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)',
                      color: c.state === 'running' ? '#4ade80' : '#94a3b8',
                    }}
                  >
                    {c.state === 'running' ? '실행 중' : '중지됨'}
                  </span>
                  <span className="text-sm font-mono">{c.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>컨테이너 없음</p>
          )}
        </Row>

        <Row label="도메인">
          {domains.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {domains.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-2 hover:underline"
                  style={{ color: d.env === 'production' ? '#4ade80' : '#fb923c' }}
                >
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: d.env === 'production' ? 'rgba(74,222,128,0.15)' : 'rgba(251,146,60,0.15)' }}
                  >
                    {d.env === 'production' ? 'PROD' : 'TEST'}
                  </span>
                  {d.url}
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>도메인 없음</p>
          )}
        </Row>

        {project.deploy_cmd && (
          <Row label="배포 명령">
            <p className="text-xs font-mono p-2 rounded" style={{ background: '#0f172a', wordBreak: 'break-all' }}>{project.deploy_cmd}</p>
          </Row>
        )}

        <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <a href={`/projects/${project.id}`} className="text-sm font-medium mt-3" style={{ color: 'var(--accent)' }}>코드 편집 페이지 →</a>
          <a href="/history" className="text-sm font-medium mt-3" style={{ color: 'var(--accent)' }}>배포 이력 →</a>
        </div>
      </div>
    </div>
  )
}
