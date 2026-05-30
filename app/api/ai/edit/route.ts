import { editWithAI, AIEditRequest } from '@/lib/ai'
import db from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? '/workspace'

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<AIEditRequest, 'apiKey' | 'model' | 'baseUrl'> & { provider: string }

  // DB에서 provider 설정 조회
  const providerConfig = db
    .prepare('SELECT * FROM ai_providers WHERE name = ?')
    .get(body.provider) as { api_key?: string; model?: string; base_url?: string } | undefined

  // 파일 내용 자동 로드 (filePath만 받았을 경우)
  let fileContent = body.fileContent
  if (!fileContent && body.filePath) {
    const safe = path.resolve(body.filePath)
    if (safe.startsWith(WORKSPACE) && fs.existsSync(safe)) {
      fileContent = fs.readFileSync(safe, 'utf8')
    }
  }

  try {
    const result = await editWithAI({
      ...body,
      fileContent,
      apiKey: providerConfig?.api_key,
      model: providerConfig?.model,
      baseUrl: providerConfig?.base_url,
    } as AIEditRequest)

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
