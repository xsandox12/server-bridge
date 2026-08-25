import { execInContainer } from '@/lib/docker'
import { NextResponse } from 'next/server'

// necrodance 는 계정이 없고 scores 테이블 하나만 쓴다. 컨테이너 안 better-sqlite3 로 직접 읽는다.
const STATS_SCRIPT = `
const D = require('better-sqlite3');
const db = new D(process.env.NECRODANCE_DB || '/data/necrodance.db', { readonly: true });
const agg = db.prepare('SELECT COUNT(*) AS total, COUNT(DISTINCT nickname) AS players, MAX(score) AS topScore, AVG(score) AS avgScore, AVG(survival_ms) AS avgSurvivalMs FROM scores').get();
const top = db.prepare('SELECT nickname, score, survival_ms, kills_normal, kills_elite, kills_boss, created_at FROM scores ORDER BY score DESC, survival_ms DESC, id ASC LIMIT 10').all();
const since = new Date(Date.now() - 30 * 86400000).toISOString();
const recent = db.prepare('SELECT created_at FROM scores WHERE created_at >= ?').all(since).map((r) => r.created_at);
console.log(JSON.stringify({ agg, top, recent }));
`

const ADV_VISITS_SCRIPT = `
const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:/data/db.sqlite' });
db.execute({
  sql: "SELECT substr(pv.viewed_at,1,10) AS day, COUNT(*) AS n FROM page_views pv JOIN sites s ON s.id = pv.site_id WHERE s.slug = ? AND pv.viewed_at >= datetime('now','-7 days') GROUP BY day ORDER BY day",
  args: ['necrodance'],
}).then((r) => { console.log(JSON.stringify(r.rows)); }).catch((e) => { console.log(JSON.stringify({ error: String(e) })); });
`

const KST_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** 오늘부터 거슬러 올라가는 days 일치 KST 날짜 키를 과거→현재 순으로 만든다. */
function recentDays(days: number): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) out.push(KST_DAY.format(new Date(Date.now() - i * 86400000)))
  return out
}

export async function GET() {
  const [statsResult, advResult] = await Promise.allSettled([
    execInContainer('necrodance', ['node', '-e', STATS_SCRIPT]),
    execInContainer('adv-admin', ['node', '-e', ADV_VISITS_SCRIPT]),
  ])

  if (statsResult.status === 'rejected' || !statsResult.value.stdout.trim()) {
    const reason = statsResult.status === 'rejected' ? String(statsResult.reason) : statsResult.value.stderr
    return NextResponse.json({ error: reason || 'no output' }, { status: 500 })
  }

  const parsed = JSON.parse(statsResult.value.stdout.trim()) as {
    agg: {
      total: number
      players: number
      topScore: number | null
      avgScore: number | null
      avgSurvivalMs: number | null
    }
    top: {
      nickname: string
      score: number
      survival_ms: number
      kills_normal: number
      kills_elite: number
      kills_boss: number
      created_at: string
    }[]
    recent: string[]
  }

  const counts = new Map<string, number>()
  for (const iso of parsed.recent) {
    const day = KST_DAY.format(new Date(iso))
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const days = recentDays(7)
  const dailyPlays = days.map((day) => ({ day, n: counts.get(day) ?? 0 }))
  const today = days[days.length - 1]

  let dailyVisits: { day: string; n: number }[] = []
  if (advResult.status === 'fulfilled' && advResult.value.stdout.trim()) {
    try {
      dailyVisits = JSON.parse(advResult.value.stdout.trim())
    } catch {
      // adv-admin 미연동/일시 오류 시 방문자 추이 없이 나머지 통계만 표시
    }
  }

  return NextResponse.json({
    runs: {
      total: parsed.agg.total,
      today: counts.get(today) ?? 0,
      last7d: dailyPlays.reduce((sum, d) => sum + d.n, 0),
      players: parsed.agg.players,
      topScore: parsed.agg.topScore ?? 0,
      avgScore: Math.round(parsed.agg.avgScore ?? 0),
      avgSurvivalMs: Math.round(parsed.agg.avgSurvivalMs ?? 0),
    },
    dailyPlays,
    dailyVisits,
    top: parsed.top,
  })
}
