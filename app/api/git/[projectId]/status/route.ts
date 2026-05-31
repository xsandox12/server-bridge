import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

type Project = { path: string; git_repo: string; git_branch: string }
type Setting = { value: string }

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

  const localCommit = git(project.path, 'log --oneline -1')
  const branch = git(project.path, 'rev-parse --abbrev-ref HEAD')
  const dirty = git(project.path, 'status --short --untracked-files=no') !== ''
  const commitHash = localCommit.split(' ')[0] ?? ''

  let remote: { commit: string; message: string; date: string } | null = null
  let ahead = 0
  let behind = 0

  if (project.git_repo && commitHash) {
    const tokenRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('github_token') as Setting | undefined
    const token = tokenRow?.value
    const remoteBranch = project.git_branch ?? 'main'
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
    if (token) headers.Authorization = `Bearer ${token}`

    try {
      // GitHub 최신 커밋 조회
      const remoteRes = await fetch(
        `https://api.github.com/repos/${project.git_repo}/commits/${remoteBranch}`,
        { headers, cache: 'no-store' }
      )
      if (remoteRes.ok) {
        const data = await remoteRes.json()
        remote = {
          commit: data.sha?.slice(0, 7) ?? '',
          message: data.commit?.message?.split('\n')[0] ?? '',
          date: data.commit?.author?.date ?? '',
        }

        // 로컬 ↔ 원격 방향 비교 (같은 커밋이면 생략)
        if (remote.commit && remote.commit !== commitHash) {
          const compareRes = await fetch(
            `https://api.github.com/repos/${project.git_repo}/compare/${remote.commit}...${commitHash}`,
            { headers, cache: 'no-store' }
          )
          if (compareRes.ok) {
            const cmp = await compareRes.json()
            // base=remote, head=local
            // ahead_by: local이 remote보다 앞선 커밋 수
            // behind_by: local이 remote보다 뒤처진 커밋 수
            ahead = cmp.ahead_by ?? 0
            behind = cmp.behind_by ?? 0
          }
        }
      }
    } catch { /* GitHub 연결 실패 */ }
  }

  return NextResponse.json({
    local: { branch, commit: commitHash, message: localCommit.slice(8), dirty },
    remote,
    ahead,   // 로컬이 GitHub보다 앞선 커밋 수 → Push 필요
    behind,  // 로컬이 GitHub보다 뒤처진 커밋 수 → Pull 필요
  })
}
