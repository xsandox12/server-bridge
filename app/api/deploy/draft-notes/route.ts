import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { callProvider, type AIProvider } from '@/lib/ai'

interface ProviderRow { name: string; api_key?: string; model?: string; base_url?: string }

function resolveProvider(): ProviderRow | null {
  const def = db.prepare("SELECT name, api_key, model, base_url FROM ai_providers WHERE is_default = 1").get() as ProviderRow | undefined
  if (def) return def
  const claude = db.prepare("SELECT name, api_key, model, base_url FROM ai_providers WHERE name = 'claude'").get() as ProviderRow | undefined
  return claude ?? null
}

export async function POST(req: NextRequest) {
  const { projectId } = await req.json()

  const project = db.prepare('SELECT path FROM projects WHERE id = ?').get(projectId) as { path: string } | undefined
  if (!project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  let commits = ''
  try {
    commits = execSync(
      `git -C ${JSON.stringify(project.path)} log --oneline -10 --pretty=format:"%s"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim()
  } catch {
    return NextResponse.json({ error: 'git log failed' }, { status: 500 })
  }
  if (!commits) return NextResponse.json({ notes: '' })

  const providerRow = resolveProvider()
  if (!providerRow) return NextResponse.json({ error: 'no AI provider configured' }, { status: 400 })

  const prompt = `다음은 최근 git 커밋 메시지 목록이다. 이 내용을 바탕으로 사용자에게 보여줄 한글 업데이트 내역을 작성해줘. 커밋 해시나 영어 원문 그대로 나열하지 말고, 실제로 뭐가 달라졌는지 항목별로 간결하게 정리해줘.

${commits}

응답은 "- " bullet 목록만 출력해줘. 다른 설명은 붙이지 마.`

  try {
    const notes = await callProvider(
      { provider: providerRow.name as AIProvider, apiKey: providerRow.api_key, model: providerRow.model, baseUrl: providerRow.base_url },
      prompt,
    )
    return NextResponse.json({ notes: notes.trim() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
