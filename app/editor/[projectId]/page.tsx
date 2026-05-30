import VisualEditor from '@/components/VisualEditor'
import db from '@/lib/db'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Project = { id: string; name: string; path: string }
type Domain = { id: string; label: string; url: string; is_external: number }

export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project | undefined
  if (!project) notFound()

  const domains = db
    .prepare('SELECT * FROM domains WHERE project_id = ? AND is_external = 0')
    .all(projectId) as Domain[]

  if (domains.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-20 text-center" style={{ color: 'var(--muted)' }}>
        <p className="text-lg">이 프로젝트에 등록된 내부 도메인이 없습니다.</p>
        <p className="text-sm mt-2">설정 페이지에서 도메인을 추가하세요.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">시각적 편집기</h1>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>— {project.name}</span>
      </div>
      <VisualEditor
        projectId={projectId}
        projectPath={project.path}
        domains={domains}
      />
    </div>
  )
}
