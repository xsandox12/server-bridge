import ProjectGrid from '@/components/ProjectGrid'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Project = { id: string; name: string; path: string; deploy_cmd: string | null; git_repo: string | null; git_branch: string | null; docker_service: string | null; description: string | null; group_name: string | null }
type Domain = { id: string; project_id: string; label: string; url: string; env: string }

export default function ServicesPage() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY (sort_order IS NULL), sort_order, created_at').all() as Project[]
  const domains = db.prepare('SELECT * FROM domains').all() as Domain[]

  return <ProjectGrid projects={projects} domains={domains} initialTab="undeployed" />
}
