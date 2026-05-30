import { listContainers } from '@/lib/docker'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const containers = await listContainers()
    return NextResponse.json(containers)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
