'use client'

import { useState } from 'react'
import FileExplorer from './FileExplorer'
import CodeEditor from './CodeEditor'
import AIEditor from './AIEditor'
import DeployPanel from './DeployPanel'

type Project = { id: string; name: string; path: string; deploy_cmd: string | null }

type Tab = 'code' | 'ai'

export default function ProjectDetail({ project }: { project: Project }) {
  const [selectedFile, setSelectedFile] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('code')
  const [loadingFile, setLoadingFile] = useState(false)

  const handleSelectFile = async (path: string) => {
    setLoadingFile(true)
    setSelectedFile(path)
    const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
    const data = await res.json()
    setFileContent(data.content ?? '')
    setLoadingFile(false)
  }

  const handleSave = async (newContent: string) => {
    await fetch('/api/files', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: selectedFile, content: newContent }),
    })
    setFileContent(newContent)
  }

  const handleApplyAI = async (newContent: string) => {
    setFileContent(newContent)
    await handleSave(newContent)
    setActiveTab('code')
  }

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold">{project.name}</h1>
          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{project.path}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/editor/${project.id}`}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ background: '#1d4ed8', color: '#fff' }}
          >
            페이지 편집
          </a>
          {project.deploy_cmd && <DeployPanel projectId={project.id} />}
        </div>
      </div>

      {/* 3-panel 레이아웃 */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">
        {/* 왼쪽: 파일 트리 */}
        <div
          className="w-52 flex-shrink-0 rounded-xl overflow-hidden"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--card-border)' }}>
            파일
          </div>
          <FileExplorer
            rootPath={project.path}
            onSelectFile={handleSelectFile}
            selectedPath={selectedFile}
          />
        </div>

        {/* 중앙: 코드 에디터 */}
        <div
          className="flex-1 rounded-xl overflow-hidden flex flex-col min-w-0"
          style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
        >
          {loadingFile ? (
            <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--muted)' }}>
              <span className="text-sm">파일 로딩 중…</span>
            </div>
          ) : selectedFile ? (
            <CodeEditor
              filePath={selectedFile}
              content={fileContent}
              onChange={setFileContent}
              onSave={handleSave}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center flex-col gap-2" style={{ color: 'var(--muted)' }}>
              <span className="text-3xl">📄</span>
              <span className="text-sm">왼쪽에서 파일을 선택하세요</span>
            </div>
          )}
        </div>

        {/* 오른쪽: AI 에디터 패널 */}
        {selectedFile && (
          <div
            className="w-72 flex-shrink-0 rounded-xl overflow-hidden flex flex-col"
            style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
          >
            {/* 탭 */}
            <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--card-border)' }}>
              {(['code', 'ai'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className="flex-1 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: activeTab === t ? 'var(--accent)' : 'transparent',
                    color: activeTab === t ? '#fff' : 'var(--muted)',
                  }}
                >
                  {t === 'code' ? '정보' : '✨ AI 수정'}
                </button>
              ))}
            </div>

            {activeTab === 'ai' ? (
              <AIEditor
                filePath={selectedFile}
                fileContent={fileContent}
                onApply={handleApplyAI}
              />
            ) : (
              <div className="p-3 text-xs flex flex-col gap-2" style={{ color: 'var(--muted)' }}>
                <div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>선택된 파일</p>
                  <p className="font-mono break-all">{selectedFile}</p>
                </div>
                <div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>크기</p>
                  <p>{(fileContent.length / 1024).toFixed(1)} KB ({fileContent.split('\n').length} 줄)</p>
                </div>
                <div className="mt-2 p-2 rounded" style={{ background: '#0f172a' }}>
                  <p className="mb-1" style={{ color: 'var(--foreground)' }}>AI 수정 사용법</p>
                  <p>오른쪽 탭의 ✨ AI 수정 에서 자연어로 수정을 요청하세요.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
