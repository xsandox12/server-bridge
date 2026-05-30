import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? '/workspace'

function safePath(p: string): string {
  const resolved = path.resolve(p)
  if (!resolved.startsWith(WORKSPACE)) throw new Error('path outside workspace')
  return resolved
}

export async function GET(req: NextRequest) {
  const filePath = new URL(req.url).searchParams.get('path') ?? WORKSPACE
  try {
    const safe = safePath(filePath)
    const stat = fs.statSync(safe)

    if (stat.isDirectory()) {
      const entries = fs.readdirSync(safe, { withFileTypes: true }).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
        size: e.isFile() ? fs.statSync(path.join(safe, e.name)).size : 0,
      }))
      return NextResponse.json(entries)
    }

    return NextResponse.json({ content: fs.readFileSync(safe, 'utf8') })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}

export async function PUT(req: NextRequest) {
  const { path: filePath, content } = await req.json()
  try {
    const safe = safePath(filePath)
    fs.writeFileSync(safe, content, 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
