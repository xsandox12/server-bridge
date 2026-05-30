'use client'

import { useState, useEffect, useRef } from 'react'

interface Domain { id: string; label: string; url: string }
interface ClickedElement {
  selector: string
  tagName: string
  textContent: string
  outerHTML: string
  src: string
}

interface Props {
  projectId: string
  projectPath: string
  domains: Domain[]
}

export default function VisualEditor({ projectId, projectPath, domains }: Props) {
  const [selectedUrl, setSelectedUrl] = useState(domains[0]?.url ?? '')
  const [clickedEl, setClickedEl] = useState<ClickedElement | null>(null)
  const [editValue, setEditValue] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundFiles, setFoundFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const proxyUrl = selectedUrl ? `/api/proxy?url=${encodeURIComponent(selectedUrl)}` : ''

  // postMessage 수신
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== 'element-click') return
      const el = e.data as ClickedElement
      setClickedEl(el)
      setEditValue(el.textContent)
      setFoundFiles([])
      setSelectedFile('')
      setFileContent('')

      if (el.textContent.trim().length > 3) {
        setSearching(true)
        const res = await fetch(
          `/api/files/search?path=${encodeURIComponent(projectPath)}&text=${encodeURIComponent(el.textContent.slice(0, 50))}`
        )
        const data = await res.json()
        setFoundFiles(data.files ?? [])
        setSearching(false)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [projectPath])

  const loadFile = async (path: string) => {
    setSelectedFile(path)
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
    const data = await res.json()
    setFileContent(data.content ?? '')
  }

  const saveFile = async (content: string) => {
    setSaving(true)
    await fetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, content }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const replaceInFile = () => {
    if (!fileContent || !clickedEl) return
    const updated = fileContent.replace(clickedEl.textContent, editValue)
    setFileContent(updated)
    saveFile(updated)
  }

  const requestAI = async () => {
    if (!prompt || !selectedFile) return
    setAiLoading(true)
    const res = await fetch('/api/ai/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', prompt, filePath: selectedFile, fileContent }),
    })
    const data = await res.json()
    if (data.newContent) {
      setFileContent(data.newContent)
      saveFile(data.newContent)
    }
    setAiLoading(false)
    setPrompt('')
  }

  return (
    <div className="flex h-full gap-3" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* 왼쪽: iframe */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
        {/* URL 선택바 */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ background: '#0d1629', borderBottom: '1px solid var(--card-border)' }}>
          <select
            value={selectedUrl}
            onChange={(e) => setSelectedUrl(e.target.value)}
            className="flex-1 rounded px-2 py-1 text-xs"
            style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            {domains.map((d) => (
              <option key={d.id} value={d.url}>{d.label} — {d.url}</option>
            ))}
          </select>
          <button
            onClick={() => iframeRef.current && (iframeRef.current.src = proxyUrl)}
            className="text-xs px-3 py-1 rounded"
            style={{ background: '#1e293b', color: 'var(--muted)' }}
          >
            새로고침
          </button>
        </div>

        <iframe
          ref={iframeRef}
          src={proxyUrl}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="시각적 편집기"
        />
      </div>

      {/* 오른쪽: 편집 패널 */}
      <div
        className="w-80 flex-shrink-0 rounded-xl overflow-y-auto flex flex-col gap-4 p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        {!clickedEl ? (
          <div className="text-center mt-8 flex flex-col gap-2" style={{ color: 'var(--muted)' }}>
            <span className="text-3xl">👆</span>
            <p className="text-sm">왼쪽 페이지에서 수정할 요소를 클릭하세요</p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>선택된 요소</p>
              <p className="text-xs font-mono px-2 py-1 rounded" style={{ background: '#0f172a', color: 'var(--accent)' }}>
                {clickedEl.selector || clickedEl.tagName}
              </p>
            </div>

            {clickedEl.textContent && (
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>텍스트 수정</p>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg px-2 py-1.5 text-xs resize-none"
                  style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                />
              </div>
            )}

            {/* 소스 파일 검색 결과 */}
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                소스 파일 {searching ? '검색 중…' : `(${foundFiles.length}개)`}
              </p>
              <div className="flex flex-col gap-1">
                {foundFiles.map((f) => (
                  <button
                    key={f}
                    onClick={() => loadFile(f)}
                    className="text-left text-xs px-2 py-1 rounded truncate"
                    style={{
                      background: selectedFile === f ? 'var(--accent)' : '#0f172a',
                      color: selectedFile === f ? '#fff' : 'var(--foreground)',
                    }}
                  >
                    {f.split('/').slice(-2).join('/')}
                  </button>
                ))}
              </div>
            </div>

            {selectedFile && (
              <>
                <button
                  onClick={replaceInFile}
                  disabled={saving}
                  className="py-2 rounded-lg text-sm font-medium"
                  style={{ background: '#1d4ed8', color: '#fff', opacity: saving ? 0.6 : 1 }}
                >
                  {saving ? '저장 중…' : saved ? '✓ 저장됨' : '텍스트 교체 + 저장'}
                </button>

                <div>
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>AI 수정 요청</p>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="이 파일을 어떻게 수정할까요?"
                    rows={2}
                    className="w-full rounded-lg px-2 py-1.5 text-xs resize-none mb-2"
                    style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <button
                    onClick={requestAI}
                    disabled={aiLoading || !prompt}
                    className="w-full py-2 rounded-lg text-sm font-medium"
                    style={{ background: '#7c3aed', color: '#fff', opacity: aiLoading || !prompt ? 0.6 : 1 }}
                  >
                    {aiLoading ? 'AI 처리 중…' : '✨ AI 수정'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
