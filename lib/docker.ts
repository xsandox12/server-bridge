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

export { docker }
