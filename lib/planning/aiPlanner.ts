import type { Block, Comment } from "./types";

// AI가 출력해야 하는 블록/목업 스키마 설명 (모든 모드 공통)
const SCHEMA_GUIDE = `당신은 제품 기획서를 작성하는 전문가입니다. 결과는 사람이 읽기 쉽게, 목업과 기능 설명이 번갈아 나오도록 구성하세요.

출력은 **반드시** 아래 형식의 JSON 배열(Block[])만, 코드펜스 \`\`\`json ... \`\`\` 안에 담아 반환하세요. 그 외 설명 문장은 코드펜스 밖에 한 줄로만 적습니다.

각 Block 객체:
- id: 문자열 (생략 가능, 생략 시 서버가 부여)
- type: "heading1" | "heading2" | "heading3" | "paragraph" | "bullet" | "numbered" | "callout" | "quote" | "divider" | "code" | "mockup"
- content: 문자열 (대부분의 블록은 텍스트. mockup은 아래 참고. divider는 빈 문자열)
- title: 문자열 (선택, callout 라벨 또는 mockup 제목)

목업(mockup) 블록 작성법:
- type 은 "mockup", title 에 화면 이름.
- content 에는 **CanvasShape 배열을 JSON.stringify 한 문자열**을 넣습니다 (이스케이프된 JSON 문자열).
- imageUrl 은 넣지 마세요 (클라이언트가 자동 생성).
- 캔버스 좌표계는 가로 900 × 세로 540 입니다. 이 범위 안에 배치하세요.
- CanvasShape 종류:
  - {"type":"rect","x":number,"y":number,"w":number,"h":number,"stroke":"#1a1a1a","fill":"rgba(255,255,255,0)"}
  - {"type":"line","x1":number,"y1":number,"x2":number,"y2":number,"stroke":"#1a1a1a"}
  - {"type":"text","x":number,"y":number,"text":"라벨","color":"#1a1a1a","size":16}
  - {"type":"circle","cx":number,"cy":number,"r":number,"stroke":"#1a1a1a","fill":"rgba(255,255,255,0)"}
- 와이어프레임은 rect(영역)+text(라벨) 조합으로 충분히 표현하세요. 헤더/본문/버튼 등을 사각형과 텍스트로 배치합니다.`;

function blocksToReadable(blocks: Block[]): string {
  return JSON.stringify(
    blocks.map(b => ({ id: b.id, type: b.type, content: b.content ?? "", title: b.title })),
    null,
    2,
  );
}

export function buildGeneratePrompt(instruction: string): string {
  return `${SCHEMA_GUIDE}

작성 요청:
${instruction}

위 요청에 맞는 기획서 전체를 Block[] JSON 으로 작성하세요.`;
}

export function buildRefinePrompt(blocks: Block[], instruction: string): string {
  return `${SCHEMA_GUIDE}

현재 기획서(Block[]):
\`\`\`json
${blocksToReadable(blocks)}
\`\`\`

다듬기 요청:
${instruction}

요청에 맞게 전체 기획서를 수정한 Block[] JSON 을 반환하세요. 기존 구조와 내용은 최대한 유지하고, 요청된 부분만 개선하세요. 기존 블록의 id 는 그대로 유지하세요.`;
}

export function buildFeedbackPrompt(blocks: Block[], openComments: Comment[]): string {
  const memos = openComments.map((c, i) => {
    const block = blocks.find(b => b.id === c.blockId);
    return `${i + 1}. [블록 id=${c.blockId}, type=${block?.type ?? "?"}]
   - 지적된 텍스트: "${c.selectedText}"
   - 요청: ${c.content}`;
  }).join("\n");

  return `${SCHEMA_GUIDE}

현재 기획서(Block[]):
\`\`\`json
${blocksToReadable(blocks)}
\`\`\`

다음 피드백 메모들을 반영해 기획서를 수정하세요:
${memos}

각 메모가 가리키는 부분을 요청대로 수정한 전체 Block[] JSON 을 반환하세요. 메모와 무관한 블록은 그대로 두고, 기존 블록의 id 는 유지하세요.`;
}

function genId(): string {
  return Math.random().toString(36).slice(2);
}

// 원시 응답 텍스트에서 Block[] 추출 (코드펜스 / 순수 JSON 모두 처리)
export function parseBlocks(rawText: string): Block[] {
  let jsonText = rawText.trim();

  // ```json ... ``` 코드펜스 우선 추출
  const fenceMatch = jsonText.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  } else {
    // 첫 '[' 부터 마지막 ']' 까지
    const start = jsonText.indexOf("[");
    const end = jsonText.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      jsonText = jsonText.slice(start, end + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI 응답을 JSON으로 파싱하지 못했습니다.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("AI 응답이 Block 배열 형식이 아닙니다.");
  }

  return (parsed as Partial<Block>[])
    .filter(Boolean)
    .map(b => ({
      id: b.id && typeof b.id === "string" ? b.id : genId(),
      type: b.type ?? "paragraph",
      content: b.content ?? "",
      ...(b.title !== undefined ? { title: b.title } : {}),
      ...(b.imageUrl !== undefined ? { imageUrl: b.imageUrl } : {}),
      ...(b.language !== undefined ? { language: b.language } : {}),
    } as Block));
}
