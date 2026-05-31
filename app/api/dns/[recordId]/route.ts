import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

type Setting = { value: string }

function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Setting | undefined
  return row?.value ?? ''
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params
  const token = getSetting('cloudflare_api_token')
  const zoneId = getSetting('cloudflare_zone_id')
  if (!token || !zoneId) return NextResponse.json({ error: 'Cloudflare 설정 없음' }, { status: 400 })

  const body = await req.json()
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: res.status })
  return NextResponse.json({ ok: true, record: data.result })
}
