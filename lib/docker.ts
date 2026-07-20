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
