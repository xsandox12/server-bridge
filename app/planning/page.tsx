"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanProject } from "@/lib/planning/types";

export default function PlanningPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PlanProject[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/planning/projects");
    setProjects(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function deleteProject(id: string) {
    await fetch(`/api/planning/projects/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    load();
  }

  async function createProject() {
    if (!name.trim()) return;
    await fetch("/api/planning/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "project", name: name.trim() }),
    });
    setName(""); setAdding(false); load();
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4 text-white">기획서 관리</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {projects.map(p => (
          <div key={p.id} className="relative group">
            <button onClick={() => router.push(`/planning/project/${p.id}`)}
              className="w-full p-5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 text-left">
              <h2 className="font-semibold text-white">{p.name}</h2>
              <p className="text-xs text-gray-400 mt-1">
                카테고리 {p.categories.length}개 · {p.categories.reduce((n, c) => n + c.documents.length, 0)}개 문서
              </p>
            </button>
            {confirmDelete === p.id ? (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-gray-900 border border-red-500/50 rounded px-2 py-1">
                <span className="text-xs text-gray-300">삭제?</span>
                <button onClick={() => deleteProject(p.id)} className="text-xs text-red-400 hover:text-red-300 px-1">예</button>
                <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-400 hover:text-gray-200 px-1">취소</button>
              </div>
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(p.id); }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-lg leading-none px-1">
                ×
              </button>
            )}
          </div>
        ))}
        {adding ? (
          <div className="p-5 bg-white/5 border border-blue-500/50 rounded-lg">
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createProject()}
              placeholder="프로젝트 이름" className="w-full bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white mb-2" />
            <div className="flex gap-2">
              <button onClick={createProject} className="px-3 py-1 bg-blue-600 text-white text-sm rounded">확인</button>
              <button onClick={() => setAdding(false)} className="px-3 py-1 bg-white/10 text-sm rounded text-gray-300">취소</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="p-5 border border-dashed border-white/20 rounded-lg text-gray-400 hover:text-gray-200 hover:border-white/40">
            + 프로젝트 추가
          </button>
        )}
      </div>
    </div>
  );
}
