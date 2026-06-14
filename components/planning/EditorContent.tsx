"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Block, BlockType, Comment } from "@/lib/planning/types";
import MockupBlock from "./MockupBlock";
import MockupEditorModal from "./MockupEditorModal";
import SlashMenu from "./SlashMenu";

interface Segment { text: string; commentId: string | null; }

function buildSegments(content: string, comments: Comment[]): Segment[] {
  const open = comments.filter(c => c.status === "open").sort((a, b) => a.startOffset - b.startOffset);
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

function newBlock(type: BlockType = "paragraph"): Block {
  return { id: Math.random().toString(36).slice(2), type, content: "" };
}

function isTextBlock(type: BlockType) {
  return type !== "divider" && type !== "mockup";
}

interface Props {
  blocks: Block[];
  comments: Comment[];
  onBlocksChange?: (blocks: Block[]) => void;
  onTextSelect: (blockId: string, selectedText: string, startOffset: number, endOffset: number) => void;
  onCommentClick: (commentId: string) => void;
  readOnly?: boolean;
}

export default function EditorContent({
  blocks: initialBlocks,
  comments,
  onBlocksChange,
  onTextSelect,
  onCommentClick,
  readOnly = false,
}: Props) {
  const [blocks, setBlocks] = useState<Block[]>(() =>
    initialBlocks.length > 0 ? initialBlocks : [newBlock("paragraph")]
  );
  const [slashMenu, setSlashMenu] = useState<{ blockId: string; top: number; left: number } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [commentBtn, setCommentBtn] = useState<{ blockId: string; start: number; end: number; text: string; x: number; y: number } | null>(null);
  const [openMockupId, setOpenMockupId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const prevBlocksRef = useRef<Block[]>(initialBlocks);
  const suppressChangeRef = useRef(false);

  // Sync from parent when initialBlocks changes externally (version switch)
  useEffect(() => {
    if (suppressChangeRef.current) return;
    const prev = prevBlocksRef.current;
    if (JSON.stringify(prev) !== JSON.stringify(initialBlocks)) {
      prevBlocksRef.current = initialBlocks;
      setBlocks(initialBlocks.length > 0 ? initialBlocks : [newBlock("paragraph")]);
    }
  }, [initialBlocks]);

  const emit = useCallback((updated: Block[]) => {
    suppressChangeRef.current = true;
    prevBlocksRef.current = updated;
    onBlocksChange?.(updated);
    setTimeout(() => { suppressChangeRef.current = false; }, 50);
  }, [onBlocksChange]);

  function update(updated: Block[]) {
    setBlocks(updated);
    emit(updated);
  }

  function updateBlock(id: string, partial: Partial<Block>) {
    update(blocks.map(b => b.id === id ? { ...b, ...partial } : b));
  }

  function insertAfter(index: number, type: BlockType = "paragraph") {
    const nb = newBlock(type);
    const next = [...blocks.slice(0, index + 1), nb, ...blocks.slice(index + 1)];
    update(next);
    setTimeout(() => {
      if (isTextBlock(type)) textareaRefs.current[nb.id]?.focus();
    }, 0);
    return nb;
  }

  function deleteBlock(index: number) {
    if (blocks.length <= 1) {
      update([newBlock("paragraph")]);
      return;
    }
    const next = blocks.filter((_, i) => i !== index);
    update(next);
    const focusIndex = Math.max(0, index - 1);
    setTimeout(() => {
      const target = next[focusIndex];
      if (target && isTextBlock(target.type)) {
        const ta = textareaRefs.current[target.id];
        if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
      }
    }, 0);
  }

  function moveBlock(index: number, direction: "up" | "down") {
    const next = [...blocks];
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    update(next);
  }

  function autoResize(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>, block: Block, index: number) {
    const ta = e.currentTarget;

    if (e.key === "Enter" && block.type !== "code") {
      e.preventDefault();
      setSlashMenu(null);
      insertAfter(index, block.type === "bullet" ? "bullet" : block.type === "numbered" ? "numbered" : "paragraph");
      return;
    }

    if (e.key === "Backspace" && ta.value === "") {
      e.preventDefault();
      setSlashMenu(null);
      deleteBlock(index);
      return;
    }

    if (e.key === "/" && ta.value === "") {
      e.preventDefault();
      const rect = ta.getBoundingClientRect();
      setSlashMenu({ blockId: block.id, top: rect.bottom + 4, left: rect.left });
      return;
    }

    if (e.key === "Escape") {
      setSlashMenu(null);
    }
  }

  function handleSlashSelect(type: BlockType) {
    if (!slashMenu) return;
    setSlashMenu(null);
    if (type === "mockup") {
      updateBlock(slashMenu.blockId, { type, content: "", imageUrl: null });
      setOpenMockupId(slashMenu.blockId);
      return;
    }
    updateBlock(slashMenu.blockId, { type, content: "" });
    setTimeout(() => {
      if (isTextBlock(type)) textareaRefs.current[slashMenu.blockId]?.focus();
    }, 0);
  }

  function handleTextSelect(block: Block) {
    if (readOnly) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const selectedText = sel.toString().trim();
    if (!selectedText) return;
    const range = sel.getRangeAt(0);
    const container = document.getElementById(`block-ro-${block.id}`);
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    const preRange = document.createRange();
    preRange.setStart(container, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preRange.toString().length;
    onTextSelect(block.id, selectedText, startOffset, startOffset + selectedText.length);
    sel.removeAllRanges();
  }

  // 편집 모드: textarea 선택 → 떠다니는 코멘트 버튼
  function handleTextareaSelect(e: React.SyntheticEvent<HTMLTextAreaElement>, block: Block) {
    if (readOnly) return;
    const ta = e.currentTarget;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) { setCommentBtn(null); return; }
    const text = (block.content ?? "").slice(start, end).trim();
    if (!text) { setCommentBtn(null); return; }
    const me = e as React.MouseEvent<HTMLTextAreaElement>;
    const x = typeof me.clientX === "number" && me.clientX > 0 ? me.clientX : ta.getBoundingClientRect().right;
    const y = typeof me.clientY === "number" && me.clientY > 0 ? me.clientY : ta.getBoundingClientRect().top;
    setCommentBtn({ blockId: block.id, start, end, text, x, y });
  }

  function commitComment() {
    if (!commentBtn) return;
    onTextSelect(commentBtn.blockId, commentBtn.text, commentBtn.start, commentBtn.end);
    setCommentBtn(null);
  }

  const BLOCK_CLS: Record<string, string> = {
    heading1: "text-3xl font-bold text-gray-900",
    heading2: "text-xl font-semibold text-gray-800",
    heading3: "text-base font-semibold text-gray-700",
    text: "text-sm leading-relaxed text-gray-800",
    paragraph: "text-sm leading-relaxed text-gray-800",
    bullet: "text-sm leading-relaxed text-gray-800",
    numbered: "text-sm leading-relaxed text-gray-800",
    callout: "text-sm text-gray-800",
    quote: "text-sm italic text-gray-700",
    code: "text-sm font-mono text-gray-800",
  };

  function renderReadOnly(block: Block) {
    const blockComments = comments.filter(c => c.blockId === block.id);
    const segs = buildSegments(block.content ?? "", blockComments);
    const cls = BLOCK_CLS[block.type] ?? "text-sm text-gray-800";

    if (block.type === "divider") return <hr className="border-gray-300 my-2" />;
    if (block.type === "mockup") return <MockupBlock block={block} readOnly />;

    const inner = (
      <p
        id={`block-ro-${block.id}`}
        className={`${cls} cursor-text select-text whitespace-pre-wrap`}
        onMouseUp={() => handleTextSelect(block)}
      >
        {segs.map((seg, i) => seg.commentId
          ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
          : <span key={i}>{seg.text}</span>
        )}
      </p>
    );

    if (block.type === "callout") return (
      <div className="bg-gray-100 rounded-lg px-4 py-3 flex gap-2.5">
        <span className="text-lg shrink-0">💡</span>{inner}
      </div>
    );
    if (block.type === "quote") return (
      <div className="border-l-4 border-gray-400 pl-4 py-1">{inner}</div>
    );
    if (block.type === "code") return (
      <pre className="bg-gray-100 rounded p-3 overflow-x-auto"><code className="text-sm font-mono">{block.content}</code></pre>
    );
    if (block.type === "bullet") return (
      <div className="flex gap-2"><span className="shrink-0 text-gray-500">•</span>{inner}</div>
    );
    if (block.type === "numbered") {
      // index computed at call site
      return inner;
    }
    return inner;
  }

  function renderEditable(block: Block, index: number) {
    const cls = BLOCK_CLS[block.type] ?? "text-sm text-gray-800";

    if (block.type === "divider") {
      return (
        <div className="py-3 flex items-center gap-2">
          <hr className="flex-1 border-gray-300" />
          <span className="text-xs text-gray-300">구분선</span>
          <hr className="flex-1 border-gray-300" />
        </div>
      );
    }

    if (block.type === "mockup") {
      return (
        <MockupBlock
          block={block}
          onUpdate={(id, partial) => updateBlock(id, partial)}
        />
      );
    }

    const textarea = (
      <textarea
        ref={el => { textareaRefs.current[block.id] = el; }}
        value={block.content ?? ""}
        onChange={e => {
          updateBlock(block.id, { content: e.target.value });
          autoResize(e.target);
        }}
        onKeyDown={e => handleKeyDown(e, block, index)}
        onFocus={e => autoResize(e.target)}
        onMouseUp={e => handleTextareaSelect(e, block)}
        onSelect={e => handleTextareaSelect(e, block)}
        placeholder={block.type === "heading1" ? "제목 1" : block.type === "heading2" ? "제목 2" : block.type === "heading3" ? "제목 3" : block.type === "code" ? "코드 입력..." : "내용 입력... (/ 로 블록 유형 변경)"}
        rows={1}
        className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder-gray-300 ${cls}`}
        style={{ height: "auto" }}
      />
    );

    if (block.type === "callout") return (
      <div className="bg-gray-100 rounded-lg px-4 py-3 flex gap-2.5">
        <span className="text-lg shrink-0">💡</span>
        <div className="flex-1">{textarea}</div>
      </div>
    );
    if (block.type === "quote") return (
      <div className="border-l-4 border-gray-400 pl-4 py-1">{textarea}</div>
    );
    if (block.type === "code") return (
      <div className="bg-gray-100 rounded p-3">
        <textarea
          ref={el => { textareaRefs.current[block.id] = el; }}
          value={block.content ?? ""}
          onChange={e => { updateBlock(block.id, { content: e.target.value }); autoResize(e.target); }}
          onKeyDown={e => { if (e.key === "Escape") setSlashMenu(null); }}
          onFocus={e => autoResize(e.target)}
          placeholder="코드 입력..."
          rows={3}
          className="w-full resize-none overflow-hidden bg-transparent outline-none text-sm font-mono text-gray-800 placeholder-gray-300"
          style={{ height: "auto" }}
        />
      </div>
    );
    if (block.type === "bullet") return (
      <div className="flex gap-2 items-start">
        <span className="shrink-0 text-gray-500 mt-0.5">•</span>
        <div className="flex-1">{textarea}</div>
      </div>
    );
    if (block.type === "numbered") {
      const numIdx = blocks.slice(0, index).filter(b => b.type === "numbered").length + 1;
      return (
        <div className="flex gap-2 items-start">
          <span className="shrink-0 text-gray-500 mt-0.5 text-sm w-5 text-right">{numIdx}.</span>
          <div className="flex-1">{textarea}</div>
        </div>
      );
    }
    return textarea;
  }

  if (readOnly) {
    let numIdx = 0;
    return (
      <div className="py-4">
        {blocks.map(block => {
          if (block.type === "numbered") numIdx++;
          else numIdx = 0;
          const blockComments = comments.filter(c => c.blockId === block.id);
          const segs = buildSegments(block.content ?? "", blockComments);
          const cls = BLOCK_CLS[block.type] ?? "text-sm text-gray-800";

          return (
            <div key={block.id} className="border-b border-dashed border-gray-100 last:border-0 py-2">
              {block.type === "divider" && <hr className="border-gray-300 my-1" />}
              {block.type === "mockup" && <MockupBlock block={block} readOnly />}
              {block.type === "code" && (
                <pre className="bg-gray-100 rounded p-3 overflow-x-auto">
                  <code className="text-sm font-mono">{block.content}</code>
                </pre>
              )}
              {block.type === "callout" && (
                <div className="bg-gray-100 rounded-lg px-4 py-3 flex gap-2.5">
                  <span className="text-lg shrink-0">💡</span>
                  <p id={`block-ro-${block.id}`} className={`${cls} cursor-text select-text whitespace-pre-wrap`} onMouseUp={() => handleTextSelect(block)}>
                    {segs.map((seg, i) => seg.commentId
                      ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
                      : <span key={i}>{seg.text}</span>)}
                  </p>
                </div>
              )}
              {block.type === "quote" && (
                <div className="border-l-4 border-gray-400 pl-4 py-1">
                  <p id={`block-ro-${block.id}`} className={`${cls} cursor-text select-text whitespace-pre-wrap`} onMouseUp={() => handleTextSelect(block)}>
                    {segs.map((seg, i) => seg.commentId
                      ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
                      : <span key={i}>{seg.text}</span>)}
                  </p>
                </div>
              )}
              {block.type === "bullet" && (
                <div className="flex gap-2">
                  <span className="shrink-0 text-gray-500">•</span>
                  <p id={`block-ro-${block.id}`} className={`${cls} cursor-text select-text whitespace-pre-wrap`} onMouseUp={() => handleTextSelect(block)}>
                    {segs.map((seg, i) => seg.commentId
                      ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
                      : <span key={i}>{seg.text}</span>)}
                  </p>
                </div>
              )}
              {block.type === "numbered" && (
                <div className="flex gap-2">
                  <span className="shrink-0 text-gray-500 text-sm w-5 text-right">{numIdx}.</span>
                  <p id={`block-ro-${block.id}`} className={`${cls} cursor-text select-text whitespace-pre-wrap`} onMouseUp={() => handleTextSelect(block)}>
                    {segs.map((seg, i) => seg.commentId
                      ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
                      : <span key={i}>{seg.text}</span>)}
                  </p>
                </div>
              )}
              {!["divider","mockup","code","callout","quote","bullet","numbered"].includes(block.type) && (
                <p id={`block-ro-${block.id}`} className={`${cls} cursor-text select-text whitespace-pre-wrap`} onMouseUp={() => handleTextSelect(block)}>
                  {segs.map((seg, i) => seg.commentId
                    ? <span key={i} className="comment-highlight cursor-pointer" onClick={() => onCommentClick(seg.commentId!)}>{seg.text}</span>
                    : <span key={i}>{seg.text}</span>)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Edit mode
  return (
    <div className="py-4" onClick={() => {
      // click on empty area → focus last block
      if (blocks.length > 0) {
        const last = blocks[blocks.length - 1];
        if (isTextBlock(last.type)) textareaRefs.current[last.id]?.focus();
      }
    }}>
      {blocks.map((block, index) => {
        const blockOpenComments = comments.filter(c => c.blockId === block.id && c.status === "open");
        return (
        <div
          key={block.id}
          className="relative group py-1"
          onMouseEnter={() => setHoveredId(block.id)}
          onMouseLeave={() => setHoveredId(null)}
          onClick={e => e.stopPropagation()}
        >
          {/* 호버 툴바 */}
          {hoveredId === block.id && (
            <div className="absolute right-0 top-0 flex items-center gap-0.5 z-10 bg-white border border-gray-200 rounded shadow-sm px-1 py-0.5">
              {blockOpenComments.length > 0 && (
                <button title="코멘트 보기" onClick={() => onCommentClick(blockOpenComments[0].id)} className="text-xs text-amber-500 hover:text-amber-600 px-1">💬 {blockOpenComments.length}</button>
              )}
              <button title="위로" onClick={() => moveBlock(index, "up")} className="text-xs text-gray-400 hover:text-gray-700 px-1">↑</button>
              <button title="아래로" onClick={() => moveBlock(index, "down")} className="text-xs text-gray-400 hover:text-gray-700 px-1">↓</button>
              <button title="삭제" onClick={() => deleteBlock(index)} className="text-xs text-red-400 hover:text-red-600 px-1">×</button>
            </div>
          )}
          {/* 코멘트 배지 (비호버 시) */}
          {hoveredId !== block.id && blockOpenComments.length > 0 && (
            <button title="코멘트 보기" onClick={() => onCommentClick(blockOpenComments[0].id)}
              className="absolute right-0 top-0 z-10 text-xs text-amber-500 hover:text-amber-600 px-1">💬 {blockOpenComments.length}</button>
          )}
          {renderEditable(block, index)}
        </div>
        );
      })}

      {/* 빈 공간 클릭 → 새 블록 */}
      <div
        className="py-6 cursor-text"
        onClick={e => {
          e.stopPropagation();
          const last = blocks[blocks.length - 1];
          if (last && isTextBlock(last.type) && last.content === "") {
            textareaRefs.current[last.id]?.focus();
          } else {
            insertAfter(blocks.length - 1);
          }
        }}
      >
        <p className="text-gray-300 text-sm select-none">클릭하여 블록 추가... (/ 로 블록 유형 선택)</p>
      </div>

      {slashMenu && (
        <SlashMenu
          position={{ top: slashMenu.top, left: slashMenu.left }}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}

      {commentBtn && (
        <button
          onMouseDown={e => { e.preventDefault(); commitComment(); }}
          className="fixed z-50 text-xs px-2 py-1 rounded bg-gray-900 text-white shadow-lg hover:bg-gray-700 flex items-center gap-1"
          style={{ top: commentBtn.y + 8, left: commentBtn.x }}
        >💬 코멘트</button>
      )}

      {openMockupId && blocks.find(x => x.id === openMockupId) && (
        <MockupEditorModal
          initialContent={blocks.find(x => x.id === openMockupId)!.content}
          initialTitle={blocks.find(x => x.id === openMockupId)!.title}
          onSave={(content: string, imageUrl: string, title: string) => {
            updateBlock(openMockupId, { content, imageUrl, title });
            setOpenMockupId(null);
          }}
          onClose={() => setOpenMockupId(null)}
        />
      )}
    </div>
  );
}
