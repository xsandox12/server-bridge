"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { PlanProject } from "@/lib/planning/types";

export default function PlanProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<PlanProject | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [catName, setCatName] = useState("");
  const [addingDoc, setAddingDoc] = useState<string | null>(null);
  const [docName, setDocName] = useState("");
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState<string | null>(null);
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/planning/projects");
    const projects: PlanProject[] = await res.json();
    setProject(projects.find(p => p.id === projectId) ?? null);
  }

  useEffect(() => { load(); }, [projectId]);

  async function createCategory() {
    if (!catName.trim()) return;
    await fetch("/api/planning/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", projectId, name: catName.trim() }),
    });
    setCatName(""); setAddingCat(false); load();
  }

  async function deleteCat(catId: string) {
    await fetch(`/api/planning/projects/${projectId}/categories/${catId}`, { method: "DELETE" });
    setConfirmDeleteCat(null);
    load();
  }

  async function deleteDoc(docId: string) {
    await fetch(`/api/planning/documents/${docId}`, { method: "DELETE" });
    setConfirmDeleteDoc(null);
    load();
  }

  async function createDocument(categoryId: string) {
    if (!docName.trim()) return;
    const res = await fetch("/api/planning/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, categoryId, name: docName.trim() }),
    });
    const doc = await res.json();
    setDocName(""); setAddingDoc(null);
    router.push(`/planning/document/${doc.id}`);
  }

  if (!project) return <div className="text-gray-400">로딩 중...</div>;

  return (
    <div>
      <button onClick={() => router.push("/planning")} className="text-sm text-blue-400 hover:underline mb-4 block">← 기획서 목록</button>
      <h1 className="text-xl font-bold mb-5 text-white">{project.name}</h1>

      {project.categories.map(cat => (
        <div key={cat.id} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-semibold text-gray-300">{cat.name}</h2>
            {confirmDeleteCat === cat.id ? (
              <span className="flex items-center gap-1 text-xs">
                <span className="text-gray-400">삭제?</span>
                <button onClick={() => deleteCat(cat.id)} className="text-red-400 hover:text-red-300 px-1">예</button>
                <button onClick={() => setConfirmDeleteCat(null)} className="text-gray-400 hover:text-gray-200 px-1">취소</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDeleteCat(cat.id)} className="text-gray-600 hover:text-red-400 text-sm leading-none">×</button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cat.documents.map(docRef => (
              <div key={docRef.id} className="relative group">
                <button onClick={() => router.push(`/planning/document/${docRef.id}`)}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded hover:bg-white/10 text-left text-sm text-gray-200">
                  {docRef.name}
                </button>
                {confirmDeleteDoc === docRef.id ? (
                  <div className="absolute top-1 right-1 flex items-center gap-1 bg-gray-900 border border-red-500/50 rounded px-2 py-1">
                    <span className="text-xs text-gray-300">삭제?</span>
                    <button onClick={() => deleteDoc(docRef.id)} className="text-xs text-red-400 hover:text-red-300 px-1">예</button>
                    <button onClick={() => setConfirmDeleteDoc(null)} className="text-xs text-gray-400 hover:text-gray-200 px-1">취소</button>
                  </div>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteDoc(docRef.id); }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-lg leading-none px-1">
                    ×
                  </button>
                )}
              </div>
            ))}
            {addingDoc === cat.id ? (
              <div className="p-4 bg-white/5 border border-blue-500/50 rounded">
                <input autoFocus value={docName} onChange={e => setDocName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createDocument(cat.id)}
                  placeholder="기획서 이름" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white mb-2" />
                <div className="flex gap-2">
                  <button onClick={() => createDocument(cat.id)} className="px-2 py-1 bg-blue-600 text-white text-xs rounded">확인</button>
                  <button onClick={() => setAddingDoc(null)} className="px-2 py-1 bg-white/10 text-xs rounded text-gray-300">취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingDoc(cat.id)}
                className="p-4 border border-dashed border-white/20 rounded text-gray-400 hover:text-gray-200 text-sm">
                + 기획서 추가
              </button>
            )}
          </div>
        </div>
      ))}

      {addingCat ? (
        <div className="flex gap-2 mt-4">
          <input autoFocus value={catName} onChange={e => setCatName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && createCategory()}
            placeholder="카테고리 이름" className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white" />
          <button onClick={createCategory} className="px-3 py-1 bg-blue-600 text-white text-sm rounded">확인</button>
          <button onClick={() => setAddingCat(false)} className="px-3 py-1 bg-white/10 text-sm rounded text-gray-300">취소</button>
        </div>
      ) : (
        <button onClick={() => setAddingCat(true)} className="mt-4 text-sm text-gray-400 hover:text-gray-200">
          + 카테고리 추가
        </button>
      )}
    </div>
  );
}
