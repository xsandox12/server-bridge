'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Provider { id: string; name: string; api_key: string; model: string; base_url: string; is_default: number }
interface Project { id: string; name: string; path: string; deploy_cmd: string; git_repo: string; git_branch: string }

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  gpt: 'GPT (OpenAI)',
  gemini: 'Gemini (Google)',
  ollama: 'Ollama (로컬)',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
      <h2 className="font-semibold mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-lg px-3 py-2 text-sm'
const inputStyle = { background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }

export default function SettingsForm({
  providers,
  projects,
  initialSettings,
}: {
  providers: Provider[]
  projects: Project[]
  initialSettings: Record<string, string>
}) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const deleteProvider = async (id: string, label: string) => {
    if (!confirm(`'${label}' 연결을 삭제할까요?`)) return
    const res = await fetch('/api/settings/providers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) router.refresh()
    else alert('삭제 실패')
  }

  const flash = (key: string, msg: string) => {
    setMsgs((m) => ({ ...m, [key]: msg }))
    setTimeout(() => setMsgs((m) => ({ ...m, [key]: '' })), 3000)
  }

  const saveProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving('provider')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch('/api/settings/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    flash('provider', res.ok ? '저장 완료' : '저장 실패')
    setSaving(null)
  }

  const saveIntegrations = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving('integrations')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    flash('integrations', res.ok ? '저장 완료' : '저장 실패')
    setSaving(null)
  }

  const saveProject = async (e: React.FormEvent<HTMLFormElement>, projectId: string) => {
    e.preventDefault()
    setSaving(projectId)
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    flash(projectId, res.ok ? '저장 완료' : '저장 실패')
    setSaving(null)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* GitHub + Cloudflare 연동 */}
      <Section title="외부 서비스 연동">
        <form onSubmit={saveIntegrations} className="flex flex-col gap-4">
          <Field label="GitHub Personal Access Token">
            <input
              name="github_token"
              type="password"
              defaultValue={initialSettings.github_token ?? ''}
              placeholder="ghp_..."
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Cloudflare API Token">
            <input
              name="cloudflare_api_token"
              type="password"
              defaultValue={initialSettings.cloudflare_api_token ?? ''}
              placeholder="Cloudflare API 토큰"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <Field label="Cloudflare Zone ID">
            <input
              name="cloudflare_zone_id"
              type="text"
              defaultValue={initialSettings.cloudflare_zone_id ?? ''}
              placeholder="Zone ID (Cloudflare 대시보드 → 도메인 → Overview)"
              className={inputCls}
              style={inputStyle}
            />
          </Field>
          <SaveRow saving={saving === 'integrations'} msg={msgs.integrations ?? ''} />
        </form>
      </Section>

      {/* 프로젝트 Git 설정 */}
      <Section title="프로젝트 Git 설정">
        <div className="flex flex-col gap-6">
          {projects.map((p) => (
            <form key={p.id} onSubmit={(e) => saveProject(e, p.id)} className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{p.name}</p>
              <div className="flex gap-3">
                <Field label="GitHub 저장소 (owner/repo)">
                  <input
                    name="git_repo"
                    type="text"
                    defaultValue={p.git_repo ?? ''}
                    placeholder="예: username/my-repo"
                    className={inputCls}
                    style={inputStyle}
                  />
                </Field>
                <Field label="브랜치">
                  <input
                    name="git_branch"
                    type="text"
                    defaultValue={p.git_branch ?? 'main'}
                    placeholder="main"
                    className="w-28 rounded-lg px-3 py-2 text-sm"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <SaveRow saving={saving === p.id} msg={msgs[p.id] ?? ''} label="저장" />
            </form>
          ))}
        </div>
      </Section>

      {/* AI 프로바이더 */}
      <Section title="AI 프로바이더 설정">
        <form onSubmit={saveProvider} className="flex flex-col gap-4">
          <Field label="프로바이더">
            <select name="name" className={inputCls} style={inputStyle}>
              {Object.entries(PROVIDER_LABELS).map(([v, l]) => {
                const existing = providers.find((p) => p.name === v)
                return <option key={v} value={v}>{l}{existing ? ' ✓' : ''}</option>
              })}
            </select>
          </Field>
          <Field label="API Key">
            <input name="api_key" type="password" placeholder="sk-..." className={inputCls} style={inputStyle} />
          </Field>
          <Field label="모델 (선택)">
            <input name="model" type="text" placeholder="claude-sonnet-4-6 / gpt-4o / gemini-2.0-flash" className={inputCls} style={inputStyle} />
          </Field>
          <Field label="Base URL (Ollama용)">
            <input name="base_url" type="text" placeholder="http://localhost:11434" className={inputCls} style={inputStyle} />
          </Field>
          <SaveRow saving={saving === 'provider'} msg={msgs.provider ?? ''} />
        </form>
        {providers.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: '#0f172a' }}>
                <span>{PROVIDER_LABELS[p.name] ?? p.name}</span>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--success)' }}>✓ 등록됨</span>
                  <button
                    type="button"
                    onClick={() => deleteProvider(p.id, PROVIDER_LABELS[p.name] ?? p.name)}
                    className="px-2 py-1 rounded-md"
                    style={{ background: 'transparent', border: '1px solid var(--card-border)', color: '#ef4444' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function SaveRow({ saving, msg, label = '저장' }: { saving: boolean; msg: string; label?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="submit" disabled={saving} className="text-sm px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
        {saving ? '저장 중…' : label}
      </button>
      {msg && <span className="text-sm" style={{ color: msg.includes('실패') ? '#ef4444' : 'var(--success)' }}>{msg}</span>}
    </div>
  )
}
