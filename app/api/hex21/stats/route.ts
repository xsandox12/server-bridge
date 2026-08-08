import { execInContainer } from '@/lib/docker'
import { NextResponse } from 'next/server'

const ADV_VISITS_SCRIPT = `
const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:/data/db.sqlite' });
db.execute({
  sql: "SELECT substr(pv.viewed_at,1,10) AS day, COUNT(*) AS n FROM page_views pv JOIN sites s ON s.id = pv.site_id WHERE s.slug = ? AND pv.viewed_at >= datetime('now','-7 days') GROUP BY day ORDER BY day",
  args: ['hex21'],
}).then((r) => { console.log(JSON.stringify(r.rows)); }).catch((e) => { console.log(JSON.stringify({ error: String(e) })); });
`

export async function GET() {
  const [hex21Result, advResult] = await Promise.allSettled([
    execInContainer('hex21', ['node', 'scripts/admin-stats.mjs']),
    execInContainer('adv-admin', ['node', '-e', ADV_VISITS_SCRIPT]),
  ])

  if (hex21Result.status === 'rejected' || !hex21Result.value.stdout.trim()) {
    const reason = hex21Result.status === 'rejected' ? String(hex21Result.reason) : hex21Result.value.stderr
    return NextResponse.json({ error: reason || 'no output' }, { status: 500 })
  }

  const base = JSON.parse(hex21Result.value.stdout.trim())
  let dailyVisits: { day: string; n: number }[] = []
  if (advResult.status === 'fulfilled' && advResult.value.stdout.trim()) {
    try {
      dailyVisits = JSON.parse(advResult.value.stdout.trim())
    } catch {
      // adv-admin 미연동/일시 오류 시 방문자 추이 없이 나머지 통계만 표시
    }
  }

  return NextResponse.json({ ...base, dailyVisits })
}
