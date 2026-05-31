import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? '/workspace'

const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.data'])
const TEXT_EXTS = new Set(['.html', '.js', '.ts', '.tsx', '.jsx', '.css', '.vue', '.json', '.md', '.txt', '.yaml', '.yml', '.env'])

function safePath(p: string): string {
  const resolved = path.resolve(p)
  if (!resolved.startsWith(WORKSPACE)) throw new Error('path outside workspace')
  return resolved
}

function getAllFiles(dir: string, result: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) getAllFiles(full, result)
    else if (TEXT_EXTS.has(path.extname(entry.name))) result.push(full)
  }
  return result
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const filePath = url.searchParams.get('path') ?? WORKSPACE
  const recursive = url.searchParams.get('recursive') === 'true'
  try {
    const safe = safePath(filePath)
    const stat = fs.statSync(safe)

    if (stat.isDirectory()) {
      if (recursive) {
        const files = getAllFiles(safe)
        return NextResponse.json({ files })
      }
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
