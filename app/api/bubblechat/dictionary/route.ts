import { execInContainer } from '@/lib/docker'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const word = new URL(req.url).searchParams.get('word')?.trim() ?? ''
  if (!word) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer(
      'bubblechat',
      ['node', 'scripts/check-word.mjs'],
      [`LOOKUP_WORD=${word}`]
    )
    if (!stdout.trim()) {
      return NextResponse.json({ error: stderr || 'no output' }, { status: 500 })
    }
    const result = JSON.parse(stdout.trim())
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { word } = await req.json()
  if (!word?.trim()) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer(
      'bubblechat',
      ['node', 'scripts/add-word.mjs'],
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

export async function DELETE(req: NextRequest) {
  const { word } = await req.json()
  if (!word?.trim()) {
    return NextResponse.json({ error: 'word is required' }, { status: 400 })
  }

  try {
    const { stdout, stderr } = await execInContainer(
      'bubblechat',
      ['node', 'scripts/remove-word.mjs'],
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
