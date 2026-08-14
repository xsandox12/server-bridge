'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import SystemHistoryChart from './SystemHistoryChart'

interface SystemStats {
  cpu: { count: number; model: string; usagePercent: number }
  loadavg: [number, number, number]
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number }
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null
  diskIO: { readBytes: number; writeBytes: number } | null
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
  netRxBytes: number
  netTxBytes: number
  blkReadBytes: number
  blkWriteBytes: number
}

interface HistoryPoint {
  ts: string
  cpu_percent: number | null
  mem_percent: number | null
  load1: number | null
  disk_percent: number | null
}

interface Rate {
  netRx: number
  netTx: number
  blkRead: number
  blkWrite: number
}

function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatRate(bytesPerSec: number) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec < 0) return '-'
  return `${formatBytes(bytesPerSec)}/s`
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

function ThresholdBanner({ stats }: { stats: SystemStats }) {
  const items: { label: string; percent: number }[] = [
    { label: 'CPU', percent: stats.cpu.usagePercent },
    { label: '메모리', percent: stats.memory.usedPercent },
    ...(stats.disk ? [{ label: '디스크', percent: stats.disk.usedPercent }] : []),
  ].filter((i) => i.percent >= 60)

  if (items.length === 0) return null

  const worst = items.reduce((a, b) => (b.percent > a.percent ? b : a))
  const danger = worst.percent >= 80

  return (
    <div
      className="rounded-xl px-4 py-3 text-sm flex items-center gap-2"
      style={{
        background: danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
        border: `1px solid ${danger ? 'var(--danger)' : 'var(--warning)'}`,
        color: danger ? 'var(--danger)' : 'var(--warning)',
      }}
    >
      <span>⚠</span>
      <span>
        {items.map((i) => `${i.label} ${i.percent.toFixed(1)}%`).join(' · ')} — 사용률이 {danger ? '위험' : '높은'} 수준입니다
      </span>
    </div>
  )
}

export default function SystemMonitor() {
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [containers, setContainers] = useState<ContainerStat[]>([])
  const [rates, setRates] = useState<Map<string, Rate>>(new Map())
  const [diskIORate, setDiskIORate] = useState<{ read: number; write: number } | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [historyRange, setHistoryRange] = useState<1 | 24>(1)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)

  const prevContainersRef = useRef<Map<string, { snapshot: ContainerStat; time: number }>>(new Map())
  const prevDiskIORef = useRef<{ readBytes: number; writeBytes: number; time: number } | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const [sysRes, dockerRes] = await Promise.all([fetch('/api/system/stats'), fetch('/api/docker/stats')])
        const sysData = await sysRes.json()
        const dockerData = await dockerRes.json()

        if (sysRes.ok) {
          setStats(sysData)
          setError(null)

          const now = Date.now()
          if (sysData.diskIO && prevDiskIORef.current) {
            const elapsed = (now - prevDiskIORef.current.time) / 1000
            if (elapsed > 0) {
              setDiskIORate({
                read: Math.max(0, (sysData.diskIO.readBytes - prevDiskIORef.current.readBytes) / elapsed),
                write: Math.max(0, (sysData.diskIO.writeBytes - prevDiskIORef.current.writeBytes) / elapsed),
              })
            }
          }
          if (sysData.diskIO) prevDiskIORef.current = { ...sysData.diskIO, time: now }
        } else {
          setError(sysData.error ?? '시스템 정보를 가져오지 못했습니다')
        }

        if (dockerRes.ok) {
          setContainers(dockerData)

          const now = Date.now()
          const nextRates = new Map<string, Rate>()
          for (const c of dockerData as ContainerStat[]) {
            const prev = prevContainersRef.current.get(c.id)
            if (prev) {
              const elapsed = (now - prev.time) / 1000
              if (elapsed > 0) {
                nextRates.set(c.id, {
                  netRx: Math.max(0, (c.netRxBytes - prev.snapshot.netRxBytes) / elapsed),
                  netTx: Math.max(0, (c.netTxBytes - prev.snapshot.netTxBytes) / elapsed),
                  blkRead: Math.max(0, (c.blkReadBytes - prev.snapshot.blkReadBytes) / elapsed),
                  blkWrite: Math.max(0, (c.blkWriteBytes - prev.snapshot.blkWriteBytes) / elapsed),
                })
              }
            }
            prevContainersRef.current.set(c.id, { snapshot: c, time: now })
          }
          setRates(nextRates)
        }
      } catch {
        setError('시스템 정보를 가져오지 못했습니다')
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/system/stats/history?hours=${historyRange}`)
        const data = await res.json()
        if (!cancelled && res.ok) setHistory(data)
      } catch {
        // 히스토리 실패는 배너/메터에 영향 없음
      }
    }
    fetchHistory()
    const interval = setInterval(fetchHistory, 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [historyRange])

  const handleContainerAction = async (id: string, action: 'restart' | 'stop') => {
    setActionPending(`${id}:${action}`)
    try {
      await fetch(`/api/docker/containers/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      // 다음 3초 폴링 주기에 자동 반영됨
    } finally {
      setActionPending(null)
    }
  }

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

      <ThresholdBanner stats={stats} />

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

      <SystemHistoryChart points={history} range={historyRange} onRangeChange={setHistoryRange} />

      <div className="grid grid-cols-2 gap-4">
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

        <div className="rounded-xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>디스크 I/O</span>
          {stats.diskIO && diskIORate ? (
            <div className="flex gap-6 mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold">{formatRate(diskIORate.read)}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>읽기</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-semibold">{formatRate(diskIORate.write)}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>쓰기</span>
              </div>
            </div>
          ) : (
            <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>측정 중...</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--muted)' }}>실행 중인 컨테이너</h2>
        {containers.length === 0 ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>실행 중인 컨테이너가 없습니다</div>
        ) : (
          <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--card-border)' }}>
            <table className="w-full text-sm" style={{ minWidth: 720 }}>
              <thead>
                <tr style={{ background: 'var(--card)' }}>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>컨테이너</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>CPU</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>메모리</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>네트워크 (↓/↑)</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>디스크 (읽기/쓰기)</th>
                  <th className="text-right px-4 py-2 font-medium" style={{ color: 'var(--muted)' }}>작업</th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => {
                  const rate = rates.get(c.id)
                  const pending = actionPending?.startsWith(`${c.id}:`)
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                      <td className="px-4 py-2">{c.name}</td>
                      <td className="px-4 py-2 text-right tabular-nums" style={{ color: severityColor(c.cpuPercent) }}>
                        {c.cpuPercent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums" style={{ color: severityColor(c.memPercent) }}>
                        {formatBytes(c.memUsageBytes)} ({c.memPercent.toFixed(1)}%)
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs" style={{ color: 'var(--muted)' }}>
                        {rate ? `${formatRate(rate.netRx)} / ${formatRate(rate.netTx)}` : '측정 중...'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs" style={{ color: 'var(--muted)' }}>
                        {rate ? `${formatRate(rate.blkRead)} / ${formatRate(rate.blkWrite)}` : '측정 중...'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/logs/${c.id}`}
                            className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80"
                            style={{ background: '#0f172a', color: 'var(--accent)' }}
                          >
                            로그
                          </Link>
                          <button
                            disabled={!!pending}
                            onClick={() => handleContainerAction(c.id, 'restart')}
                            className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                            style={{ background: '#1d4ed8', color: '#fff' }}
                          >
                            재시작
                          </button>
                          <button
                            disabled={!!pending}
                            onClick={() => handleContainerAction(c.id, 'stop')}
                            className="text-xs px-2.5 py-1 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                            style={{ background: '#7f1d1d', color: '#fca5a5' }}
                          >
                            중지
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
