import { NextRequest, NextResponse } from 'next/server'

// Cubrawl 운영 프록시: 브라우저 → server-bridge → cubrawl-stats /admin/*.
// 관리 토큰은 서버 쪽 환경 변수에만 있고 브라우저로 나가지 않는다 (settings 표는 /api/settings 로 그대로 읽히므로 쓰지 않는다).
// CUBRAWL_STATS_URL: 같은 main_default 네트워크의 컨테이너 주소 (로컬 시험은 http://localhost:8080).
const BASE = process.env.CUBRAWL_STATS_URL || 'http://cubrawl-stats:8080'
const TOKEN = process.env.CUBRAWL_ADMIN_TOKEN || ''
const SEGMENT = /^[A-Za-z0-9_.:-]{1,80}$/

type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: NextRequest, { params }: Ctx) {
  if (!TOKEN) return NextResponse.json({ error: 'CUBRAWL_ADMIN_TOKEN 이 설정되지 않았어요 (server-bridge 환경 변수)' }, { status: 503 })
  const { path } = await params
  if (!path.every((p) => SEGMENT.test(p))) return NextResponse.json({ error: 'bad path' }, { status: 400 })
  const url = `${BASE}/admin/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`
  const init: RequestInit = { method: req.method, headers: { 'x-admin-token': TOKEN }, cache: 'no-store' }
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const body = await req.text()
    if (body) {
      init.body = body
      init.headers = { ...init.headers, 'content-type': 'application/json' }
    }
  }
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
    const text = await res.text()
    return new NextResponse(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'application/json' } })
  } catch (e) {
    return NextResponse.json({ error: `cubrawl-stats 에 연결하지 못했어요: ${(e as Error).message}` }, { status: 502 })
  }
}

export const GET = forward
export const POST = forward
export const PUT = forward
export const DELETE = forward
