import { getContainerStats } from '@/lib/docker'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const stats = await getContainerStats()
    return NextResponse.json(stats)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
