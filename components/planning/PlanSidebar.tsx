"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { PlanProject } from "@/lib/planning/types";

type MenuState = {
  id: string;
  type: "project" | "category" | "document";
  projectId: string;
  catId?: string;
} | null;

type AddingState = {
  type: "project" | "category" | "document";
  projectId?: string;
  catId?: string;
} | null;

type RenamingState = {
  id: string;
  type: "project" | "category" | "document";
  projectId?: string;
  catId?: string;
} | null;

export default function PlanSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [projects, setProjects] = useState<PlanProject[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<MenuState>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState<AddingState>(null);
  const [addName, setAddName] = useState("");
  const [renaming, setRenaming] = useState<RenamingState>(null);
  const [renameName, setRenameName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const activeDocId = pathname.match(/\/planning\/document\/([^/]+)/)?.[1] ?? null;

  const load = useCallback(async () => {
    const res = await fetch("/api/planning/projects");
    setProjects(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!activeDocId || projects.length === 0) return;
    for (const p of projects) {
      for (const c of p.categories) {
        if (c.documents.some(d => d.id === activeDocId)) {
          setExpanded(prev => ({ ...prev, [p.id]: true, [c.id]: true }));
          return;
        }
      }
    }
  }, [activeDocId, projects]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && e.composedPath().includes(menuRef.current)) return;
      setMenu(null); setMenuPos(null); setConfirmDelete(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [!!menu]);

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function openMenu(e: React.MouseEvent, state: MenuState) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPos({ x: rect.left, y: rect.bottom + 2 });
    setMenu(state);
    setConfirmDelete(false);
  }

  function startAdding(e: React.MouseEvent, state: AddingState, expandId?: string) {
    e.stopPropagation();
    if (expandId) setExpanded(prev => ({ ...prev, [expandId]: true }));
    setAdding(state);
    setAddName("");
  }

  function startRename() {
    if (!menu) return;
    let currentName = "";
    if (menu.type === "project") {
      currentName = projects.find(p => p.id === menu.id)?.name ?? "";
    } else if (menu.type === "category") {
      for (const p of projects) {
        const c = p.categories.find(c => c.id === menu.id);
        if (c) { currentName = c.name; break; }
      }
    } else {
      for (const p of projects) {
        for (const c of p.categories) {
          const d = c.documents.find(d => d.id === menu.id);
          if (d) { currentName = d.name; break; }
        }
      }
    }
    setRenaming({ id: menu.id, type: menu.type, projectId: menu.projectId, catId: menu.catId });
    setRenameName(currentName);
    setMenu(null); setMenuPos(null); setConfirmDelete(false);
  }

  async function submitRename() {
    if (!renaming) return;
    if (!renameName.trim()) { setRenaming(null); return; }
    const name = renameName.trim();
    if (renaming.type === "project") {
      await fetch(`/api/planning/projects/${renaming.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } else if (renaming.type === "category") {
      await fetch(`/api/planning/projects/${renaming.projectId}/categories/${renaming.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    } else {
      await fetch(`/api/planning/documents/${renaming.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
    setRenaming(null); load();
  }

  async function submitAdd() {
    if (!addName.trim() || !adding) return;
    if (adding.type === "project") {
      await fetch("/api/planning/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "project", name: addName.trim() }),
      });
      setAdding(null); setAddName(""); load();
    } else if (adding.type === "category") {
      await fetch("/api/planning/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "category", projectId: adding.projectId, name: addName.trim() }),
      });
      setAdding(null); setAddName(""); load();
    } else if (adding.type === "document") {
      const res = await fetch("/api/planning/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: adding.projectId, categoryId: adding.catId, name: addName.trim() }),
      });
      const doc = await res.json();
      setAdding(null); setAddName(""); load();
      router.push(`/planning/document/${doc.id}`);
    }
  }

  async function handleDelete() {
    if (!menu) return;
    if (menu.type === "project") {
      await fetch(`/api/planning/projects/${menu.id}`, { method: "DELETE" });
    } else if (menu.type === "category") {
      await fetch(`/api/planning/projects/${menu.projectId}/categories/${menu.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/planning/documents/${menu.id}`, { method: "DELETE" });
      if (activeDocId === menu.id) router.push("/planning");
    }
    setMenu(null); setMenuPos(null); setConfirmDelete(false); load();
  }

  const inputCls = "w-full bg-white/10 border border-blue-500/50 rounded px-2 py-0.5 text-xs text-white outline-none";
  const renameInputCls = "flex-1 min-w-0 bg-white/10 border border-blue-500/50 rounded px-1 py-0 text-xs text-white outline-none";

  return (
    <div className="w-60 shrink-0 bg-[#1a1a1a] border-r border-white/10 flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-white/10 shrink-0">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">기획서</span>
      </div>

      <div className="flex-1 overflow-y-auto py-1 text-sm">
        {projects.map(project => (
          <div key={project.id}>
            {/* 프로젝트 행 */}
            <div
              className="group flex items-center gap-1 px-2 py-1 rounded mx-1 hover:bg-white/5 cursor-pointer select-none"
              onClick={() => renaming?.id !== project.id && toggle(project.id)}
            >
              <span className="text-gray-600 text-[10px] w-3 shrink-0 text-center">
                {expanded[project.id] ? "▼" : "▶"}
              </span>
              {renaming?.id === project.id ? (
                <input
                  autoFocus
                  value={renameName}
                  onChange={e => setRenameName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(null); }}
                  onBlur={submitRename}
                  onClick={e => e.stopPropagation()}
                  className={renameInputCls}
                />
              ) : (
                <>
                  <span className="flex-1 text-gray-200 font-medium truncate">{project.name}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      title="카테고리 추가"
                      onClick={e => startAdding(e, { type: "category", projectId: project.id }, project.id)}
                      className="text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded px-1 py-0.5 text-xs leading-none"
                    >+</button>
                    <button
                      title="더보기"
                      onClick={e => openMenu(e, { id: project.id, type: "project", projectId: project.id })}
                      className="text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded px-1 py-0.5 text-xs leading-none"
                    >···</button>
                  </div>
                </>
              )}
            </div>

            {expanded[project.id] && (
              <div>
                {project.categories.map(cat => (
                  <div key={cat.id}>
                    {/* 카테고리 행 */}
                    <div
                      className="group flex items-center gap-1 pl-5 pr-2 py-0.5 rounded mx-1 hover:bg-white/5 cursor-pointer select-none"
                      onClick={() => renaming?.id !== cat.id && toggle(cat.id)}
                    >
                      <span className="text-gray-600 text-[10px] w-3 shrink-0 text-center">
                        {expanded[cat.id] ? "▼" : "▶"}
                      </span>
                      {renaming?.id === cat.id ? (
                        <input
                          autoFocus
                          value={renameName}
                          onChange={e => setRenameName(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(null); }}
                          onBlur={submitRename}
                          onClick={e => e.stopPropagation()}
                          className={renameInputCls}
                        />
                      ) : (
                        <>
                          <span className="flex-1 text-gray-400 truncate">{cat.name}</span>
                          <div className="hidden group-hover:flex items-center gap-0.5">
                            <button
                              title="기획서 추가"
                              onClick={e => startAdding(e, { type: "document", projectId: project.id, catId: cat.id }, cat.id)}
                              className="text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded px-1 py-0.5 text-xs leading-none"
                            >+</button>
                            <button
                              title="더보기"
                              onClick={e => openMenu(e, { id: cat.id, type: "category", projectId: project.id, catId: cat.id })}
                              className="text-gray-500 hover:text-gray-200 hover:bg-white/10 rounded px-1 py-0.5 text-xs leading-none"
                            >···</button>
                          </div>
                        </>
                      )}
                    </div>

                    {expanded[cat.id] && (
                      <div>
                        {cat.documents.map(doc => (
                          <div
                            key={doc.id}
                            className={`group flex items-center gap-1.5 pl-10 pr-2 py-0.5 rounded mx-1 cursor-pointer select-none ${
                              activeDocId === doc.id
                                ? "bg-white/10 text-white"
                                : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                            }`}
                            onClick={() => renaming?.id !== doc.id && router.push(`/planning/document/${doc.id}`)}
                          >
                            <span className="text-[10px] shrink-0">📄</span>
                            {renaming?.id === doc.id ? (
                              <input
                                autoFocus
                                value={renameName}
                                onChange={e => setRenameName(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(null); }}
                                onBlur={submitRename}
                                onClick={e => e.stopPropagation()}
                                className={renameInputCls}
                              />
                            ) : (
                              <>
                                <span className="flex-1 truncate">{doc.name}</span>
                                <button
                                  title="더보기"
                                  onClick={e => openMenu(e, { id: doc.id, type: "document", projectId: project.id, catId: cat.id })}
                                  className="hidden group-hover:block text-gray-600 hover:text-gray-300 hover:bg-white/10 rounded px-1 py-0.5 text-xs leading-none"
                                >···</button>
                              </>
                            )}
                          </div>
                        ))}
                        {adding?.type === "document" && adding.catId === cat.id && (
                          <div className="pl-10 pr-2 py-0.5">
                            <input
                              autoFocus value={addName}
                              onChange={e => setAddName(e.target.value)}
                              onKeyDown={e => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(null); }}
                              placeholder="기획서 이름" className={inputCls}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {adding?.type === "category" && adding.projectId === project.id && (
                  <div className="pl-5 pr-2 py-0.5">
                    <input
                      autoFocus value={addName}
                      onChange={e => setAddName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(null); }}
                      placeholder="카테고리 이름" className={inputCls}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {adding?.type === "project" ? (
          <div className="px-2 py-0.5 mt-1">
            <input
              autoFocus value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitAdd(); if (e.key === "Escape") setAdding(null); }}
              placeholder="프로젝트 이름" className={inputCls}
            />
          </div>
        ) : (
          <button
            onClick={e => startAdding(e, { type: "project" })}
            className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:text-gray-400 hover:bg-white/5 mt-0.5"
          >
            + 새 프로젝트
          </button>
        )}
      </div>

      {/* 컨텍스트 메뉴 */}
      {menu && menuPos && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-[#2a2a2a] border border-white/15 rounded-md shadow-xl text-xs py-1 min-w-[130px]"
          style={{ top: menuPos.y, left: menuPos.x }}
        >
          {confirmDelete ? (
            <div className="px-3 py-1.5 flex items-center gap-2 whitespace-nowrap">
              <span className="text-gray-300">삭제할까요?</span>
              <button onClick={handleDelete} className="text-red-400 hover:text-red-300 font-medium">예</button>
              <button onClick={() => setConfirmDelete(false)} className="text-gray-500 hover:text-gray-300">취소</button>
            </div>
          ) : (
            <>
              <button
                onClick={startRename}
                className="w-full text-left px-3 py-1.5 text-gray-300 hover:bg-white/10"
              >이름 변경</button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-white/10"
              >삭제</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
