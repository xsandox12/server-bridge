import os from 'os'
import fs from 'fs'
import db from '@/lib/db'

export interface SystemStats {
  cpu: { count: number; model: string; usagePercent: number }
  loadavg: [number, number, number]
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number }
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null
  diskIO: { readBytes: number; writeBytes: number } | null
  uptimeSeconds: number
  hostname: string
}

export interface SystemStatsHistoryPoint {
  ts: string
  cpu_percent: number | null
  mem_percent: number | null
  load1: number | null
  disk_percent: number | null
}

function cpuTimes() {
  return os.cpus().reduce(
    (acc, c) => {
      acc.idle += c.times.idle
      acc.total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq
      return acc
    },
    { idle: 0, total: 0 }
  )
}

async function getCpuUsagePercent(sampleMs = 150): Promise<number> {
  const start = cpuTimes()
  await new Promise((r) => setTimeout(r, sampleMs))
  const end = cpuTimes()
  const idleDelta = end.idle - start.idle
  const totalDelta = end.total - start.total
  if (totalDelta <= 0) return 0
  return Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100))
}

function getDiskStats(): SystemStats['disk'] {
  const diskPath = process.env.WORKSPACE_ROOT ?? '/workspace'
  try {
    const s = fs.statfsSync(diskPath)
    const totalBytes = s.blocks * s.bsize
    const freeBytes = s.bfree * s.bsize
    const usedBytes = totalBytes - freeBytes
    return {
      path: diskPath,
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0,
    }
  } catch {
    return null
  }
}

const PHYSICAL_DISK_RE = /^(sd[a-z]+|nvme\d+n\d+|vd[a-z]+)$/

function getDiskIO(): SystemStats['diskIO'] {
  try {
    const lines = fs.readFileSync('/proc/diskstats', 'utf8').trim().split('\n')
    let readSectors = 0
    let writeSectors = 0
    for (const line of lines) {
      const fields = line.trim().split(/\s+/)
      const device = fields[2]
      if (!device || !PHYSICAL_DISK_RE.test(device)) continue
      readSectors += Number(fields[5]) || 0
      writeSectors += Number(fields[9]) || 0
    }
    return { readBytes: readSectors * 512, writeBytes: writeSectors * 512 }
  } catch {
    return null
  }
}

export async function getSystemStats(): Promise<SystemStats> {
  const cpus = os.cpus()
  const usagePercent = await getCpuUsagePercent()
  const totalBytes = os.totalmem()
  const freeBytes = os.freemem()
  const usedBytes = totalBytes - freeBytes

  return {
    cpu: { count: cpus.length, model: cpus[0]?.model ?? 'unknown', usagePercent },
    loadavg: os.loadavg() as [number, number, number],
    memory: { totalBytes, freeBytes, usedBytes, usedPercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0 },
    disk: getDiskStats(),
    diskIO: getDiskIO(),
    uptimeSeconds: os.uptime(),
    hostname: os.hostname(),
  }
}

export function getSystemStatsHistory(hours: number): SystemStatsHistoryPoint[] {
  return db
    .prepare(
      `SELECT ts, cpu_percent, mem_percent, load1, disk_percent
       FROM system_stats_history
       WHERE ts >= datetime('now', ?)
       ORDER BY ts`
    )
    .all(`-${hours} hours`) as SystemStatsHistoryPoint[]
}
