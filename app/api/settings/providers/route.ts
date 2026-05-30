import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { name, api_key, model, base_url } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const existing = db.prepare('SELECT id FROM ai_providers WHERE name = ?').get(name) as { id: string } | undefined

  if (existing) {
    db.prepare('UPDATE ai_providers SET api_key = ?, model = ?, base_url = ? WHERE id = ?')
      .run(api_key || null, model || null, base_url || null, existing.id)
  } else {
    db.prepare('INSERT INTO ai_providers (id, name, api_key, model, base_url) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), name, api_key || null, model || null, base_url || null)
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const providers = db.prepare('SELECT id, name, model, base_url, is_default FROM ai_providers').all()
  return NextResponse.json(providers)
}
