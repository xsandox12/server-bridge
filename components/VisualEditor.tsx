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
  const [prompt, setPrompt] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundFiles, setFoundFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<{ explanation: string; newContent: string } | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [allFilesFilter, setAllFilesFilter] = useState('')
  const [showFilePicker, setShowFilePicker] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const proxyUrl = selectedUrl ? `/api/proxy?url=${encodeURIComponent(selectedUrl)}` : ''

  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type !== 'element-click') return
      const el = e.data as ClickedElement
      setClickedEl(el)
      setPrompt('')
      setResult(null)
      setApplied(false)
      setFoundFiles([])
      setSelectedFile('')
      setFileContent('')
      setShowFilePicker(false)
      setAllFilesFilter('')

      // 소스 파일 자동 검색
      const searchText = el.textContent.trim()
      if (searchText.length > 2) {
        setSearching(true)
        const res = await fetch(
          `/api/files/search?path=${encodeURIComponent(projectPath)}&text=${encodeURIComponent(searchText.slice(0, 50))}`
        )
        const data = await res.json()
        const files: string[] = data.files ?? []
        setFoundFiles(files)
        setSearching(false)

        // 파일이 하나면 자동 선택
        if (files.length === 1) {
          await loadFile(files[0])
        }
      }

      // 프롬프트 인풋으로 포커스
      setTimeout(() => promptRef.current?.focus(), 100)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [projectPath])

  const loadAllFiles = async () => {
    if (allFiles.length > 0) { setShowFilePicker(true); return }
    const res = await fetch(`/api/files?path=${encodeURIComponent(projectPath)}&recursive=true`)
    const data = await res.json()
    setAllFiles(data.files ?? [])
    setShowFilePicker(true)
  }

  const loadFile = async (path: string) => {
    setSelectedFile(path)
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
    const data = await res.json()
    setFileContent(data.content ?? '')
  }

  const requestAI = async () => {
    if (!prompt.trim() || !selectedFile || !clickedEl) return
    setAiLoading(true)
    setResult(null)

    // 선택된 요소 정보를 프롬프트에 포함
    const fullPrompt = `다음 요소를 수정해주세요.

선택된 요소: ${clickedEl.selector || clickedEl.tagName}
현재 HTML: ${clickedEl.outerHTML.slice(0, 300)}

수정 요청: ${prompt}`

    const res = await fetch('/api/ai/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'claude', prompt: fullPrompt, filePath: selectedFile, fileContent }),
    })
    const data = await res.json()
    if (data.newContent) {
      setResult({ explanation: data.explanation ?? '', newContent: data.newContent })
    }
    setAiLoading(false)
  }

  const applyResult = async () => {
    if (!result) return
    setApplying(true)
    await fetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, content: result.newContent }),
    })
    setFileContent(result.newContent)
    setApplying(false)
    setApplied(true)
    // iframe 새로고침
    if (iframeRef.current) iframeRef.current.src = proxyUrl
  }

  return (
    <div className="flex h-full gap-3" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* 왼쪽: iframe */}
      <div className="flex-1 flex flex-col min-w-0 rounded-xl overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0" style={{ background: '#0d1629', borderBottom: '1px solid var(--card-border)' }}>
          <select
            value={selectedUrl}
            onChange={(e) => { setSelectedUrl(e.target.value); setClickedEl(null); setResult(null) }}
            className="flex-1 rounded px-2 py-1 text-xs"
            style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          >
            {domains.map((d) => (
              <option key={d.id} value={d.url}>{d.label} — {d.url}</option>
            ))}
          </select>
          <button
            onClick={() => { if (iframeRef.current) iframeRef.current.src = proxyUrl }}
            className="text-xs px-3 py-1 rounded"
            style={{ background: '#1e293b', color: 'var(--muted)' }}
          >
            새로고침
          </button>
        </div>
        <div className="flex-1 relative">
          <iframe
            ref={iframeRef}
            src={proxyUrl}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="시각적 편집기"
          />
          {/* Ctrl+클릭 안내 */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs pointer-events-none"
            style={{ background: 'rgba(15,23,42,0.85)', color: 'var(--muted)', backdropFilter: 'blur(4px)' }}
          >
            Ctrl + 클릭으로 요소 선택
          </div>
        </div>
      </div>

      {/* 오른쪽: 편집 패널 */}
      <div
        className="w-80 flex-shrink-0 rounded-xl overflow-y-auto flex flex-col gap-3 p-4"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        {!clickedEl ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center" style={{ color: 'var(--muted)' }}>
            <span className="text-4xl">👆</span>
            <p className="text-sm">Ctrl + 클릭으로<br />수정할 요소를 선택하세요</p>
          </div>
        ) : (
          <>
            {/* 선택된 요소 */}
            <div className="rounded-lg p-2.5" style={{ background: '#0f172a', border: '1px solid var(--card-border)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>선택된 요소</p>
              <p className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{clickedEl.selector || clickedEl.tagName}</p>
              {clickedEl.textContent && (
                <p className="text-xs mt-1 truncate" style={{ color: 'var(--foreground)' }}>{clickedEl.textContent.slice(0, 80)}</p>
              )}
            </div>

            {/* 소스 파일 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  소스 파일 {searching ? '검색 중…' : `(${foundFiles.length}개)`}
                </p>
                <button
                  onClick={loadAllFiles}
                  className="text-xs px-2 py-0.5 rounded"
                  style={{ background: '#1e293b', color: 'var(--muted)' }}
                >
                  직접 선택
                </button>
              </div>

              {/* 자동 검색 결과 */}
              <div className="flex flex-col gap-1">
                {foundFiles.map((f) => (
                  <button
                    key={f}
                    onClick={() => { loadFile(f); setShowFilePicker(false) }}
                    className="text-left text-xs px-2 py-1.5 rounded truncate"
                    style={{
                      background: selectedFile === f ? 'var(--accent)' : '#0f172a',
                      color: selectedFile === f ? '#fff' : 'var(--foreground)',
                      border: '1px solid var(--card-border)',
                    }}
                  >
                    {f.split('/').slice(-2).join('/')}
                  </button>
                ))}
              </div>

              {/* 수동 파일 선택 */}
              {showFilePicker && (
                <div className="mt-2 flex flex-col gap-1">
                  <input
                    autoFocus
                    type="text"
                    value={allFilesFilter}
                    onChange={(e) => setAllFilesFilter(e.target.value)}
                    placeholder="파일 이름 검색…"
                    className="w-full rounded px-2 py-1 text-xs"
                    style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                    {allFiles
                      .filter((f) => !allFilesFilter || f.toLowerCase().includes(allFilesFilter.toLowerCase()))
                      .map((f) => (
                        <button
                          key={f}
                          onClick={() => { loadFile(f); setShowFilePicker(false) }}
                          className="text-left text-xs px-2 py-1 rounded truncate"
                          style={{
                            background: selectedFile === f ? 'var(--accent)' : '#0f172a',
                            color: selectedFile === f ? '#fff' : 'var(--foreground)',
                          }}
                        >
                          {f.replace(projectPath, '').replace(/^\//, '')}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* AI 수정 요청 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                ✨ AI 수정 요청{!selectedFile && <span className="ml-1" style={{ color: '#ef4444' }}>(파일 선택 필요)</span>}
              </p>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) requestAI() }}
                placeholder="어떻게 수정할까요?&#10;예) 폰트를 더 크게 해줘&#10;예) 색상을 파란색으로 바꿔줘"
                rows={4}
                className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
              />
              <button
                onClick={requestAI}
                disabled={aiLoading || !prompt.trim() || !selectedFile}
                className="w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: aiLoading || !prompt.trim() || !selectedFile ? '#1e293b' : '#7c3aed',
                  color: aiLoading || !prompt.trim() || !selectedFile ? 'var(--muted)' : '#fff',
                }}
              >
                {aiLoading ? 'AI 처리 중…' : 'AI 수정 (Ctrl+Enter)'}
              </button>
            </div>

            {/* AI 결과 */}
            {result && (
              <div className="flex flex-col gap-2">
                {result.explanation && (
                  <div className="rounded-lg p-2.5 text-xs" style={{ background: '#0f172a', color: 'var(--muted)' }}>
                    {result.explanation}
                  </div>
                )}
                <button
                  onClick={applyResult}
                  disabled={applying || applied}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold"
                  style={{
                    background: applied ? '#166534' : '#1d4ed8',
                    color: '#fff',
                    opacity: applying ? 0.7 : 1,
                  }}
                >
                  {applying ? '적용 중…' : applied ? '✓ 적용 완료 (페이지 새로고침됨)' : '변경사항 적용'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
