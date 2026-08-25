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
  let raw: string
  try {
    const { stdout, stderr } = await execInContainer('necrodance', ['node', '-e', STATS_SCRIPT])
    raw = stdout.trim()
    if (!raw) return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const parsed = JSON.parse(raw) as {
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
    top: parsed.top,
  })
}
