import Dockerode from 'dockerode'

const docker = new Dockerode(
  process.env.DOCKER_SOCKET
    ? { socketPath: process.env.DOCKER_SOCKET }
    : { socketPath: '/var/run/docker.sock' }
)

export interface ContainerInfo {
  id: string
  name: string
  status: string
  state: string
  ports: { host: number; container: number; protocol: string }[]
  image: string
  created: number
}

export async function listContainers(): Promise<ContainerInfo[]> {
  const containers = await docker.listContainers({ all: true })
  return containers.map((c) => ({
    id: c.Id.slice(0, 12),
    name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
    status: c.Status,
    state: c.State,
    ports: c.Ports.map((p) => ({
      host: p.PublicPort ?? 0,
      container: p.PrivatePort,
      protocol: p.Type ?? 'tcp',
    })).filter((p) => p.host > 0),
    image: c.Image,
    created: c.Created,
  }))
}

export async function restartContainer(id: string): Promise<void> {
  const container = docker.getContainer(id)
  await container.restart()
}

export async function stopContainer(id: string): Promise<void> {
  const container = docker.getContainer(id)
  await container.stop()
}

export async function startContainer(id: string): Promise<void> {
  const container = docker.getContainer(id)
  await container.start()
}

export interface ContainerStat {
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

export async function getContainerStats(): Promise<ContainerStat[]> {
  const containers = await docker.listContainers({ filters: JSON.stringify({ status: ['running'] }) })

  const results = await Promise.allSettled(
    containers.map(async (c) => {
      const stats = await docker.getContainer(c.Id).stats({ stream: false })

      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
      const onlineCpus = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1
      const cpuPercent = systemDelta > 0 && cpuDelta > 0 ? (cpuDelta / systemDelta) * onlineCpus * 100 : 0

      const memUsageBytes = stats.memory_stats.usage - (stats.memory_stats.stats?.cache ?? 0)
      const memLimitBytes = stats.memory_stats.limit
      const memPercent = memLimitBytes > 0 ? (memUsageBytes / memLimitBytes) * 100 : 0

      let netRxBytes = 0
      let netTxBytes = 0
      for (const iface of Object.values(stats.networks ?? {})) {
        netRxBytes += iface.rx_bytes ?? 0
        netTxBytes += iface.tx_bytes ?? 0
      }

      let blkReadBytes = 0
      let blkWriteBytes = 0
      for (const entry of stats.blkio_stats?.io_service_bytes_recursive ?? []) {
        const op = entry.op?.toLowerCase()
        if (op === 'read') blkReadBytes += entry.value ?? 0
        else if (op === 'write') blkWriteBytes += entry.value ?? 0
      }

      return {
        id: c.Id.slice(0, 12),
        name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
        cpuPercent: Math.max(0, cpuPercent),
        memUsageBytes: Math.max(0, memUsageBytes),
        memLimitBytes,
        memPercent: Math.max(0, memPercent),
        netRxBytes,
        netTxBytes,
        blkReadBytes,
        blkWriteBytes,
      }
    })
  )

  return results
    .filter((r): r is PromiseFulfilledResult<ContainerStat> => r.status === 'fulfilled')
    .map((r) => r.value)
    .sort((a, b) => b.cpuPercent - a.cpuPercent)
}

export async function getContainerLogs(id: string, tail = 100): Promise<string> {
  const container = docker.getContainer(id)
  const stream = await container.logs({ stdout: true, stderr: true, tail, timestamps: true })
  return stream.toString('utf8')
}

export async function execInContainer(
  id: string,
  cmd: string[],
  env: string[] = []
): Promise<{ stdout: string; stderr: string }> {
  const container = docker.getContainer(id)
  const exec = await container.exec({
    Cmd: cmd,
    Env: env,
    AttachStdout: true,
    AttachStderr: true,
  })
  const stream = await exec.start({ hijack: true, stdin: false })
  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    docker.modem.demuxStream(
      stream,
      { write: (c: Buffer) => stdoutChunks.push(c) } as any,
      { write: (c: Buffer) => stderrChunks.push(c) } as any
    )
    stream.on('end', () =>
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
      })
    )
    stream.on('error', reject)
  })
}

export { docker }
