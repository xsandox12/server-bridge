import { gameFactoryAdmin } from '@/lib/gameFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  return gameFactoryAdmin('/admin/api/state')
}
