import { restartContainer, stopContainer, startContainer, getContainerLogs } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  const { action } = await req.json()

  try {
    if (action === 'restart') await restartContainer(id)
    else if (action === 'stop') await stopContainer(id)
    else if (action === 'start') await startContainer(id)
    else return NextResponse.json({ error: 'unknown action' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const tail = Number(new URL(req.url).searchParams.get('tail') ?? 100)
  try {
    const logs = await getContainerLogs(id, tail)
    return NextResponse.json({ logs })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
