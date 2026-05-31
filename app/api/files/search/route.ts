import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import path from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? '/workspace'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const searchPath = url.searchParams.get('path') ?? WORKSPACE
  const text = url.searchParams.get('text') ?? ''

  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const safe = path.resolve(/* turbopackIgnore: true */ searchPath)
  if (!safe.startsWith(WORKSPACE)) {
    return NextResponse.json({ error: 'path outside workspace' }, { status: 400 })
  }

  try {
    // -F: 정규식 없이 고정 문자열 검색 (한국어/특수문자 안전)
    const result = execSync(
      `grep -rlF ${JSON.stringify(text)} ${JSON.stringify(safe)} --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" --include="*.html" --include="*.css" --include="*.vue" --include="*.json" 2>/dev/null | head -10`,
      { encoding: 'utf8', timeout: 5000 }
    )
    const files = result.trim().split('\n').filter(Boolean)
    return NextResponse.json({ files })
  } catch {
    return NextResponse.json({ files: [] })
  }
}
