import db from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface Project {
  id: string
  name: string
  path: string
  compose_file: string | null
  deploy_cmd: string | null
  created_at: string
}

interface Domain {
  id: string
  label: string
  url: string
  port: number | null
  is_external: number
}

export default function ProjectsPage() {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Project[]
  const domains = db.prepare('SELECT * FROM domains').all() as (Domain & { project_id: string })[]

  const domainsByProject = domains.reduce<Record<string, Domain[]>>((acc, d) => {
    acc[d.project_id] ??= []
    acc[d.project_id].push(d)
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">탐색</h1>
        <Link
          href="/settings"
          className="text-sm px-4 py-2 rounded-lg"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          + 프로젝트 추가
        </Link>
      </div>

      <div className="flex flex-col gap-4">
        {projects.map((p) => (
          <div
            key={p.id}
            className="rounded-xl p-5"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-base">{p.name}</h2>
                <p className="text-xs mt-1 font-mono" style={{ color: 'var(--muted)' }}>{p.path}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/projects/${p.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#1d4ed8', color: '#fff' }}
                >
                  파일 탐색기
                </Link>
                <Link
                  href={`/editor/${p.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: '#7c3aed', color: '#fff' }}
                >
                  페이지 편집
                </Link>
              </div>
            </div>

            {domainsByProject[p.id]?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {domainsByProject[p.id].map((d) => (
                  <a
                    key={d.id}
                    href={d.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs px-3 py-1 rounded-full flex items-center gap-1.5"
                    style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--accent)' }}
                  >
                    <span>{d.is_external ? '🌐' : '🔒'}</span>
                    {d.label}
                    {d.port ? ` :${d.port}` : ''}
                  </a>
                ))}
              </div>
            )}

            {p.deploy_cmd && (
              <details className="mt-3">
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
                  배포 명령 보기
                </summary>
                <pre className="mt-2 text-xs p-3 rounded-lg overflow-x-auto" style={{ background: '#0f172a', color: 'var(--foreground)' }}>
                  {p.deploy_cmd}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
