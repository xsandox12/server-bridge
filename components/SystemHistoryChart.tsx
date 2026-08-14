'use client'

import { useRef, useState } from 'react'

interface HistoryPoint {
  ts: string
  cpu_percent: number | null
  mem_percent: number | null
  load1: number | null
  disk_percent: number | null
}

const W = 640
const H = 200
const PAD_X = 8
const PAD_Y = 16

const CPU_COLOR = 'var(--accent)'
const MEM_COLOR = '#a78bfa'

function formatTime(ts: string) {
  const d = new Date(ts.endsWith('Z') ? ts : ts + 'Z')
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function SystemHistoryChart({
  points,
  range,
  onRangeChange,
}: {
  points: HistoryPoint[]
  range: 1 | 24
  onRangeChange: (r: 1 | 24) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const n = points.length
  const x = (i: number) => (n <= 1 ? PAD_X : PAD_X + (i / (n - 1)) * (W - 2 * PAD_X))
  const y = (v: number) => H - PAD_Y - (Math.max(0, Math.min(100, v)) / 100) * (H - 2 * PAD_Y)

  const linePath = (key: 'cpu_percent' | 'mem_percent') =>
    points
      .map((p, i) => (p[key] == null ? null : `${i === 0 || points[i - 1]?.[key] == null ? 'M' : 'L'} ${x(i)} ${y(p[key]!)}`))
      .filter(Boolean)
      .join(' ')

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (n === 0 || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const relX = ((e.clientX - rect.left) / rect.width) * W
    const ratio = n <= 1 ? 0 : (relX - PAD_X) / (W - 2 * PAD_X)
    const idx = Math.round(ratio * (n - 1))
    setHoverIndex(Math.max(0, Math.min(n - 1, idx)))
  }

  const hovered = hoverIndex != null ? points[hoverIndex] : null

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: 'var(--muted)' }}>추이</span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CPU_COLOR }} />
            <span style={{ color: 'var(--muted)' }}>CPU</span>
            <span className="inline-block w-2.5 h-2.5 rounded-full ml-2" style={{ background: MEM_COLOR }} />
            <span style={{ color: 'var(--muted)' }}>메모리</span>
          </div>
        </div>
        <div className="flex gap-1">
          {([1, 24] as const).map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
              style={{
                background: range === r ? 'var(--accent)' : '#0f172a',
                color: range === r ? '#fff' : 'var(--muted)',
              }}
            >
              {r === 1 ? '1시간' : '24시간'}
            </button>
          ))}
        </div>
      </div>

      {n === 0 ? (
        <div className="text-xs py-10 text-center" style={{ color: 'var(--muted)' }}>
          데이터 수집 중입니다 (1분마다 샘플링)
        </div>
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {[0, 50, 100].map((v) => (
              <line key={v} x1={PAD_X} x2={W - PAD_X} y1={y(v)} y2={y(v)} stroke="var(--card-border)" strokeWidth={1} />
            ))}
            <path d={linePath('cpu_percent')} fill="none" stroke={CPU_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={linePath('mem_percent')} fill="none" stroke={MEM_COLOR} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hovered && (
              <>
                <line x1={x(hoverIndex!)} x2={x(hoverIndex!)} y1={PAD_Y} y2={H - PAD_Y} stroke="var(--card-border)" strokeWidth={1} />
                {hovered.cpu_percent != null && (
                  <circle cx={x(hoverIndex!)} cy={y(hovered.cpu_percent)} r={4} fill={CPU_COLOR} stroke="var(--card)" strokeWidth={2} />
                )}
                {hovered.mem_percent != null && (
                  <circle cx={x(hoverIndex!)} cy={y(hovered.mem_percent)} r={4} fill={MEM_COLOR} stroke="var(--card)" strokeWidth={2} />
                )}
              </>
            )}
          </svg>
          {hovered && (
            <div
              className="absolute top-0 text-xs px-2 py-1.5 rounded-lg pointer-events-none"
              style={{
                background: '#0f172a',
                border: '1px solid var(--card-border)',
                left: `${Math.min(85, Math.max(0, (x(hoverIndex!) / W) * 100))}%`,
              }}
            >
              <div style={{ color: 'var(--muted)' }}>{formatTime(hovered.ts)}</div>
              {hovered.cpu_percent != null && <div style={{ color: CPU_COLOR }}>CPU {hovered.cpu_percent.toFixed(1)}%</div>}
              {hovered.mem_percent != null && <div style={{ color: MEM_COLOR }}>메모리 {hovered.mem_percent.toFixed(1)}%</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
