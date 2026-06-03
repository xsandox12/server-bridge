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
          <h2 className="font-semibold text-gray-300 mb-2">{cat.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {cat.documents.map(docRef => (
              <button key={docRef.id} onClick={() => router.push(`/planning/document/${docRef.id}`)}
                className="p-4 bg-white/5 border border-white/10 rounded hover:bg-white/10 text-left text-sm text-gray-200">
                {docRef.name}
              </button>
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
