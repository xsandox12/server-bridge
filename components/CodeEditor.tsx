'use client'

import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'

interface Props {
  filePath: string
  content: string
  onChange?: (value: string) => void
  onSave?: (value: string) => Promise<void>
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    css: 'css', scss: 'scss', html: 'html', json: 'json',
    md: 'markdown', yml: 'yaml', yaml: 'yaml', sh: 'shell',
    py: 'python', go: 'go', rs: 'rust',
  }
  return map[ext ?? ''] ?? 'plaintext'
}

export default function CodeEditor({ filePath, content, onChange, onSave }: Props) {
  const [value, setValue] = useState(content)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)

  const handleChange = useCallback((v: string | undefined) => {
    const newVal = v ?? ''
    setValue(newVal)
    setDirty(newVal !== content)
    onChange?.(newVal)
  }, [content, onChange])

  const handleSave = async () => {
    if (!onSave) return
    setSaving(true)
    await onSave(value)
    setSaving(false)
    setSaved(true)
    setDirty(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div
        className="flex items-center justify-between px-3 py-1.5 text-xs flex-shrink-0"
        style={{ background: '#0d1629', borderBottom: '1px solid var(--card-border)' }}
      >
        <span className="font-mono truncate" style={{ color: 'var(--muted)' }}>
          {filePath.split('/').pop()}
          {dirty && <span style={{ color: 'var(--warning)' }}> ●</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="px-3 py-1 rounded text-xs transition-opacity"
          style={{
            background: dirty ? '#1d4ed8' : '#1e293b',
            color: dirty ? '#fff' : 'var(--muted)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? '저장 중…' : saved ? '✓ 저장됨' : 'Ctrl+S 저장'}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language={getLanguage(filePath)}
          value={value}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'none',
            padding: { top: 8 },
          }}
          onMount={(editor, monaco) => {
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
              handleSave()
            })
          }}
        />
      </div>
    </div>
  )
}
