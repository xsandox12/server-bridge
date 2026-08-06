import db from '@/lib/db'
import { nanoid } from 'nanoid'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const categories = db.prepare('SELECT * FROM agonyang_categories ORDER BY sort_order').all() as { id: string }[]
  const banners = db.prepare('SELECT * FROM agonyang_banners ORDER BY sort_order').all() as { category_id: string }[]
  const result = categories.map((cat) => ({
    ...cat,
    banners: banners.filter((b) => b.category_id === cat.id),
  }))
  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  const { name, cols } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const id = nanoid()
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM agonyang_categories').get() as { m: number | null }
  db.prepare('INSERT INTO agonyang_categories (id, name, cols, sort_order) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), cols ?? 2, (maxOrder.m ?? -1) + 1)

  return NextResponse.json({ id, name: name.trim(), cols: cols ?? 2, banners: [] })
}
