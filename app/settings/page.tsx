import SettingsForm from '@/components/SettingsForm'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Provider = { id: string; name: string; api_key: string; model: string; base_url: string; is_default: number }
type Project = { id: string; name: string; path: string; deploy_cmd: string; git_repo: string; git_branch: string }

export default function SettingsPage() {
  const providers = db.prepare('SELECT * FROM ai_providers').all() as Provider[]
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Project[]
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  const initialSettings: Record<string, string> = {}
  for (const r of settingsRows) initialSettings[r.key] = r.value

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">설정</h1>
      <SettingsForm providers={providers} projects={projects} initialSettings={initialSettings} />
    </div>
  )
}
