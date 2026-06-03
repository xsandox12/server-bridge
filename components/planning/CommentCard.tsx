"use client";

import { useState } from "react";
import type { Comment } from "@/lib/planning/types";

interface Props {
  comment: Comment;
  isActive: boolean;
  onClick: () => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}

export default function CommentCard({ comment, isActive, onClick, onResolve, onUnresolve, onEdit, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const isOpen = comment.status === "open";

  const bgColor = !isOpen
    ? "bg-gray-100 text-gray-700 border-gray-200"
    : isActive || expanded
    ? "bg-yellow-50 text-gray-900 border-yellow-300"
    : "bg-blue-50 text-gray-900 border-blue-200";

  const preview = comment.content.length > 60 ? comment.content.slice(0, 60) + "…" : comment.content;

  return (
    <div className={`rounded p-2 mb-2 border cursor-pointer text-xs ${bgColor}`}
      onClick={() => { if (!editing) { onClick(); setExpanded(v => !v); } }}>
      <p className="font-semibold mb-1 truncate text-gray-500">"{comment.selectedText}"</p>
      {editing ? (
        <div onClick={e => e.stopPropagation()}>
          <textarea autoFocus value={editContent} onChange={e => setEditContent(e.target.value)} rows={3}
            className="w-full p-1 border border-gray-300 rounded resize-none text-gray-900 bg-white" />
          <div className="flex gap-1 mt-1">
            <button onClick={e => { e.stopPropagation(); onEdit(comment.id, editContent.trim()); setEditing(false); }}
              className="px-2 py-0.5 bg-blue-600 text-white rounded">저장</button>
            <button onClick={e => { e.stopPropagation(); setEditing(false); setEditContent(comment.content); }}
              className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">취소</button>
          </div>
        </div>
      ) : expanded ? (
        <>
          <p className="whitespace-pre-wrap leading-relaxed text-gray-900">{comment.content}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            <button onClick={e => { e.stopPropagation(); setEditing(true); }} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded">수정</button>
            {isOpen
              ? <button onClick={e => { e.stopPropagation(); onResolve(comment.id); }} className="px-2 py-0.5 bg-green-600 text-white rounded">해결됨</button>
              : <button onClick={e => { e.stopPropagation(); onUnresolve(comment.id); }} className="px-2 py-0.5 bg-blue-600 text-white rounded">미해결로 변경</button>
            }
            <button onClick={e => { e.stopPropagation(); onDelete(comment.id); }} className="px-2 py-0.5 bg-red-600 text-white rounded">삭제</button>
          </div>
        </>
      ) : (
        <p className="leading-relaxed text-gray-900">{preview}</p>
      )}
    </div>
  );
}
