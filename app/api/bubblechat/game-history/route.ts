import { execInContainer } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = searchParams.get('limit') ?? '20'
  const offset = searchParams.get('offset') ?? '0'

  try {
    const { stdout, stderr } = await execInContainer('bubblechat', ['node', 'scripts/admin-game-history.mjs'], [
      `LIMIT=${limit}`,
      `OFFSET=${offset}`,
    ])
    if (!stdout.trim()) {
      return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
