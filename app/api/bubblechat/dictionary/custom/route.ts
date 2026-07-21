import { execInContainer } from '@/lib/docker'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { stdout, stderr } = await execInContainer('bubblechat', [
      'cat',
      'logs/custom-words.json',
    ])

    if (!stdout.trim()) {
      if (stderr && !/no such file/i.test(stderr)) {
        return NextResponse.json({ error: stderr }, { status: 500 })
      }
      return NextResponse.json({ words: [] })
    }

    const words = JSON.parse(stdout.trim()) as string[]
    return NextResponse.json({ words })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
