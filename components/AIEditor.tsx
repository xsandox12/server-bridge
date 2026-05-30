'use client'

import { useState, useEffect } from 'react'

interface Provider { id: string; name: string; model: string | null }

interface Props {
  filePath: string
  fileContent: string
  onApply: (newContent: string) => void
}

export default function AIEditor({ filePath, fileContent, onApply }: Props) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ newContent: string; explanation: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/settings/providers')
      .then((r) => r.json())
      .then((data) => {
        setProviders(data)
        if (data.length > 0) setSelectedProvider(data[0].name)
      })
  }, [])

  const handleRequest = async () => {
    if (!prompt.trim() || !selectedProvider) return
    setLoading(true)
    setResult(null)
    setError('')

    const res = await fetch('/api/ai/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: selectedProvider,
        prompt,
        filePath,
        fileContent,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '오류 발생')
    } else {
      setResult(data)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-3 p-3 h-full overflow-y-auto">
      <h3 className="text-sm font-semibold">AI 코드 수정</h3>

      {providers.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          설정 페이지에서 AI 프로바이더를 먼저 등록하세요.
        </p>
      ) : (
        <>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            {providers.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name.toUpperCase()} {p.model ? `(${p.model})` : ''}
              </option>
            ))}
          </select>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="수정 요청을 입력하세요. 예: 버튼 색상을 파란색으로 바꿔줘"
            rows={4}
            className="rounded-lg px-3 py-2 text-sm w-full resize-none"
            style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />

          <button
            onClick={handleRequest}
            disabled={loading || !prompt.trim()}
            className="py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ background: '#7c3aed', color: '#fff', opacity: loading || !prompt.trim() ? 0.6 : 1 }}
          >
            {loading ? 'AI 처리 중…' : '✨ AI 수정 요청'}
          </button>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#450a0a', color: '#fca5a5' }}>
              {error}
            </p>
          )}

          {result && (
            <div className="flex flex-col gap-2">
              <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#052e16', color: '#86efac' }}>
                {result.explanation}
              </p>

              {/* diff: 변경 전/후 */}
              <div className="text-xs rounded-lg overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                <div className="px-3 py-1.5" style={{ background: '#0d1629', color: 'var(--muted)' }}>
                  변경 미리보기
                </div>
                <pre
                  className="p-3 overflow-auto max-h-48 whitespace-pre-wrap text-xs"
                  style={{ background: '#020617', color: '#94a3b8', fontFamily: 'monospace' }}
                >
                  {result.newContent.slice(0, 500)}{result.newContent.length > 500 ? '\n…(truncated)' : ''}
                </pre>
              </div>

              <button
                onClick={() => onApply(result.newContent)}
                className="py-2 rounded-lg text-sm font-medium"
                style={{ background: '#14532d', color: '#86efac' }}
              >
                ✓ 적용
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
