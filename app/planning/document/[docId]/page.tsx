"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PlanDocument, Comment, Block } from "@/lib/planning/types";
import EditorContent from "@/components/planning/EditorContent";
import CommentsPanel from "@/components/planning/CommentsPanel";
import VersionPanel from "@/components/planning/VersionPanel";

interface PendingSelection {
  blockId: string; selectedText: string; startOffset: number; endOffset: number;
}

export default function PlanDocumentPage() {
  const { docId } = useParams<{ docId: string }>();
  const router = useRouter();

  const [doc, setDoc] = useState<PlanDocument | null>(null);
  const [rightMode, setRightMode] = useState<"comments" | "versions">("comments");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [saveModal, setSaveModal] = useState(false);
  const [saveChanges, setSaveChanges] = useState("");
  const [previewVersion, setPreviewVersion] = useState<string | null>(null);
  const [previewComments, setPreviewComments] = useState<Comment[] | null>(null);

  const loadDoc = useCallback(async () => {
    const res = await fetch(`/api/planning/documents/${docId}`);
    if (!res.ok) return;
    setDoc(await res.json());
  }, [docId]);

  useEffect(() => { loadDoc(); }, [loadDoc]);

  const currentVer = doc ? doc.versions[doc.currentVersion] : null;
  const isPreview = previewVersion !== null;
  const blocks: Block[] = isPreview ? (doc?.versions[previewVersion]?.blocks ?? []) : (currentVer?.blocks ?? []);
  const comments: Comment[] = isPreview ? (previewComments ?? []) : (currentVer?.comments ?? []);

  function handleSetPreviewVersion(version: string | null) {
    setPreviewVersion(version);
    if (version !== null && doc) {
      setPreviewComments(JSON.parse(JSON.stringify(doc.versions[version].comments)));
    } else {
      setPreviewComments(null);
    }
  }

  async function handleTextSelect(blockId: string, selectedText: string, startOffset: number, endOffset: number) {
    setPendingSelection({ blockId, selectedText, startOffset, endOffset });
    setRightMode("comments");
  }

  async function handleAddComment(content: string) {
    if (!pendingSelection) return;
    const newComment: Comment = {
      id: Math.random().toString(36).slice(2), blockId: pendingSelection.blockId,
      selectedText: pendingSelection.selectedText, startOffset: pendingSelection.startOffset,
      endOffset: pendingSelection.endOffset, content, status: "open", createdAt: new Date().toISOString(),
    };
    if (isPreview) { setPreviewComments(prev => [...(prev ?? []), newComment]); setPendingSelection(null); return; }
    await fetch(`/api/planning/documents/${docId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: [...comments, newComment] }),
    });
    setPendingSelection(null); loadDoc();
  }

  async function updateComments(updated: Comment[]) {
    if (isPreview) { setPreviewComments(updated); return; }
    await fetch(`/api/planning/documents/${docId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: updated }),
    });
    loadDoc();
  }

  const handleResolve = (id: string) => updateComments(comments.map(c => c.id === id ? { ...c, status: "resolved" as const } : c));
  const handleUnresolve = (id: string) => updateComments(comments.map(c => c.id === id ? { ...c, status: "open" as const } : c));
  const handleEdit = (id: string, content: string) => { if (!content) return; updateComments(comments.map(c => c.id === id ? { ...c, content } : c)); };
  const handleDelete = (id: string) => updateComments(comments.filter(c => c.id !== id));

  async function handleSave() {
    const changes = saveChanges.trim() ? saveChanges.split("\n").map(s => s.trim()).filter(Boolean) : ["저장"];
    const body: { changes: string[]; blocks?: Block[]; comments?: Comment[] } = { changes };
    if (isPreview && previewVersion && doc) {
      body.blocks = doc.versions[previewVersion].blocks;
      body.comments = previewComments ?? [];
    }
    await fetch(`/api/planning/documents/${docId}/save`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaveModal(false); setSaveChanges("");
    if (isPreview) { setPreviewVersion(null); setPreviewComments(null); }
    loadDoc();
  }

  if (!doc) return <div className="text-gray-400">로딩 중...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] -m-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => router.push(`/planning/project/${doc.projectId}`)} className="text-blue-400 hover:underline">← 프로젝트</button>
          <span className="text-gray-500">›</span>
          <span className="font-medium text-white">{doc.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Ver.{isPreview ? previewVersion : doc.currentVersion}</span>
          <button onClick={() => setRightMode(m => m === "versions" ? "comments" : "versions")}
            className={`text-xs px-3 py-1 rounded border ${rightMode === "versions" ? "bg-white text-gray-900 border-white" : "border-white/30 text-gray-300 hover:bg-white/10"}`}>
            버전 관리
          </button>
          <button onClick={() => setSaveModal(true)} className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1">
            <span>💾</span><span>저장</span>
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-2 bg-white">
          <EditorContent blocks={blocks} comments={comments} onTextSelect={handleTextSelect} onCommentClick={setActiveCommentId} />
        </div>
        <div className="w-72 shrink-0 bg-gray-50 border-l border-gray-200 overflow-hidden flex flex-col">
          {rightMode === "comments"
            ? <CommentsPanel comments={comments} activeCommentId={activeCommentId} onCommentClick={setActiveCommentId}
                onResolve={handleResolve} onUnresolve={handleUnresolve} onEdit={handleEdit} onDelete={handleDelete}
                onAddComment={handleAddComment} pendingSelection={pendingSelection} />
            : <VersionPanel doc={doc} previewVersion={previewVersion} onPreviewVersion={handleSetPreviewVersion} />
          }
        </div>
      </div>

      {/* 저장 모달 */}
      {saveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h2 className="text-base font-semibold mb-3 text-gray-900">
              {isPreview ? `ver.${previewVersion} 기반으로 저장` : "새 버전으로 저장"}
            </h2>
            <p className="text-xs text-gray-500 mb-2">수정 내역 (줄바꿈으로 구분)</p>
            <textarea autoFocus value={saveChanges} onChange={e => setSaveChanges(e.target.value)}
              rows={4} placeholder={"수정내역1\n수정내역2"}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm mb-4 resize-none text-gray-900" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSaveModal(false)} className="px-4 py-2 bg-gray-100 text-sm rounded">취소</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white text-sm rounded">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
