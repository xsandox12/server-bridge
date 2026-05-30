import SettingsForm from '@/components/SettingsForm'
import db from '@/lib/db'

export const dynamic = 'force-dynamic'

type Provider = { id: string; name: string; api_key: string; model: string; base_url: string; is_default: number }
type Project = { id: string; name: string; path: string; deploy_cmd: string }

export default function SettingsPage() {
  const providers = db.prepare('SELECT * FROM ai_providers').all() as Provider[]
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at').all() as Project[]

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">설정</h1>
      <SettingsForm providers={providers} projects={projects} />
    </div>
  )
}
