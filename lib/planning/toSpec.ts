import type { Block, CanvasShape } from "./types";

function mockupToText(block: Block): string {
  const title = block.title || "목업";
  let shapes: CanvasShape[] = [];
  try {
    if (block.content) shapes = JSON.parse(block.content) as CanvasShape[];
  } catch { /* 파싱 실패 시 빈 목록 */ }

  const lines = [`**목업: ${title}** (캔버스 900×540)`];
  if (Array.isArray(shapes) && shapes.length > 0) {
    for (const s of shapes) {
      if (!s) continue;
      if (s.type === "text") lines.push(`- 텍스트 "${s.text}" @(${Math.round(s.x)}, ${Math.round(s.y)})`);
      else if (s.type === "rect") lines.push(`- 영역 박스 (${Math.round(s.x)}, ${Math.round(s.y)}) ${Math.round(s.w)}×${Math.round(s.h)}`);
      else if (s.type === "line") lines.push(`- 선 (${Math.round(s.x1)}, ${Math.round(s.y1)}) → (${Math.round(s.x2)}, ${Math.round(s.y2)})`);
      else if (s.type === "circle") lines.push(`- 원 중심(${Math.round(s.cx)}, ${Math.round(s.cy)}) 반지름 ${Math.round(s.r)}`);
    }
  } else {
    lines.push("- (도형 정보 없음)");
  }
  return lines.join("\n");
}

// Block[] → 코딩 에이전트가 읽기 좋은 Markdown 스펙
export function blocksToSpec(docName: string, blocks: Block[]): string {
  const out: string[] = [`# ${docName}`, ""];
  let numCounter = 0;

  for (const b of blocks) {
    if (b.type !== "numbered") numCounter = 0;
    const content = b.content ?? "";

    switch (b.type) {
      case "heading1": out.push(`# ${content}`, ""); break;
      case "heading2": out.push(`## ${content}`, ""); break;
      case "heading3": out.push(`### ${content}`, ""); break;
      case "bullet": out.push(`- ${content}`); break;
      case "numbered": numCounter++; out.push(`${numCounter}. ${content}`); break;
      case "callout": out.push(`> 💡 ${b.title ? `**${b.title}** ` : ""}${content}`, ""); break;
      case "quote": out.push(`> ${content}`, ""); break;
      case "divider": out.push("---", ""); break;
      case "code": out.push("```" + (b.language ?? ""), content, "```", ""); break;
      case "mockup": out.push(mockupToText(b), ""); break;
      default: out.push(content, ""); break; // text / paragraph
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
