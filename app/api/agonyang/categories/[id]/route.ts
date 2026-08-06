import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as Record<string, string | number>
  const allowed = ['name', 'cols']
  const fields = Object.keys(body).filter((k) => allowed.includes(k))
  if (fields.length === 0) return NextResponse.json({ error: 'no valid fields' }, { status: 400 })

  const set = fields.map((f) => `${f} = ?`).join(', ')
  const values = fields.map((f) => body[f])
  db.prepare(`UPDATE agonyang_categories SET ${set} WHERE id = ?`).run(...values, id)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const tx = db.transaction((categoryId: string) => {
    db.prepare('DELETE FROM agonyang_banners WHERE category_id = ?').run(categoryId)
    db.prepare('DELETE FROM agonyang_categories WHERE id = ?').run(categoryId)
  })
  tx(id)
  return NextResponse.json({ ok: true })
}
