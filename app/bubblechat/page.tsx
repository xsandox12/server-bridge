'use client'

import { useEffect, useState } from 'react'

type WordEntry = { word: string; count: number; lastAt: string }

export default function BubbleChatPage() {
  const [words, setWords] = useState<WordEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    fetchWords()
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
