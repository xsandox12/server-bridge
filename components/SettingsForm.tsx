'use client'

import { useState } from 'react'

interface Provider { id: string; name: string; api_key: string; model: string; base_url: string; is_default: number }
interface Project { id: string; name: string; path: string; deploy_cmd: string }

const PROVIDER_LABELS: Record<string, string> = {
  claude: 'Claude (Anthropic)',
  gpt: 'GPT (OpenAI)',
  gemini: 'Gemini (Google)',
  ollama: 'Ollama (로컬)',
}

export default function SettingsForm({
  providers,
  projects,
}: {
  providers: Provider[]
  projects: Project[]
}) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const saveProvider = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const data = Object.fromEntries(form.entries())
    const res = await fetch('/api/settings/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setMsg(res.ok ? '저장 완료' : '저장 실패')
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* AI 프로바이더 */}
      <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <h2 className="font-semibold mb-4">AI 프로바이더 설정</h2>
        <form onSubmit={saveProvider} className="flex flex-col gap-4">
          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>프로바이더</label>
            <select name="name" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}>
              {Object.entries(PROVIDER_LABELS).map(([v, l]) => {
                const existing = providers.find((p) => p.name === v)
                return <option key={v} value={v}>{l}{existing ? ' ✓' : ''}</option>
              })}
            </select>
          </div>
          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>API Key</label>
            <input name="api_key" type="password" placeholder="sk-..." className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>모델 (선택)</label>
            <input name="model" type="text" placeholder="claude-sonnet-4-6 / gpt-4o / gemini-2.0-flash" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
          <div>
            <label className="text-sm block mb-1" style={{ color: 'var(--muted)' }}>Base URL (Ollama용)</label>
            <input name="base_url" type="text" placeholder="http://localhost:11434" className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }} />
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving} className="text-sm px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
              {saving ? '저장 중…' : '저장'}
            </button>
            {msg && <span className="text-sm" style={{ color: 'var(--success)' }}>{msg}</span>}
          </div>
        </form>

        {providers.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {providers.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ background: '#0f172a' }}>
                <span>{PROVIDER_LABELS[p.name] ?? p.name}</span>
                <span style={{ color: 'var(--success)' }}>✓ 등록됨</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 프로젝트 목록 */}
      <section className="rounded-xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
        <h2 className="font-semibold mb-4">등록된 프로젝트</h2>
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <div key={p.id} className="text-sm px-3 py-2 rounded-lg flex items-center justify-between" style={{ background: '#0f172a' }}>
              <span className="font-medium">{p.name}</span>
              <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>{p.path}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
