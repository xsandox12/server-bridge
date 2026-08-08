import { execInContainer } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, amount } = await req.json()
  if (!userId || !Number.isFinite(Number(amount))) {
    return NextResponse.json({ error: 'userId/amount가 필요합니다.' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer('hex21', ['node', 'scripts/admin-add-points.mjs'], [
      `USER_ID=${userId}`,
      `AMOUNT=${amount}`,
    ])
    if (!stdout.trim()) {
      return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
