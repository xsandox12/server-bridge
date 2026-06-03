"use client";

import type { Block, Comment } from "@/lib/planning/types";

interface Props {
  block: Block;
  comments: Comment[];
  onTextSelect: (blockId: string, selectedText: string, startOffset: number, endOffset: number) => void;
  onCommentClick: (commentId: string) => void;
}

interface Segment { text: string; commentId: string | null; }

function buildSegments(content: string, comments: Comment[]): Segment[] {
  const open = comments.filter((c) => c.status === "open").sort((a, b) => a.startOffset - b.startOffset);
  if (open.length === 0) return [{ text: content, commentId: null }];
  const segs: Segment[] = [];
  let pos = 0;
  for (const c of open) {
    const start = Math.max(c.startOffset, pos);
    const end = Math.min(c.endOffset, content.length);
    if (start >= end) continue;
    if (start > pos) segs.push({ text: content.slice(pos, start), commentId: null });
    segs.push({ text: content.slice(start, end), commentId: c.id });
    pos = end;
  }
  if (pos < content.length) segs.push({ text: content.slice(pos), commentId: null });
  return segs;
}

export default function TextBlock({ block, comments, onTextSelect, onCommentClick }: Props) {
  const blockComments = comments.filter((c) => c.blockId === block.id);
  const segments = buildSegments(block.content ?? "", blockComments);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const selectedText = sel.toString().trim();
    if (!selectedText) return;
    const range = sel.getRangeAt(0);
    const container = document.getElementById(`block-${block.id}`);
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    const endOffset = startOffset + selectedText.length;
    onTextSelect(block.id, selectedText, startOffset, endOffset);
    sel.removeAllRanges();
  }

  return (
    <div className="py-3 px-1">
      <p id={`block-${block.id}`} className="text-sm text-gray-800 leading-relaxed cursor-text select-text" onMouseUp={handleMouseUp}>
        {segments.map((seg, i) =>
          seg.commentId ? (
            <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>
    </div>
  );
}
