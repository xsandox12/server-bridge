"use client";

import { useEffect, useRef } from "react";
import type { BlockType } from "@/lib/planning/types";

interface MenuItem {
  type: BlockType;
  label: string;
  icon: string;
  desc: string;
}

const ITEMS: MenuItem[] = [
  { type: "heading1",  icon: "H1", label: "제목 1",   desc: "큰 제목" },
  { type: "heading2",  icon: "H2", label: "제목 2",   desc: "중간 제목" },
  { type: "heading3",  icon: "H3", label: "제목 3",   desc: "작은 제목" },
  { type: "paragraph", icon: "¶",  label: "단락",     desc: "일반 텍스트" },
  { type: "bullet",    icon: "•",  label: "목록",     desc: "글머리 기호 목록" },
  { type: "numbered",  icon: "1.", label: "번호 목록", desc: "번호 매기기 목록" },
  { type: "callout",   icon: "💡", label: "콜아웃",   desc: "강조 박스" },
  { type: "quote",     icon: "❝",  label: "인용",     desc: "인용 블록" },
  { type: "divider",   icon: "—",  label: "구분선",   desc: "수평 구분선" },
  { type: "code",      icon: "</>", label: "코드",    desc: "코드 블록" },
  { type: "mockup",    icon: "🖼", label: "목업",     desc: "캔버스 목업 그리기" },
];

interface Props {
  position: { top: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export default function SlashMenu({ position, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && e.composedPath().includes(ref.current)) return;
      onClose();
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 w-56"
      style={{ top: position.top, left: position.left }}
    >
      <p className="px-3 py-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">블록 유형</p>
      {ITEMS.map(item => (
        <button
          key={item.type}
          onMouseDown={e => { e.preventDefault(); onSelect(item.type); }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-100 text-left"
        >
          <span className="w-6 text-center text-sm font-medium text-gray-600 shrink-0">{item.icon}</span>
          <span className="text-sm text-gray-800">{item.label}</span>
          <span className="text-xs text-gray-400 ml-auto">{item.desc}</span>
        </button>
      ))}
    </div>
  );
}
