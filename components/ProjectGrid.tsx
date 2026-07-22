'use client'

import { useState, useEffect, useRef } from 'react'
import ProjectCard from './ProjectCard'
import ProjectDetailModal from './ProjectDetailModal'

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

interface Domain { id: string; project_id: string; label: string; url: string; env: string }

type Tab = 'deployed' | 'undeployed'

export default function ProjectGrid({ projects, domains, initialTab }: { projects: Project[]; domains: Domain[]; initialTab: Tab }) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [order, setOrder] = useState(projects) // 전체 정렬 순서 (서버에서 이미 sort_order로 정렬됨)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const draggedIdRef = useRef<string | null>(null)
  const dragOverIdRef = useRef<string | null>(null)

  const deployed = order.filter((p) => domains.some((d) => d.project_id === p.id && d.env === 'production'))
  const undeployed = order.filter((p) => !domains.some((d) => d.project_id === p.id && d.env === 'production'))
  const visible = activeTab === 'deployed' ? deployed : undeployed
  const selected = order.find((p) => p.id === selectedId) ?? null
  const existingGroups = [...new Set(order.map((p) => p.group_name).filter((g): g is string => !!g))]

  // group_name 기준으로 섹션 나누기 (등장 순서 유지). 그룹이 전혀 없으면 섹션 헤더 없이 평탄하게 표시.
  const groups: { key: string | null; items: Project[] }[] = []
  for (const p of visible) {
    const key = p.group_name || null
    let bucket = groups.find((g) => g.key === key)
    if (!bucket) { bucket = { key, items: [] }; groups.push(bucket) }
    bucket.items.push(p)
  }
  const hasGrouping = groups.some((g) => g.key !== null)

  const persistOrder = (newFullOrder: Project[]) => {
    setOrder(newFullOrder)
    fetch('/api/projects/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: newFullOrder.map((p) => p.id) }),
    }).catch(() => {})
  }

  const handleDrop = (fromId: string, targetId: string) => {
    if (fromId === targetId) return
    const fromProject = order.find((p) => p.id === fromId)
    const targetProject = order.find((p) => p.id === targetId)
    if (!fromProject || !targetProject) return

    const visibleIds = visible.map((p) => p.id)
    const from = visibleIds.indexOf(fromId)
    const to = visibleIds.indexOf(targetId)
    if (from === -1 || to === -1) return
    const reorderedVisibleIds = [...visibleIds]
    reorderedVisibleIds.splice(from, 1)
    reorderedVisibleIds.splice(to, 0, fromId)

    // 보이지 않는 항목의 상대 위치는 유지한 채, 보이는 항목만 새 순서로 병합
    const visibleSet = new Set(visibleIds)
    const queue = [...reorderedVisibleIds]
    const newGroup = targetProject.group_name
    const merged = order.map((p) => {
      if (!visibleSet.has(p.id)) return p
      const nextId = queue.shift()!
      const proj = order.find((op) => op.id === nextId)!
      // 다른 그룹의 카드에 드롭하면 해당 카드도 그 그룹으로 옮김
      if (proj.id === fromId && fromProject.group_name !== newGroup) {
        return { ...proj, group_name: newGroup }
      }
      return proj
    })

    persistOrder(merged)
    if (fromProject.group_name !== newGroup) {
      fetch(`/api/projects/${fromId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_name: newGroup }),
      }).catch(() => {})
    }
  }

  useEffect(() => {
    if (!draggedId) return

    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-project-id]')
      const id = el?.dataset.projectId ?? null
      if (id !== dragOverIdRef.current) {
        dragOverIdRef.current = id
        setDragOverId(id)
      }
    }
    const onMouseUp = () => {
      const from = draggedIdRef.current
      const to = dragOverIdRef.current
      if (from && to) handleDrop(from, to)
      draggedIdRef.current = null
      dragOverIdRef.current = null
      setDraggedId(null)
      setDragOverId(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedId])

  const startDrag = (id: string) => {
    draggedIdRef.current = id
    setDraggedId(id)
  }

  const updateProject = (id: string, patch: Partial<Project>) => {
    setOrder((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  const renderGrid = (items: Project[]) => (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
      {items.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          domains={domains.filter((d) => d.project_id === p.id)}
          onOpenDetail={() => setSelectedId(p.id)}
          onGripMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag(p.id) }}
          onUpdate={(patch) => updateProject(p.id, patch)}
          isDragOver={dragOverId === p.id && draggedId !== p.id}
          isDragging={draggedId === p.id}
        />
      ))}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">{activeTab === 'deployed' ? '배포중' : '미배포'}</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>GitHub → 미니PC → Docker → DNS</p>
      </div>

      <div
        className="flex gap-1 mb-5 rounded-xl p-1 w-fit"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        <button
          onClick={() => setActiveTab('deployed')}
          className="tab-btn text-sm font-medium px-4 py-1.5 rounded-lg"
          style={{ background: activeTab === 'deployed' ? 'var(--accent)' : 'transparent', color: activeTab === 'deployed' ? '#fff' : 'var(--muted)' }}
        >
          배포중 ({deployed.length})
        </button>
        <button
          onClick={() => setActiveTab('undeployed')}
          className="tab-btn text-sm font-medium px-4 py-1.5 rounded-lg"
          style={{ background: activeTab === 'undeployed' ? 'var(--accent)' : 'transparent', color: activeTab === 'undeployed' ? '#fff' : 'var(--muted)' }}
        >
          미배포 ({undeployed.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--muted)' }}>해당 상태의 프로젝트가 없습니다.</p>
      ) : hasGrouping ? (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.key ?? '__ungrouped__'}>
              <h2 className="text-sm font-semibold mb-2.5" style={{ color: 'var(--muted)' }}>
                {g.key ?? '미분류'} <span style={{ opacity: 0.7 }}>({g.items.length})</span>
              </h2>
              {renderGrid(g.items)}
            </div>
          ))}
        </div>
      ) : (
        renderGrid(visible)
      )}

      {selected && (
        <ProjectDetailModal
          project={selected}
          domains={domains.filter((d) => d.project_id === selected.id)}
          existingGroups={existingGroups}
          onClose={() => setSelectedId(null)}
          onUpdate={(patch) => updateProject(selected.id, patch)}
        />
      )}
    </div>
  )
}
