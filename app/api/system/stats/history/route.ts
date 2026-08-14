import { getSystemStatsHistory } from '@/lib/system'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const hoursParam = Number(new URL(req.url).searchParams.get('hours') ?? 1)
  const hours = [1, 24].includes(hoursParam) ? hoursParam : 1

  try {
    const history = getSystemStatsHistory(hours)
    return NextResponse.json(history)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
