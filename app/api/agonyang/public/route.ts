import db from '@/lib/db'
import { NextResponse } from 'next/server'

type Category = { id: string; name: string; cols: number; sort_order: number }
type Banner = {
  id: string
  category_id: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string
  icon: string | null
  accent_color: string | null
  meta: string | null
  is_live: number
  open_in_new_tab: number
  sort_order: number
}

export async function GET() {
  const categories = db.prepare('SELECT id, name, cols, sort_order FROM agonyang_categories ORDER BY sort_order').all() as Category[]
  const banners = db.prepare('SELECT id, category_id, title, description, image_url, link_url, icon, accent_color, meta, is_live, open_in_new_tab, sort_order FROM agonyang_banners WHERE is_active = 1 ORDER BY sort_order').all() as Banner[]

  const result = categories
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      cols: cat.cols,
      banners: banners
        .filter((b) => b.category_id === cat.id)
        .map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description,
          image_url: b.image_url,
          link_url: b.link_url,
          icon: b.icon,
          accent_color: b.accent_color,
          meta: b.meta,
          is_live: !!b.is_live,
          open_in_new_tab: !!b.open_in_new_tab,
        })),
    }))
    .filter((cat) => cat.banners.length > 0)

  return NextResponse.json({ categories: result })
}
