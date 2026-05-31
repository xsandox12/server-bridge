import db from '@/lib/db'
import { NextRequest } from 'next/server'
import { spawn } from 'child_process'

type Project = { path: string; git_branch: string }

export async function POST(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = db.prepare('SELECT path, git_branch FROM projects WHERE id = ?').get(projectId) as Project | undefined
  if (!project) return new Response('not found', { status: 404 })

  const branch = project.git_branch ?? 'main'

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder()
      const send = (line: string) => controller.enqueue(enc.encode(`data: ${line}\n\n`))

      send(`[git pull] ${project.path} (${branch})`)

      const proc = spawn('git', ['-C', project.path, 'pull', 'origin', branch], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      proc.stdout.on('data', (d: Buffer) => d.toString().split('\n').filter(Boolean).forEach(send))
      proc.stderr.on('data', (d: Buffer) => d.toString().split('\n').filter(Boolean).forEach(send))

      proc.on('close', (code) => {
        send(code === 0 ? '[완료] git pull 성공' : `[오류] 종료 코드 ${code}`)
        controller.enqueue(enc.encode('data: __DONE__\n\n'))
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
