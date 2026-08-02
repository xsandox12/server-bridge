import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

type DeployLog = { id: string; git_commit: string | null; notes: string | null; status: string; started_at: string; finished_at: string | null }

export async function GET(req: NextRequest) {
  const projectId = new URL(req.url).searchParams.get('projectId')
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 })

  const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  let hash: string | null = null
  let message = ''
  let date = ''
  try {
    const out = execSync(
      `git -C ${JSON.stringify(project.path)} log -1 --pretty=format:"%h|%s|%ci"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim()
    ;[hash, message, date] = out.split('|')
  } catch {
    // git repo가 아니거나 커밋 없음
  }

  const history = db
    .prepare('SELECT id, git_commit, notes, status, started_at, finished_at FROM deploy_logs WHERE project_id = ? ORDER BY started_at DESC LIMIT 10')
    .all(projectId) as DeployLog[]

  const matched = history.find((h) => h.git_commit === hash && h.status === 'success')

  return NextResponse.json({
    current: hash ? { hash, message, date, notes: matched?.notes ?? null } : null,
    history,
  })
}
