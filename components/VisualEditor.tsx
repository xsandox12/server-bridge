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

function FileItem({ path, projectPath, selected, onClick }: { path: string; projectPath: string; selected: boolean; onClick: () => void }) {
  const rel = path.replace(projectPath, '').replace(/^\//, '')
  const parts = rel.split('/')
  const name = parts[parts.length - 1]
  const dir = parts.slice(0, -1).join('/')
  return (
    <button
      onClick={onClick}
      title={rel}
      className="text-left w-full px-2 py-1.5 rounded flex flex-col"
      style={{
        background: selected ? 'var(--accent)' : '#0f172a',
        border: '1px solid var(--card-border)',
      }}
    >
      <span className="text-xs font-medium" style={{ color: selected ? '#fff' : 'var(--foreground)' }}>{name}</span>
      {dir && <span className="text-xs mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.6)' : 'var(--muted)' }}>{dir}</span>}
    </button>
  )
}

export default function VisualEditor({ projectId, projectPath, domains }: Props) {
  const [selectedUrl, setSelectedUrl] = useState(domains[0]?.url ?? '')
  const [clickedEl, setClickedEl] = useState<ClickedElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [searching, setSearching] = useState(false)
  const [foundFiles, setFoundFiles] = useState<string[]>([])
  const [allFiles, setAllFiles] = useState<string[]>([])
  const [allFilesFilter, setAllFilesFilter] = useState('')
  const [showAllFiles, setShowAllFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<{ explanation: string; newContent: string } | null>(null)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  const proxyUrl = selectedUrl ? `/api/proxy?url=${encodeURIComponent(selectedUrl)}` : ''

  // 전체 파일 목록 미리 로드 (컴포넌트 마운트 시)
  useEffect(() => {
    fetch(`/api/files?path=${encodeURIComponent(projectPath)}&recursive=true`)
      .then((r) => r.json())
      .then((d) => setAllFiles(d.files ?? []))
  }, [projectPath])

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
      setShowAllFiles(false)
      setAllFilesFilter('')

      // 텍스트로 소스 파일 검색
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

        if (files.length === 1) {
          // 하나면 자동 선택
          await loadFile(files[0])
        } else if (files.length === 0) {
          // 못 찾으면 전체 파일 목록 자동 표시
          setShowAllFiles(true)
        }
      } else {
        // 텍스트가 짧으면 바로 전체 목록 표시
        setShowAllFiles(true)
      }

      setTimeout(() => promptRef.current?.focus(), 100)
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [projectPath])

  const loadFile = async (filePath: string) => {
    setSelectedFile(filePath)
    const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`)
    const data = await res.json()
    setFileContent(data.content ?? '')
    setShowAllFiles(false)
  }

  const requestAI = async () => {
    if (!prompt.trim() || !selectedFile || !clickedEl) return
    setAiLoading(true)
    setResult(null)

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
    if (iframeRef.current) iframeRef.current.src = proxyUrl
  }

  const filteredAllFiles = allFiles.filter((f) =>
    !allFilesFilter || f.toLowerCase().includes(allFilesFilter.toLowerCase())
  )

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
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--foreground)' }}>{clickedEl.textContent.slice(0, 120)}</p>
              )}
            </div>

            {/* 소스 파일 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {searching ? '파일 검색 중…' : selectedFile ? '소스 파일' : `소스 파일 (${foundFiles.length}개 검색됨)`}
                </p>
                {selectedFile && (
                  <button
                    onClick={() => { setSelectedFile(''); setFileContent(''); setShowAllFiles(true) }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: '#1e293b', color: 'var(--muted)' }}
                  >
                    변경
                  </button>
                )}
              </div>

              {/* 선택된 파일 표시 */}
              {selectedFile && (
                <div className="rounded-lg px-2 py-1.5" style={{ background: 'var(--accent)' }}>
                  <p className="text-xs font-medium text-white">{selectedFile.split('/').pop()}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {selectedFile.replace(projectPath, '').replace(/\/[^/]+$/, '').replace(/^\//, '')}
                  </p>
                </div>
              )}

              {/* 자동 검색 결과 (복수 파일) */}
              {!selectedFile && foundFiles.length > 1 && (
                <div className="flex flex-col gap-1 mb-2">
                  {foundFiles.map((f) => (
                    <FileItem key={f} path={f} projectPath={projectPath} selected={false} onClick={() => loadFile(f)} />
                  ))}
                </div>
              )}

              {/* 전체 파일 목록 */}
              {!selectedFile && showAllFiles && (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={allFilesFilter}
                    onChange={(e) => setAllFilesFilter(e.target.value)}
                    placeholder="파일 이름으로 검색…"
                    className="w-full rounded px-2 py-1 text-xs"
                    style={{ background: '#0f172a', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
                  />
                  <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto mt-1">
                    {filteredAllFiles.map((f) => (
                      <FileItem key={f} path={f} projectPath={projectPath} selected={false} onClick={() => loadFile(f)} />
                    ))}
                    {filteredAllFiles.length === 0 && (
                      <p className="text-xs py-2 text-center" style={{ color: 'var(--muted)' }}>파일 없음</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI 수정 요청 */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                ✨ AI 수정 요청
                {!selectedFile && <span className="ml-1 font-normal" style={{ color: '#f59e0b' }}>파일을 먼저 선택하세요</span>}
              </p>
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) requestAI() }}
                placeholder="어떻게 수정할까요?&#10;예) 폰트를 더 크게 해줘&#10;예) 색상을 파란색으로 바꿔줘"
                rows={4}
                disabled={!selectedFile}
                className="w-full rounded-lg px-3 py-2 text-xs resize-none"
                style={{
                  background: '#0f172a',
                  border: '1px solid var(--card-border)',
                  color: 'var(--foreground)',
                  opacity: selectedFile ? 1 : 0.5,
                }}
              />
              <button
                onClick={requestAI}
                disabled={aiLoading || !prompt.trim() || !selectedFile}
                className="w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: !aiLoading && prompt.trim() && selectedFile ? '#7c3aed' : '#1e293b',
                  color: !aiLoading && prompt.trim() && selectedFile ? '#fff' : 'var(--muted)',
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
                  {applying ? '적용 중…' : applied ? '✓ 적용 완료' : '변경사항 적용'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
