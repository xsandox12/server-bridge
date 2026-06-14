export type AIProvider = 'claude' | 'gpt' | 'gemini' | 'ollama'

export interface AIEditRequest {
  provider: AIProvider
  apiKey?: string
  model?: string
  baseUrl?: string
  prompt: string
  filePath: string
  fileContent: string
}

export interface AIEditResponse {
  newContent: string
  explanation: string
}

export interface AIProviderConfig {
  provider: AIProvider
  apiKey?: string
  model?: string
  baseUrl?: string
}

// 트랜스포트: 임의의 프롬프트 문자열 → 원시 응답 텍스트
export async function callProvider(cfg: AIProviderConfig, promptText: string): Promise<string> {
  switch (cfg.provider) {
    case 'claude': {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      const client = new Anthropic({ apiKey: cfg.apiKey })
      const message = await client.messages.create({
        model: cfg.model ?? 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{ role: 'user', content: promptText }],
      })
      return (message.content[0] as { text: string }).text
    }
    case 'gpt': {
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey: cfg.apiKey })
      const res = await client.chat.completions.create({
        model: cfg.model ?? 'gpt-4o',
        messages: [{ role: 'user', content: promptText }],
      })
      return res.choices[0].message.content ?? ''
    }
    case 'gemini': {
      const { GoogleGenerativeAI } = await import('@google/generative-ai')
      const client = new GoogleGenerativeAI(cfg.apiKey ?? '')
      const model = client.getGenerativeModel({ model: cfg.model ?? 'gemini-2.0-flash' })
      const result = await model.generateContent(promptText)
      return result.response.text()
    }
    case 'ollama': {
      const baseUrl = cfg.baseUrl ?? 'http://localhost:11434'
      const res = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cfg.model ?? 'llama3.1',
          prompt: promptText,
          stream: false,
        }),
      })
      const data = await res.json()
      return data.response ?? ''
    }
    default:
      throw new Error(`unknown provider: ${cfg.provider}`)
  }
}

function buildPrompt(req: AIEditRequest): string {
  return `다음 파일을 수정해주세요.

파일 경로: ${req.filePath}

수정 요청: ${req.prompt}

현재 파일 내용:
\`\`\`
${req.fileContent}
\`\`\`

응답 형식 (반드시 이 형식으로):
EXPLANATION: <한 문장으로 변경 내용 설명>
CONTENT:
<수정된 전체 파일 내용>`
}

function parseResponse(text: string): AIEditResponse {
  const explanationMatch = text.match(/EXPLANATION:\s*(.+?)(?:\n|$)/)
  const contentMatch = text.match(/CONTENT:\s*\n([\s\S]+)/)

  return {
    explanation: explanationMatch?.[1]?.trim() ?? '파일이 수정되었습니다.',
    newContent: contentMatch?.[1]?.trim() ?? text,
  }
}

export async function editWithAI(req: AIEditRequest): Promise<AIEditResponse> {
  const text = await callProvider(
    { provider: req.provider, apiKey: req.apiKey, model: req.model, baseUrl: req.baseUrl },
    buildPrompt(req),
  )
  return parseResponse(text)
}
