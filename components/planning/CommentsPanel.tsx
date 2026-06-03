"use client";

import { useState } from "react";
import type { Comment } from "@/lib/planning/types";
import CommentCard from "./CommentCard";

interface PendingSelection { selectedText: string; }

interface Props {
  comments: Comment[];
  activeCommentId: string | null;
  onCommentClick: (id: string) => void;
  onResolve: (id: string) => void;
  onUnresolve: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onAddComment: (content: string) => void;
  pendingSelection: PendingSelection | null;
}

export default function CommentsPanel({ comments, activeCommentId, onCommentClick, onResolve, onUnresolve, onEdit, onDelete, onAddComment, pendingSelection }: Props) {
  const [newContent, setNewContent] = useState("");

  function handleSubmit() {
    if (!newContent.trim()) return;
    onAddComment(newContent.trim());
    setNewContent("");
  }

  const open = comments.filter(c => c.status === "open");
  const resolved = comments.filter(c => c.status === "resolved");

  return (
    <div className="flex flex-col h-full p-2 overflow-y-auto">
      {pendingSelection && (
        <div className="mb-3 p-2 bg-yellow-50 border border-yellow-300 rounded">
          <p className="text-xs text-gray-500 mb-1">선택: "{pendingSelection.selectedText}"</p>
          <textarea autoFocus value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="코멘트를 입력하세요..." rows={3}
            className="w-full text-xs p-1 border border-gray-300 rounded resize-none text-gray-900 bg-white" />
          <button onClick={handleSubmit} className="mt-1 w-full py-1 bg-blue-600 text-white text-xs rounded">메모 추가</button>
        </div>
      )}
      {open.map(c => (
        <CommentCard key={c.id} comment={c} isActive={activeCommentId === c.id}
          onClick={() => onCommentClick(c.id)} onResolve={onResolve} onUnresolve={onUnresolve} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {resolved.length > 0 && (
        <>
          <p className="text-xs text-gray-400 mt-2 mb-1">해결됨 ({resolved.length})</p>
          {resolved.map(c => (
            <CommentCard key={c.id} comment={c} isActive={false}
              onClick={() => onCommentClick(c.id)} onResolve={onResolve} onUnresolve={onUnresolve} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </>
      )}
      {comments.length === 0 && !pendingSelection && (
        <p className="text-xs text-gray-400 text-center mt-4">텍스트를 드래그해서 코멘트를 추가하세요</p>
      )}
    </div>
  );
}
