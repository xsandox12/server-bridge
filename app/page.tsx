import PipelineCard from '@/components/PipelineCard'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Project = { id: string; name: string; path: string; deploy_cmd: string | null; git_repo: string | null; git_branch: string | null }
type Domain = { id: string; project_id: string; label: string; url: string }

export default function Home() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Project[]
  const domains = db.prepare('SELECT * FROM domains').all() as Domain[]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">파이프라인</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>GitHub → 미니PC → Docker → DNS</p>
      </div>
      <div className="flex flex-col gap-4">
        {projects.map((p) => (
          <PipelineCard
            key={p.id}
            project={p}
            domains={domains.filter((d) => d.project_id === p.id)}
          />
        ))}
      </div>
    </div>
  )
}
