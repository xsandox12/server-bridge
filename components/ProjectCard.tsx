'use client'

import { useState, useEffect } from 'react'

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

export default function ProjectCard({
  project,
  domains,
  onOpenDetail,
  onGripMouseDown,
  onUpdate,
  isDragOver,
  isDragging,
}: {
  project: Project
  domains: Domain[]
  onOpenDetail: () => void
  onGripMouseDown: (e: React.MouseEvent) => void
  onUpdate: (patch: Partial<Project>) => void
  isDragOver: boolean
  isDragging: boolean
}) {
  const [containers, setContainers] = useState<Container[]>([])
  const [description, setDescription] = useState(project.description ?? '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [savingDesc, setSavingDesc] = useState(false)

  useEffect(() => {
    const fetchContainers = () => {
      fetch('/api/docker/containers').then((r) => r.json()).then((data) => {
        if (Array.isArray(data)) setContainers(data)
      }).catch(() => {})
    }
    fetchContainers()
    const t = setInterval(fetchContainers, 30000)
    return () => clearInterval(t)
  }, [])

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

  const projectContainers = containers.filter((c) => {
    const n = c.name.toLowerCase()
    if (project.docker_service) return n.includes(project.docker_service.toLowerCase())
    return n.includes(project.id.toLowerCase()) ||
      n.replace(/-/g, '').includes(project.id.toLowerCase().replace(/-/g, ''))
  })
  const isRunning = projectContainers.some((c) => c.state === 'running')
  const hasContainer = projectContainers.length > 0

  const statusColor = hasContainer ? (isRunning ? '#4ade80' : '#94a3b8') : '#475569'
  const statusBg = hasContainer ? (isRunning ? 'rgba(74,222,128,0.15)' : 'rgba(148,163,184,0.15)') : 'rgba(71,85,105,0.15)'
  const statusLabel = hasContainer ? (isRunning ? '실행 중' : '중지됨') : '컨테이너 없음'
  const statusGlow = isRunning ? '0 0 6px #4ade80' : 'none'

  return (
    <div
      data-project-id={project.id}
      onClick={onOpenDetail}
      className="proj-card rounded-2xl flex flex-col gap-2.5 cursor-pointer"
      style={{
        background: 'var(--card)',
        border: isDragOver ? '1px solid var(--accent)' : '1px solid var(--card-border)',
        padding: '16px 18px',
        minHeight: 190,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            onMouseDown={onGripMouseDown}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0 text-xs select-none"
            style={{ cursor: 'grab', color: 'var(--muted)' }}
            title="드래그해서 순서 변경"
          >
            ⠿
          </span>
          <span
            className="flex-shrink-0 rounded-full"
            style={{ width: 8, height: 8, background: statusColor, boxShadow: statusGlow }}
          />
          <h3 className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{project.name}</h3>
        </div>
        <span
          className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full"
          style={{ background: statusBg, color: statusColor }}
        >
          {statusLabel}
        </span>
      </div>

      <p className="text-xs font-mono truncate" style={{ color: 'var(--muted)' }}>{project.path}</p>

      <div className="flex items-start gap-1.5 flex-1">
        {editingDesc ? (
          <textarea
            autoFocus
            onClick={(e) => e.stopPropagation()}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveDescription}
            placeholder="프로젝트 설명 입력…"
            rows={4}
            className="text-xs w-full rounded-md p-1.5 resize-none flex-1"
            style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
        ) : (
          <>
            <p
              className="text-xs leading-relaxed flex-1 min-w-0"
              style={{
                color: description ? '#94a3b8' : 'var(--muted)',
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {savingDesc ? '저장 중…' : description || '설명 없음'}
            </p>
            <span
              className="desc-edit flex-shrink-0 text-xs cursor-pointer"
              style={{ color: 'var(--muted)' }}
              title="설명 편집"
              onClick={(e) => { e.stopPropagation(); setEditingDesc(true) }}
            >
              ✎
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-auto">
        {domains.length > 0 ? domains.map((d) => (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] no-underline flex items-center gap-1 px-2 py-1 rounded-full"
            style={{
              background: '#0f172a',
              border: '1px solid var(--card-border)',
              color: d.env === 'production' ? '#4ade80' : '#fb923c',
            }}
          >
            <span
              className="text-[8px] px-1 rounded"
              style={{ background: d.env === 'production' ? 'rgba(74,222,128,0.15)' : 'rgba(251,146,60,0.15)' }}
            >
              {d.env === 'production' ? 'PROD' : 'TEST'}
            </span>
            {d.label}
          </a>
        )) : (
          <span className="text-[11px]" style={{ color: 'var(--muted)' }}>도메인 없음</span>
        )}
      </div>
    </div>
  )
}
