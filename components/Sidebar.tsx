'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: '대시보드', icon: '⬡' },
  { href: '/projects', label: '프로젝트', icon: '📁' },
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="w-52 flex-shrink-0 flex flex-col gap-1 p-4 border-r"
      style={{ background: '#0d1629', borderColor: 'var(--card-border)' }}
    >
      <div className="mb-6 px-2">
        <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
          ServerBridge
        </span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          미니PC 관리
        </p>
      </div>

      {nav.map(({ href, label, icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: active ? 'var(--accent)' : 'transparent',
              color: active ? '#fff' : 'var(--foreground)',
              opacity: active ? 1 : 0.75,
            }}
          >
            <span>{icon}</span>
            {label}
          </Link>
        )
      })}
    </aside>
  )
}
