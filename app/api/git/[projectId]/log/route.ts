import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

type Project = { path: string }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as Project | undefined
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  try {
    const out = execSync(
      `git -C ${JSON.stringify(project.path)} log --oneline -10 --pretty=format:"%h|%s|%an|%ar"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim()

    const commits = out.split('\n').filter(Boolean).map((line) => {
      const [hash, message, author, date] = line.split('|')
      return { hash, message, author, date }
    })

    return NextResponse.json({ commits })
  } catch {
    return NextResponse.json({ commits: [] })
  }
}
