'use client'

import { useEffect, useState } from 'react'

interface FileEntry {
  name: string
  type: 'file' | 'directory'
  size: number
}

interface Props {
  rootPath: string
  onSelectFile: (path: string) => void
  selectedPath: string
}

function FileNode({
  entry,
  path,
  depth,
  onSelectFile,
  selectedPath,
}: {
  entry: FileEntry
  path: string
  depth: number
  onSelectFile: (path: string) => void
  selectedPath: string
}) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<FileEntry[]>([])

  const fullPath = `${path}/${entry.name}`
  const isSelected = fullPath === selectedPath

  const handleClick = async () => {
    if (entry.type === 'directory') {
      if (!open) {
        const res = await fetch(`/api/files?path=${encodeURIComponent(fullPath)}`)
        const data = await res.json()
        setChildren(Array.isArray(data) ? data : [])
      }
      setOpen((o) => !o)
    } else {
      onSelectFile(fullPath)
    }
  }

  const indent = depth * 12

  return (
    <div>
      <div
        onClick={handleClick}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-sm select-none"
        style={{
          paddingLeft: `${8 + indent}px`,
          background: isSelected ? 'var(--accent)' : 'transparent',
          color: isSelected ? '#fff' : entry.type === 'directory' ? '#94a3b8' : 'var(--foreground)',
        }}
      >
        <span className="flex-shrink-0 text-xs">
          {entry.type === 'directory' ? (open ? '▾' : '▸') : '·'}
        </span>
        <span className="truncate">{entry.name}</span>
      </div>
      {open && children.length > 0 && (
        <div>
          {children
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
              return a.name.localeCompare(b.name)
            })
            .map((child) => (
              <FileNode
                key={child.name}
                entry={child}
                path={fullPath}
                depth={depth + 1}
                onSelectFile={onSelectFile}
                selectedPath={selectedPath}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default function FileExplorer({ rootPath, onSelectFile, selectedPath }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/files?path=${encodeURIComponent(rootPath)}`)
      .then((r) => r.json())
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [rootPath])

  if (loading) return <p className="p-3 text-xs" style={{ color: 'var(--muted)' }}>로딩 중…</p>

  return (
    <div className="overflow-y-auto h-full py-2">
      {entries
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        .map((e) => (
          <FileNode
            key={e.name}
            entry={e}
            path={rootPath}
            depth={0}
            onSelectFile={onSelectFile}
            selectedPath={selectedPath}
          />
        ))}
    </div>
  )
}
