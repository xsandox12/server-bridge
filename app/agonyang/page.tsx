'use client'

import { useEffect, useState, useCallback } from 'react'

type Banner = {
  id: string
  category_id: string
  title: string
  description: string | null
  image_url: string | null
  link_url: string
  icon: string | null
  accent_color: string | null
  meta: string | null
  is_live: number
  open_in_new_tab: number
  is_active: number
  sort_order: number
}

type Category = {
  id: string
  name: string
  cols: number
  sort_order: number
  banners: Banner[]
}

type BannerFormState = {
  title: string
  description: string
  link_url: string
  icon: string
  accent_color: string
  meta: string
  is_live: boolean
  open_in_new_tab: boolean
  image_url: string
}

const EMPTY_FORM: BannerFormState = {
  title: '', description: '', link_url: '', icon: '', accent_color: '#4da6ff', meta: '', is_live: false, open_in_new_tab: false, image_url: '',
}

const card: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }
const input: React.CSSProperties = { background: 'var(--card)', border: '1px solid var(--card-border)' }

export default function AgonyangPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [openFormFor, setOpenFormFor] = useState<string | null>(null)
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null)
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM)
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agonyang/categories')
      if (!res.ok) throw new Error('불러오기 실패')
      setCategories(await res.json())
      setError('')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addCategory() {
    if (!newCategoryName.trim()) return
    await fetch('/api/agonyang/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    })
    setNewCategoryName('')
    load()
  }

  async function renameCategory(id: string) {
    if (!editingCategoryName.trim()) return
    await fetch(`/api/agonyang/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editingCategoryName.trim() }),
    })
    setEditingCategoryId(null)
    load()
  }

  async function changeCols(id: string, cols: number) {
    await fetch(`/api/agonyang/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols }),
    })
    load()
  }

  async function deleteCategory(id: string) {
    if (!confirm('카테고리를 삭제하면 하위 배너도 모두 삭제됩니다. 계속할까요?')) return
    await fetch(`/api/agonyang/categories/${id}`, { method: 'DELETE' })
    load()
  }

  async function moveCategory(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= categories.length) return
    const order = categories.map((c) => c.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    await fetch('/api/agonyang/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
    load()
  }

  function startAddBanner(categoryId: string) {
    setOpenFormFor(categoryId)
    setEditingBannerId(null)
    setForm(EMPTY_FORM)
    setImageMode('upload')
  }

  function startEditBanner(banner: Banner) {
    setOpenFormFor(banner.category_id)
    setEditingBannerId(banner.id)
    setForm({
      title: banner.title,
      description: banner.description ?? '',
      link_url: banner.link_url,
      icon: banner.icon ?? '',
      accent_color: banner.accent_color ?? '#4da6ff',
      meta: banner.meta ?? '',
      is_live: !!banner.is_live,
      open_in_new_tab: !!banner.open_in_new_tab,
      image_url: banner.image_url ?? '',
    })
    setImageMode('url')
  }

  function closeForm() {
    setOpenFormFor(null)
    setEditingBannerId(null)
    setForm(EMPTY_FORM)
  }

  async function saveBanner() {
    if (!form.title.trim() || !form.link_url.trim()) {
      alert('제목과 링크는 필수입니다.')
      return
    }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      link_url: form.link_url.trim(),
      icon: form.icon.trim() || null,
      accent_color: form.accent_color || null,
      meta: form.meta.trim() || null,
      is_live: form.is_live,
      open_in_new_tab: form.open_in_new_tab,
      image_url: form.image_url || null,
    }
    if (editingBannerId) {
      await fetch(`/api/agonyang/banners/${editingBannerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } else {
      await fetch('/api/agonyang/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, category_id: openFormFor }),
      })
    }
    closeForm()
    load()
  }

  async function deleteBanner(id: string) {
    if (!confirm('배너를 삭제할까요?')) return
    await fetch(`/api/agonyang/banners/${id}`, { method: 'DELETE' })
    load()
  }

  async function toggleActive(banner: Banner) {
    await fetch(`/api/agonyang/banners/${banner.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !banner.is_active }),
    })
    load()
  }

  async function moveBanner(category: Category, index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= category.banners.length) return
    const order = category.banners.map((b) => b.id)
    ;[order[index], order[target]] = [order[target], order[index]]
    await fetch('/api/agonyang/banners/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: category.id, order }),
    })
    load()
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/agonyang/uploads', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      setForm((f) => ({ ...f, image_url: data.url }))
    } catch (err) {
      alert(String(err))
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="text-sm" style={{ color: 'var(--muted)' }}>불러오는 중...</div>
  if (error) return <div className="text-sm text-red-400">{error}</div>

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">아고냥 메인 페이지</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>agonyang.com에 노출되는 카테고리와 배너를 관리합니다.</p>
      </div>

      <div className="flex flex-col gap-6">
        {categories.map((cat, catIndex) => (
          <div key={cat.id} className="rounded-lg p-4" style={card}>
            <div className="flex items-center gap-2 mb-4">
              {editingCategoryId === cat.id ? (
                <>
                  <input
                    autoFocus
                    className="text-lg font-bold px-2 py-1 rounded"
                    style={input}
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && renameCategory(cat.id)}
                  />
                  <button className="text-xs px-2 py-1 rounded" style={{ background: 'var(--accent)', color: '#fff' }} onClick={() => renameCategory(cat.id)}>저장</button>
                  <button className="text-xs px-2 py-1" onClick={() => setEditingCategoryId(null)}>취소</button>
                </>
              ) : (
                <h2
                  className="text-lg font-bold cursor-pointer"
                  onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}
                  title="클릭해서 이름 수정"
                >
                  {cat.name}
                </h2>
              )}

              <div className="flex-1" />

              <label className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                컬럼
                <select
                  value={cat.cols}
                  onChange={(e) => changeCols(cat.id, Number(e.target.value))}
                  className="text-xs rounded px-1 py-0.5"
                  style={input}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <button className="text-xs px-1" disabled={catIndex === 0} onClick={() => moveCategory(catIndex, -1)}>▲</button>
              <button className="text-xs px-1" disabled={catIndex === categories.length - 1} onClick={() => moveCategory(catIndex, 1)}>▼</button>
              <button className="text-xs px-2 text-red-400" onClick={() => deleteCategory(cat.id)}>삭제</button>
            </div>

            <div className="flex flex-col gap-2">
              {cat.banners.map((banner, bIndex) => (
                <div key={banner.id}>
                  <div className="flex items-center gap-3 p-2 rounded" style={{ background: 'var(--background)' }}>
                    <div
                      className="w-12 h-12 rounded flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={{ background: banner.accent_color ?? 'var(--card-border)' }}
                    >
                      {banner.image_url
                        ? <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                        : <span className="text-sm font-bold text-white">{banner.icon ?? banner.title[0]}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{banner.title}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{banner.description}</div>
                    </div>
                    <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={!!banner.is_active} onChange={() => toggleActive(banner)} />
                      노출
                    </label>
                    <button className="text-xs px-1" disabled={bIndex === 0} onClick={() => moveBanner(cat, bIndex, -1)}>▲</button>
                    <button className="text-xs px-1" disabled={bIndex === cat.banners.length - 1} onClick={() => moveBanner(cat, bIndex, 1)}>▼</button>
                    <button className="text-xs px-2" onClick={() => startEditBanner(banner)}>편집</button>
                    <button className="text-xs px-2 text-red-400" onClick={() => deleteBanner(banner.id)}>삭제</button>
                  </div>

                  {editingBannerId === banner.id && openFormFor === cat.id && (
                    <BannerForm
                      form={form}
                      setForm={setForm}
                      imageMode={imageMode}
                      setImageMode={setImageMode}
                      uploading={uploading}
                      onUpload={handleFileUpload}
                      onSave={saveBanner}
                      onCancel={closeForm}
                    />
                  )}
                </div>
              ))}

              {cat.banners.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--muted)' }}>배너가 없습니다.</div>
              )}
            </div>

            {openFormFor === cat.id && editingBannerId === null ? (
              <BannerForm
                form={form}
                setForm={setForm}
                imageMode={imageMode}
                setImageMode={setImageMode}
                uploading={uploading}
                onUpload={handleFileUpload}
                onSave={saveBanner}
                onCancel={closeForm}
              />
            ) : (
              <button
                className="mt-3 text-xs px-3 py-1.5 rounded"
                style={{ border: '1px solid var(--card-border)' }}
                onClick={() => startAddBanner(cat.id)}
              >
                + 배너 추가
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          placeholder="새 카테고리 이름"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
          className="text-sm px-3 py-1.5 rounded flex-1"
          style={card}
        />
        <button
          className="text-sm px-3 py-1.5 rounded"
          style={{ background: 'var(--accent)', color: '#fff' }}
          onClick={addCategory}
        >
          + 카테고리 추가
        </button>
      </div>
    </div>
  )
}

function BannerForm({
  form, setForm, imageMode, setImageMode, uploading, onUpload, onSave, onCancel,
}: {
  form: BannerFormState
  setForm: React.Dispatch<React.SetStateAction<BannerFormState>>
  imageMode: 'upload' | 'url'
  setImageMode: (m: 'upload' | 'url') => void
  uploading: boolean
  onUpload: (file: File) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-2 p-3 rounded flex flex-col gap-2" style={{ background: 'var(--background)', border: '1px solid var(--card-border)' }}>
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="제목 *"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className="text-sm px-2 py-1 rounded"
          style={input}
        />
        <input
          placeholder="링크 URL *"
          value={form.link_url}
          onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
          className="text-sm px-2 py-1 rounded"
          style={input}
        />
      </div>
      <textarea
        placeholder="설명"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        rows={2}
        className="text-sm px-2 py-1 rounded"
        style={input}
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          placeholder="아이콘 글자 (예: 분)"
          value={form.icon}
          onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          maxLength={2}
          className="text-sm px-2 py-1 rounded"
          style={input}
        />
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.accent_color}
            onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
            className="w-8 h-8 rounded"
          />
          <span className="text-xs" style={{ color: 'var(--muted)' }}>강조색</span>
        </div>
        <input
          placeholder="메타 텍스트 (예: 리포트 12개)"
          value={form.meta}
          onChange={(e) => setForm((f) => ({ ...f, meta: e.target.value }))}
          className="text-sm px-2 py-1 rounded"
          style={input}
        />
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--muted)' }}>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={form.is_live} onChange={(e) => setForm((f) => ({ ...f, is_live: e.target.checked }))} />
          지금 라이브
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={form.open_in_new_tab} onChange={(e) => setForm((f) => ({ ...f, open_in_new_tab: e.target.checked }))} />
          새 탭에서 열기
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1 text-xs">
          <button
            className="px-2 py-0.5 rounded"
            style={{ background: imageMode === 'upload' ? 'var(--accent)' : 'transparent', color: imageMode === 'upload' ? '#fff' : 'inherit', border: '1px solid var(--card-border)' }}
            onClick={() => setImageMode('upload')}
          >
            업로드
          </button>
          <button
            className="px-2 py-0.5 rounded"
            style={{ background: imageMode === 'url' ? 'var(--accent)' : 'transparent', color: imageMode === 'url' ? '#fff' : 'inherit', border: '1px solid var(--card-border)' }}
            onClick={() => setImageMode('url')}
          >
            URL
          </button>
        </div>
        {imageMode === 'upload' ? (
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
            className="text-xs"
          />
        ) : (
          <input
            placeholder="이미지 URL"
            value={form.image_url}
            onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            className="text-sm px-2 py-1 rounded flex-1"
            style={input}
          />
        )}
        {uploading && <span className="text-xs" style={{ color: 'var(--muted)' }}>업로드 중...</span>}
        {form.image_url && <img src={form.image_url} alt="미리보기" className="w-8 h-8 rounded object-cover" />}
      </div>

      <div className="flex gap-2 mt-1">
        <button className="text-xs px-3 py-1 rounded" style={{ background: 'var(--accent)', color: '#fff' }} onClick={onSave}>저장</button>
        <button className="text-xs px-3 py-1" onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}
