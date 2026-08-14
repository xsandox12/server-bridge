export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const g = globalThis as unknown as { __systemStatsCollectorStarted?: boolean }
  if (g.__systemStatsCollectorStarted) return
  g.__systemStatsCollectorStarted = true

  const { getSystemStats } = await import('@/lib/system')
  const { default: db } = await import('@/lib/db')

  const sample = async () => {
    try {
      const stats = await getSystemStats()
      db.prepare(
        `INSERT INTO system_stats_history (cpu_percent, mem_percent, load1, disk_percent) VALUES (?, ?, ?, ?)`
      ).run(stats.cpu.usagePercent, stats.memory.usedPercent, stats.loadavg[0], stats.disk?.usedPercent ?? null)
      db.prepare(`DELETE FROM system_stats_history WHERE ts < datetime('now', '-1 day')`).run()
    } catch {
      // 샘플링 실패는 다음 주기에 재시도
    }
  }

  setInterval(sample, 60_000)
  sample()
}
