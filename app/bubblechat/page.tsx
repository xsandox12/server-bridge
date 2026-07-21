'use client'

import { useEffect, useState } from 'react'

type WordEntry = { word: string; count: number; lastAt: string }
type AddStatus = 'adding' | 'added' | 'exists' | 'error'

export default function BubbleChatPage() {
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [addStatus, setAddStatus] = useState<Record<string, AddStatus>>({})
  const [resolving, setResolving] = useState<Record<string, boolean>>({})

  const [customWords, setCustomWords] = useState<string[]>([])
  const [customLoading, setCustomLoading] = useState(true)
  const [customBusy, setCustomBusy] = useState<Record<string, boolean>>({})

  const [query, setQuery] = useState('')
  const [lookup, setLookup] = useState<{ word: string; valid: boolean } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [checking, setChecking] = useState(false)

  const fetchWords = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bubblechat/unknown-words')
      const data = await res.json()
      if (data.error) setError(data.error)
      setWords(data.words ?? [])
    } catch (err) {
      setError(String(err))
    }
    setLoading(false)
  }

  const fetchCustomWords = async () => {
    setCustomLoading(true)
    try {
      const res = await fetch('/api/bubblechat/dictionary/custom')
      const data = await res.json()
      setCustomWords(data.words ?? [])
    } catch {
      // 표시용 목록이므로 실패해도 조용히 무시
    }
    setCustomLoading(false)
  }

  useEffect(() => {
    fetchWords()
    fetchCustomWords()
  }, [])

  const checkWord = async () => {
    const word = query.trim()
    if (!word) return
    setChecking(true)
    setLookup(null)
    setLookupError('')
    try {
      const res = await fetch(`/api/bubblechat/dictionary?word=${encodeURIComponent(word)}`)
      const data = await res.json()
      if (data.error) setLookupError(data.error)
      else setLookup(data)
    } catch (err) {
      setLookupError(String(err))
    }
    setChecking(false)
  }

  const addToDictionary = async (word: string) => {
    setAddStatus((s) => ({ ...s, [word]: 'adding' }))
    try {
      const res = await fetch('/api/bubblechat/dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (data.error) {
        setAddStatus((s) => ({ ...s, [word]: 'error' }))
        return
      }
      setAddStatus((s) => ({ ...s, [word]: data.added ? 'added' : 'exists' }))
      if (data.added) setCustomWords((list) => [...list, word])
    } catch {
      setAddStatus((s) => ({ ...s, [word]: 'error' }))
    }
  }

  const resolveWord = async (word: string) => {
    setResolving((s) => ({ ...s, [word]: true }))
    try {
      const res = await fetch('/api/bubblechat/unknown-words', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (!data.error) setWords((list) => list.filter((w) => w.word !== word))
    } finally {
      setResolving((s) => ({ ...s, [word]: false }))
    }
  }

  const deleteCustomWord = async (word: string) => {
    setCustomBusy((s) => ({ ...s, [word]: true }))
    try {
      const res = await fetch('/api/bubblechat/dictionary', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      const data = await res.json()
      if (!data.error && data.removed) {
        setCustomWords((list) => list.filter((w) => w !== word))
        setAddStatus((s) => {
          const next = { ...s }
          delete next[word]
          return next
        })
      }
    } finally {
      setCustomBusy((s) => ({ ...s, [word]: false }))
    }
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <h1 className="text-2xl font-bold">bubbleChat</h1>

      <section
        className="rounded-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        <h2 className="text-lg font-semibold mb-3">사전 조회</h2>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && checkWord()}
            placeholder="단어 입력"
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={checkWord}
            disabled={checking}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            조회
          </button>
        </div>
        {lookupError && <p className="text-sm mt-3" style={{ color: '#f87171' }}>{lookupError}</p>}
        {lookup && (
          <p className="text-sm mt-3">
            <strong>{lookup.word}</strong>{' '}
            {lookup.valid ? (
              <span style={{ color: '#4ade80' }}>사전에 있음</span>
            ) : (
              <span style={{ color: '#f87171' }}>사전에 없음</span>
            )}
          </p>
        )}
      </section>

      <section
        className="rounded-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">오타/미등록 단어 로그</h2>
          <button
            onClick={fetchWords}
            className="text-sm px-4 py-2 rounded-lg"
            style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
          >
            새로고침
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
        ) : error ? (
          <p style={{ color: '#f87171' }}>{error}</p>
        ) : words.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>(기록 없음)</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--muted)' }} className="text-left">
                <th className="pb-2 font-normal">단어</th>
                <th className="pb-2 font-normal">등장 횟수</th>
                <th className="pb-2 font-normal">마지막 등장</th>
                <th className="pb-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {words.map((w) => (
                <tr key={w.word} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td className="py-2">{w.word}</td>
                  <td className="py-2">{w.count}</td>
                  <td className="py-2" style={{ color: 'var(--muted)' }}>
                    {new Date(w.lastAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="py-2">
                    <div className="flex items-center justify-end gap-2">
                      {addStatus[w.word] === 'added' ? (
                        <span className="text-xs" style={{ color: '#4ade80' }}>추가됨</span>
                      ) : addStatus[w.word] === 'exists' ? (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>이미 있음</span>
                      ) : addStatus[w.word] === 'error' ? (
                        <span className="text-xs" style={{ color: '#f87171' }}>실패</span>
                      ) : (
                        <button
                          onClick={() => addToDictionary(w.word)}
                          disabled={addStatus[w.word] === 'adding'}
                          className="text-xs px-3 py-1 rounded-lg"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          사전에 추가
                        </button>
                      )}
                      <button
                        onClick={() => resolveWord(w.word)}
                        disabled={resolving[w.word]}
                        className="text-xs px-3 py-1 rounded-lg"
                        style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
                      >
                        해결
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section
        className="rounded-xl p-5"
        style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}
      >
        <h2 className="text-lg font-semibold mb-3">추가된 단어 목록</h2>
        {customLoading ? (
          <p style={{ color: 'var(--muted)' }}>로딩 중…</p>
        ) : customWords.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>(추가된 단어 없음)</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customWords.map((w) => (
              <div
                key={w}
                className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}
              >
                {w}
                <button
                  onClick={() => deleteCustomWord(w)}
                  disabled={customBusy[w]}
                  className="text-xs px-2 py-0.5 rounded-md"
                  style={{ background: '#7f1d1d', color: '#fca5a5' }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
