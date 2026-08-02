import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { fromProjectId, toProjectId, notes } = await req.json()

  const fromProject = db.prepare('SELECT path FROM projects WHERE id = ?').get(fromProjectId) as { path: string } | undefined
  if (!fromProject) return NextResponse.json({ error: 'fromProject not found' }, { status: 404 })

  const toProject = db.prepare('SELECT path, docker_service FROM projects WHERE id = ?').get(toProjectId) as
    | { path: string; docker_service: string | null }
    | undefined
  if (!toProject) return NextResponse.json({ error: 'toProject not found' }, { status: 404 })
  if (!toProject.docker_service) return NextResponse.json({ error: 'toProject has no docker_service' }, { status: 400 })

  let hash: string
  try {
    hash = execSync(`git -C ${JSON.stringify(fromProject.path)} rev-parse --short HEAD`, { encoding: 'utf8', timeout: 5000 }).trim()
  } catch {
    return NextResponse.json({ error: 'fromProject 커밋을 확인할 수 없습니다' }, { status: 500 })
  }

  const svc = toProject.docker_service
  const command = `git fetch origin && git reset --hard ${hash} && docker compose build ${svc} && docker compose up -d ${svc}`

  const jobId = randomUUID()
  db.prepare(
    'INSERT INTO deploy_logs (id, project_id, command, status, notes, git_commit) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(jobId, toProjectId, command, 'running', notes ?? null, hash)

  return NextResponse.json({ jobId })
}
