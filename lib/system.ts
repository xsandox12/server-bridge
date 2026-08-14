import os from 'os'
import fs from 'fs'

export interface SystemStats {
  cpu: { count: number; model: string; usagePercent: number }
  loadavg: [number, number, number]
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number }
  disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number; usedPercent: number } | null
  uptimeSeconds: number
  hostname: string
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
    uptimeSeconds: os.uptime(),
    hostname: os.hostname(),
  }
}
