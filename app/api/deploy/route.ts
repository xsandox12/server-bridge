import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
    | { id: string; name: string; path: string; deploy_cmd: string }
    | undefined

  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })
  if (!project.deploy_cmd) return NextResponse.json({ error: 'no deploy_cmd configured' }, { status: 400 })

  const jobId = randomUUID()
  db.prepare(
    'INSERT INTO deploy_logs (id, project_id, command, status) VALUES (?, ?, ?, ?)'
  ).run(jobId, projectId, project.deploy_cmd, 'running')

  return NextResponse.json({ jobId })
}

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get('projectId')
  const rows = db
    .prepare(
      'SELECT * FROM deploy_logs WHERE project_id = ? ORDER BY started_at DESC LIMIT 20'
    )
    .all(projectId)
  return NextResponse.json(rows)
}
