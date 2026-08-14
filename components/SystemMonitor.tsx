'use client'

import { useEffect, useState } from 'react'

interface SystemStats {
  cpu: { count: number; model: string; usagePercent: number }
  loadavg: [number, number, number]
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number }
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null
  uptimeSeconds: number
  hostname: string
}

interface ContainerStat {
  id: string
  name: string
  cpuPercent: number
  memUsageBytes: number
  memLimitBytes: number
  memPercent: number
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}일 ${h}시간`
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

function severityColor(percent: number) {
  if (percent >= 80) return 'var(--danger)'
  if (percent >= 60) return 'var(--warning)'
  return 'var(--accent)'
}

function Meter({ label, value, sub, percent }: { label: string; value: string; sub?: string; percent: number }) {
  const color = severityColor(percent)
  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="text-xs font-medium" style={{ color }}>{percent.toFixed(1)}%</span>
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(59, 130, 246, 0.12)' }}>
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }}
        />
      </div>
      {sub && <span className="text-xs" style={{ color: 'var(--muted)' }}>{sub}</span>}
    </div>
  )
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [containers, setContainers] = useState<ContainerStat[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const [sysRes, dockerRes] = await Promise.all([fetch('/api/system/stats'), fetch('/api/docker/stats')])
        const sysData = await sysRes.json()
        const dockerData = await dockerRes.json()
        if (cancelled) return
        if (sysRes.ok) {
          setStats(sysData)
          setError(null)
        } else {
          setError(sysData.error ?? '시스템 정보를 가져오지 못했습니다')
        }
        if (dockerRes.ok) setContainers(dockerData)
      } catch {
        if (!cancelled) setError('시스템 정보를 가져오지 못했습니다')
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  if (error && !stats) {
    return <div className="text-sm" style={{ color: 'var(--danger)' }}>{error}</div>
  }

  if (!stats) {
    return <div className="text-sm" style={{ color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">모니터링</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          {stats.hostname} · 코어 {stats.cpu.count}개 · 업타임 {formatUptime(stats.uptimeSeconds)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Meter label="CPU" value={`${stats.cpu.usagePercent.toFixed(1)}%`} sub={stats.cpu.model} percent={stats.cpu.usagePercent} />
        <Meter
          label="메모리"
          value={formatBytes(stats.memory.usedBytes)}
          sub={`/ ${formatBytes(stats.memory.totalBytes)}`}
          percent={stats.memory.usedPercent}
        />
        {stats.disk ? (
          <Meter
            label="디스크"
            value={formatBytes(stats.disk.usedBytes)}
            sub={`/ ${formatBytes(stats.disk.totalBytes)} (${stats.disk.path})`}
            percent={stats.disk.usedPercent}
          />
        ) : (
          <div className="rounded-xl p-4 flex flex-col gap-2 justify-center" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
            <span className="text-sm" style={{ color: 'var(--muted)' }}>디스크</span>
            <span className="text-xs" style={{ color: 'var(--muted)' }}>디스크 정보를 사용할 수 없습니다</span>
          </div>
        )}
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <span className="text-sm" style={{ color: 'var(--muted)' }}>Load Average</span>
        <div className="flex gap-6 mt-2">
          {(['1분', '5분', '15분'] as const).map((label, i) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold">{stats.loadavg[i].toFixed(2)}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>실행 중인 컨테이너</h2>
        {containers.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>실행 중인 컨테이너가 없습니다</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--card)' }}>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>컨테이너</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>CPU</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>메모리</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                    <td className="px-4 py-2">{c.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: severityColor(c.cpuPercent) }}>
                      {c.cpuPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums" style={{ color: severityColor(c.memPercent) }}>
                      {formatBytes(c.memUsageBytes)} ({c.memPercent.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
