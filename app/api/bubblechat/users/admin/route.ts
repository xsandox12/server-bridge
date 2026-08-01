import { execInContainer } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, isAdmin } = await req.json()
  if (!userId) {
    return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer('bubblechat', ['node', 'scripts/admin-set-admin.mjs'], [
      `USER_ID=${userId}`,
      `IS_ADMIN=${isAdmin ? '1' : '0'}`,
    ])
    if (!stdout.trim()) {
      return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
