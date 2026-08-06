import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const BOOLEAN_FIELDS = new Set(['is_live', 'open_in_new_tab', 'is_active'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const allowed = ['title', 'description', 'image_url', 'link_url', 'icon', 'accent_color', 'meta', 'is_live', 'open_in_new_tab', 'is_active']
  const fields = Object.keys(body).filter((k) => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })

  const set = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => (BOOLEAN_FIELDS.has(f) ? (body[f] ? 1 : 0) : body[f]))
  db.prepare(`UPDATE agonyang_banners SET ${set} WHERE id = ?`).run(...values, id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  db.prepare('DELETE FROM agonyang_banners WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}
