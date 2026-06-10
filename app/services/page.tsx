import PipelineCard from '@/components/PipelineCard'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

const SERVICE_IDS = ['adv', 'drawingtool', 'coldstorage']

type Project = { id: string; name: string; path: string; deploy_cmd: string | null; git_repo: string | null; git_branch: string | null; docker_service: string | null }
type Domain = { id: string; project_id: string; label: string; url: string; env: string }

function Section({ title, badge, projects, domains }: {
  title: string
  badge: string
  projects: Project[]
  domains: Domain[]
}) {
  if (projects.length === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--muted)' }}>{badge}</span>
      </div>
      <div className="flex flex-col gap-4">
        {projects.map((p) => (
          <PipelineCard key={p.id} project={p} domains={domains.filter((d) => d.project_id === p.id)} />
        ))}
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const projects = db
    .prepare(`SELECT * FROM projects WHERE id IN (${SERVICE_IDS.map(() => '?').join(',')}) ORDER BY name`)
    .all(...SERVICE_IDS) as Project[]
  const domains = db.prepare('SELECT * FROM domains').all() as Domain[]

  const deployed = projects.filter((p) => domains.some((d) => d.project_id === p.id && d.env === 'production'))
  const undeployed = projects.filter((p) => !domains.some((d) => d.project_id === p.id && d.env === 'production'))

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">서비스</h1>
      </div>
      <Section title="배포중" badge={`${deployed.length}개`} projects={deployed} domains={domains} />
      <Section title="미배포" badge={`${undeployed.length}개`} projects={undeployed} domains={domains} />
    </div>
  )
}
