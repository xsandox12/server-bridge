import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const settings: Record<string, string> = {}
  for (const r of rows) settings[r.key] = r.value
  return NextResponse.json(settings)
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, string>
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') upsert.run(key, value)
  }
  return NextResponse.json({ ok: true })
}
