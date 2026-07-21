import { execInContainer } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

type Entry = { word: string; count: number; lastAt: string }

export async function GET() {
  try {
    const { stdout, stderr } = await execInContainer('bubblechat', [
      'cat',
      '/app/server/logs/unknown-words.jsonl',
    ])

    if (!stdout.trim()) {
      if (stderr && !/no such file/i.test(stderr)) {
        return NextResponse.json({ error: stderr }, { status: 500 })
      }
      return NextResponse.json({ words: [] })
    }

    const byWord = new Map<string, Entry>()
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const { word, at } = JSON.parse(line) as { word: string; at: string }
      const existing = byWord.get(word)
      if (existing) {
        existing.count += 1
        if (at > existing.lastAt) existing.lastAt = at
      } else {
        byWord.set(word, { word, count: 1, lastAt: at })
      }
    }

    const words = [...byWord.values()].sort(
      (a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)
    )
    return NextResponse.json({ words })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { word } = await req.json()
  if (!word?.trim()) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer(
      'bubblechat',
      ['node', 'scripts/resolve-unknown-word.mjs'],
      [`WORD=${word.trim()}`]
    )
    if (!stdout.trim()) {
      return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
    }
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
