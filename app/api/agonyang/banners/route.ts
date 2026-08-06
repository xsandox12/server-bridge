import db from '@/lib/db'
import { nanoid } from 'nanoid'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { category_id, title, link_url } = body
  if (!category_id || !title?.trim() || !link_url?.trim()) {
    return NextResponse.json({ error: 'category_id, title, link_url are required' }, { status: 400 })
  }

  const id = nanoid()
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM agonyang_banners WHERE category_id = ?').get(category_id) as { m: number | null }

  db.prepare(`INSERT INTO agonyang_banners
    (id, category_id, title, description, image_url, link_url, icon, accent_color, meta, is_live, open_in_new_tab, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      id, category_id, title.trim(), body.description ?? null, body.image_url ?? null, link_url.trim(),
      body.icon ?? null, body.accent_color ?? null, body.meta ?? null,
      body.is_live ? 1 : 0, body.open_in_new_tab ? 1 : 0,
      (maxOrder.m ?? -1) + 1
    )

  return NextResponse.json({ id })
}
