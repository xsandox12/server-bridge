import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as Record<string, string>
  const allowed = ['name', 'git_repo', 'git_branch', 'deploy_cmd', 'compose_file']
  const fields = Object.keys(body).filter((k) => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })

  const set = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => body[f])
  db.prepare(`UPDATE projects SET ${set} WHERE id = ?`).run(...values, id)
  return NextResponse.json({ ok: true })
}
