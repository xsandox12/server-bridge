"use client";

import type { Block } from "@/lib/planning/types";

export default function MockupBlock({ block }: { block: Block }) {
  return (
    <div className="py-3">
      <div className="border border-gray-300 rounded p-4 bg-white min-h-[180px] flex items-center justify-center">
        {block.imageUrl
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={block.imageUrl} alt={block.title ?? "목업"} className="max-w-full" />
          : <p className="text-gray-400 text-sm">{block.title ?? "페이지 목업"}</p>
        }
      </div>
    </div>
  );
}
