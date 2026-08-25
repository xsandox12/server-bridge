import { getContainerLogs } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

// mindmaper 는 정적 nginx 라 DB 가 없고 adv-admin 방문추적도 안 붙어 있다.
// 유일한 데이터 소스가 컨테이너 access log(= docker logs) 라서 그걸 파싱한다.
// 로그는 컨테이너 재시작/로테이션 이후분만 남으므로 보존 범위(coveredFrom)를 함께 돌려준다.
const ACCESS_LINE =
  /(\d{1,3}(?:\.\d{1,3}){3}) - \S+ \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{2})(\d{2})\] "(\w+) ([^ "]+)[^"]*" (\d{3})/g

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

const KST_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `/mindmaper/index.html?x=1` 처럼 쿼리가 붙어도 문서 요청인지 판별한다. */
function isPageView(method: string, path: string): boolean {
  if (method !== 'GET' && method !== 'HEAD') return false
  const clean = path.split('?')[0]
  return clean.endsWith('/') || clean.endsWith('.html')
}

export async function GET(req: NextRequest) {
  const tail = Number(new URL(req.url).searchParams.get('tail') ?? 20000)

  let logs: string
  try {
    logs = await getContainerLogs('mindmaper', tail)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }

  const perDay = new Map<string, { views: number; requests: number; ips: Set<string> }>()
  const allIps = new Set<string>()
  let totalRequests = 0
  let totalViews = 0
  let earliest: number | null = null

  for (const m of logs.matchAll(ACCESS_LINE)) {
    const [, ip, dd, mon, yyyy, hh, mi, ss, offH, offM, method, path] = m
    const month = MONTHS[mon]
    if (!month) continue
    const at = new Date(`${yyyy}-${month}-${dd}T${hh}:${mi}:${ss}${offH}:${offM}`)
    if (Number.isNaN(at.getTime())) continue

    const time = at.getTime()
    if (earliest === null || time < earliest) earliest = time

    const day = KST_DAY.format(at)
    let bucket = perDay.get(day)
    if (!bucket) {
      bucket = { views: 0, requests: 0, ips: new Set() }
      perDay.set(day, bucket)
    }

    bucket.requests++
    bucket.ips.add(ip)
    allIps.add(ip)
    totalRequests++

    if (isPageView(method, path)) {
      bucket.views++
      totalViews++
    }
  }

  const daily = [...perDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, b]) => ({ day, views: b.views, requests: b.requests, visitors: b.ips.size }))

  const today = KST_DAY.format(new Date())

  return NextResponse.json({
    source: 'nginx access log (docker logs)',
    coveredFrom: earliest === null ? null : new Date(earliest).toISOString(),
    tail,
    totals: {
      views: totalViews,
      requests: totalRequests,
      visitors: allIps.size,
      viewsToday: perDay.get(today)?.views ?? 0,
      visitorsToday: perDay.get(today)?.ips.size ?? 0,
    },
    daily,
  })
}
