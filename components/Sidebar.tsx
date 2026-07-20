'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: '배포중', icon: '🚀' },
  { href: '/services', label: '미배포', icon: '📦' },
  { href: '/history', label: '배포 이력', icon: '🕐' },
  { href: '/dns', label: 'DNS', icon: '🌐' },
]

const secondary = [
  { href: '/projects', label: '프로젝트', icon: '📁' },
  { href: '/planning', label: '기획서', icon: '📝' },
  { href: '/bubblechat', label: 'bubbleChat', icon: '💬' },
  { href: '/settings', label: '설정', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const NavItem = ({ href, label, icon }: { href: string; label: string; icon: string }) => {
    const active = pathname === href
    return (
      <Link
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
  }

  return (
    <aside
      className="w-52 flex-shrink-0 flex flex-col gap-1 p-4 border-r"
      style={{ background: '#0d1629', borderColor: 'var(--card-border)' }}
    >
      <div className="mb-6 px-2">
        <span className="text-lg font-bold" style={{ color: 'var(--accent)' }}>ServerBridge</span>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>배포 관리</p>
      </div>

      {nav.map((item) => <NavItem key={item.href} {...item} />)}

      <div className="my-2 mx-3 border-t" style={{ borderColor: 'var(--card-border)' }} />

      {secondary.map((item) => <NavItem key={item.href} {...item} />)}
    </aside>
  )
}
