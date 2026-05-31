import db from '@/lib/db'
import { NextResponse } from 'next/server'

type Setting = { value: string }

async function cfFetch(path: string, token: string, options?: RequestInit) {
  return fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  })
}

function getSetting(key: string): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as Setting | undefined
  return row?.value ?? ''
}

export async function GET() {
  const token = getSetting('cloudflare_api_token')
  const zoneId = getSetting('cloudflare_zone_id')

  if (!token || !zoneId) {
    return NextResponse.json({ error: '설정에서 Cloudflare API Token과 Zone ID를 먼저 입력하세요.' }, { status: 400 })
  }

  const res = await cfFetch(`/zones/${zoneId}/dns_records?per_page=100`, token)
  if (!res.ok) {
    const err = await res.json()
    return NextResponse.json({ error: err }, { status: res.status })
  }

  const data = await res.json()
  const records = (data.result ?? []).map((r: Record<string, unknown>) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    content: r.content,
    proxied: r.proxied,
    ttl: r.ttl,
    modified_on: r.modified_on,
  }))

  return NextResponse.json({ records })
}
