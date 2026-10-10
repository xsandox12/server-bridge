import { gameFactoryAdmin } from '@/lib/gameFactory'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || ''
  const limit = req.nextUrl.searchParams.get('limit') || '300'
  return gameFactoryAdmin(`/admin/api/feedback?slug=${encodeURIComponent(slug)}&limit=${encodeURIComponent(limit)}`)
}
