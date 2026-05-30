import db from '@/lib/db'
import { NextRequest } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

type Params = { params: Promise<{ jobId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { jobId } = await params

  const job = db.prepare('SELECT * FROM deploy_logs WHERE id = ?').get(jobId) as
    | { id: string; project_id: string; command: string; status: string }
    | undefined

  if (!job) return new Response('job not found', { status: 404 })

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(job.project_id) as
    | { path: string }
    | undefined

  const workdir = project?.path ?? (process.env.WORKSPACE_ROOT ?? '/workspace')

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      const [cmd, ...args] = job.command.split(' ')
      const proc = spawn(cmd, args, { cwd: workdir, shell: true })

      proc.stdout.on('data', (chunk) => {
        const line = chunk.toString()
        db.prepare('UPDATE deploy_logs SET output = output || ? WHERE id = ?').run(line, jobId)
        send({ type: 'log', line })
      })

      proc.stderr.on('data', (chunk) => {
        const line = chunk.toString()
        db.prepare('UPDATE deploy_logs SET output = output || ? WHERE id = ?').run(line, jobId)
        send({ type: 'log', line })
      })

      proc.on('close', (code) => {
        const status = code === 0 ? 'success' : 'failed'
        db.prepare("UPDATE deploy_logs SET status = ?, finished_at = datetime('now') WHERE id = ?").run(status, jobId)
        send({ type: 'done', status })
        controller.close()
      })

      proc.on('error', (err) => {
        send({ type: 'error', message: err.message })
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
