import ProjectDetail from '@/components/ProjectDetail'
import db from '@/lib/db'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Project = { id: string; name: string; path: string; deploy_cmd: string | null }

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined
  if (!project) notFound()

  return <ProjectDetail project={project} />
}
