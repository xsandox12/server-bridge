import PipelineCard from '@/components/PipelineCard'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Project = { id: string; name: string; path: string; deploy_cmd: string | null; git_repo: string | null; git_branch: string | null; docker_service: string | null }
type Domain = { id: string; project_id: string; label: string; url: string; env: string }

export default function ServicesPage() {
  const all = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Project[]
  const domains = db.prepare('SELECT * FROM domains').all() as Domain[]
  const projects = all.filter((p) => !domains.some((d) => d.project_id === p.id && d.env === 'production'))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">미배포</h1>
      </div>
      <div className="flex flex-col gap-4">
        {projects.map((p) => (
          <PipelineCard key={p.id} project={p} domains={domains.filter((d) => d.project_id === p.id)} />
        ))}
      </div>
    </div>
  )
}
