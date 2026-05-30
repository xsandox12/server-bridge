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

async function callClaude(req: AIEditRequest): Promise<AIEditResponse> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: req.apiKey })
  const message = await client.messages.create({
    model: req.model ?? 'claude-sonnet-4-6',
    max_tokens: 8192,
    messages: [{ role: 'user', content: buildPrompt(req) }],
  })
  return parseResponse((message.content[0] as { text: string }).text)
}

async function callGPT(req: AIEditRequest): Promise<AIEditResponse> {
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({ apiKey: req.apiKey })
  const res = await client.chat.completions.create({
    model: req.model ?? 'gpt-4o',
    messages: [{ role: 'user', content: buildPrompt(req) }],
  })
  return parseResponse(res.choices[0].message.content ?? '')
}

async function callGemini(req: AIEditRequest): Promise<AIEditResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const client = new GoogleGenerativeAI(req.apiKey ?? '')
  const model = client.getGenerativeModel({ model: req.model ?? 'gemini-2.0-flash' })
  const result = await model.generateContent(buildPrompt(req))
  return parseResponse(result.response.text())
}

async function callOllama(req: AIEditRequest): Promise<AIEditResponse> {
  const baseUrl = req.baseUrl ?? 'http://localhost:11434'
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: req.model ?? 'llama3.1',
      prompt: buildPrompt(req),
      stream: false,
    }),
  })
  const data = await res.json()
  return parseResponse(data.response ?? '')
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
  switch (req.provider) {
    case 'claude': return callClaude(req)
    case 'gpt': return callGPT(req)
    case 'gemini': return callGemini(req)
    case 'ollama': return callOllama(req)
    default: throw new Error(`unknown provider: ${req.provider}`)
  }
}
