"use client";

import type { Block, Comment } from "@/lib/planning/types";
import TextBlock from "./TextBlock";
import MockupBlock from "./MockupBlock";

interface Props {
  blocks: Block[];
  comments: Comment[];
  onTextSelect: (blockId: string, selectedText: string, startOffset: number, endOffset: number) => void;
  onCommentClick: (commentId: string) => void;
}

export default function EditorContent({ blocks, comments, onTextSelect, onCommentClick }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        기획서 내용이 없습니다. Claude Code에서 블록을 추가해주세요.
      </div>
    );
  }
  return (
    <div className="py-4">
      {blocks.map(block => {
        const blockComments = comments.filter(c => c.blockId === block.id);
        return (
          <div key={block.id} className="border-b border-dashed border-gray-200 last:border-0">
            {block.type === "text"
              ? <TextBlock block={block} comments={blockComments} onTextSelect={onTextSelect} onCommentClick={onCommentClick} />
              : <MockupBlock block={block} />
            }
          </div>
        );
      })}
    </div>
  );
}
