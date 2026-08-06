import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data')
const UPLOADS_DIR = path.join(DATA_DIR, 'agonyang-uploads')

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params
  if (file.includes('..') || file.includes('/') || file.includes('\\')) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 })
  }

  const filepath = path.join(UPLOADS_DIR, file)
  if (!fs.existsSync(filepath)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const ext = file.split('.').pop()?.toLowerCase() ?? ''
  const buffer = fs.readFileSync(filepath)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
