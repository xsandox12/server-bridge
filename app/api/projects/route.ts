import db from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = db
    .prepare('SELECT id, name, path, deploy_cmd FROM projects ORDER BY created_at')
    .all()
  return NextResponse.json(rows)
}
