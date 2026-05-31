import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

type Project = { path: string; git_repo: string; git_branch: string }
type Setting = { key: string; value: string }

function git(cwd: string, args: string): string {
  try {
    return execSync(`git -C ${JSON.stringify(cwd)} ${args}`, { encoding: 'utf8', timeout: 8000 }).trim()
  } catch {
    return ''
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = db.prepare('SELECT path, git_repo, git_branch FROM projects WHERE id = ?').get(projectId) as Project | undefined
  if (!project) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // 로컬 git 상태
  const localCommit = git(project.path, 'log --oneline -1')
  const branch = git(project.path, 'rev-parse --abbrev-ref HEAD')
  // 미추적 파일(??) 제외, 실제 수정/삭제/추가된 파일만 체크
  const dirty = git(project.path, 'status --short --untracked-files=no') !== ''
  const commitHash = localCommit.split(' ')[0] ?? ''

  // GitHub API (git_repo 설정된 경우)
  let remote: { commit: string; message: string; date: string } | null = null
  if (project.git_repo) {
    const tokenRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('github_token') as Setting | undefined
    const token = tokenRow?.value
    const branch = project.git_branch ?? 'main'
    try {
      const res = await fetch(`https://api.github.com/repos/${project.git_repo}/commits/${branch}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const data = await res.json()
        remote = {
          commit: data.sha?.slice(0, 7) ?? '',
          message: data.commit?.message?.split('\n')[0] ?? '',
          date: data.commit?.author?.date ?? '',
        }
      }
    } catch { /* GitHub 연결 실패 */ }
  }

  return NextResponse.json({
    local: { branch, commit: commitHash, message: localCommit.slice(8), dirty },
    remote,
  })
}
