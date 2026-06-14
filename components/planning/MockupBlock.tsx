"use client";

import { useState } from "react";
import type { Block } from "@/lib/planning/types";
import MockupEditorModal from "./MockupEditorModal";

interface Props {
  block: Block;
  readOnly?: boolean;
  onUpdate?: (id: string, partial: Partial<Block>) => void;
}

export default function MockupBlock({ block, readOnly, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);

  function handleSave(content: string, imageUrl: string, title: string) {
    onUpdate?.(block.id, { content, imageUrl, title });
    setEditing(false);
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500">{block.title || "목업"}</span>
        {!readOnly && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-500 hover:text-blue-700 border border-blue-200 rounded px-2 py-0.5"
          >편집</button>
        )}
      </div>
      <div
        className="border border-gray-300 rounded bg-gray-50 min-h-[180px] flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors"
        onClick={() => !readOnly && setEditing(true)}
      >
        {block.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={block.imageUrl} alt={block.title ?? "목업"} className="max-w-full rounded" />
          : <p className="text-gray-400 text-sm">클릭하여 목업 생성</p>
        }
      </div>
      {editing && (
        <MockupEditorModal
          initialContent={block.content}
          initialTitle={block.title}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
