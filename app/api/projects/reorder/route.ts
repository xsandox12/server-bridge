import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { order } = await req.json() as { order: string[] }
  if (!Array.isArray(order) || order.length === 0) {
    return NextResponse.json({ error: 'order must be a non-empty array' }, { status: 400 })
  }

  const update = db.prepare('UPDATE projects SET sort_order = ? WHERE id = ?')
  const tx = db.transaction((ids: string[]) => {
    ids.forEach((id, index) => update.run(index, id))
  })
  tx(order)

  return NextResponse.json({ ok: true })
}
