import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { nanoid } from 'nanoid'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data')
const UPLOADS_DIR = path.join(DATA_DIR, 'agonyang-uploads')

const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const MAX_SIZE = 2 * 1024 * 1024

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'file too large (max 2MB)' }, { status: 413 })
  }

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

  const filename = `${nanoid()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer)

  return NextResponse.json({ url: `/api/agonyang/uploads/${filename}` })
}
