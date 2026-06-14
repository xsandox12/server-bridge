export type BlockType =
  | "text"
  | "heading1" | "heading2" | "heading3"
  | "paragraph"
  | "bullet" | "numbered"
  | "callout" | "quote"
  | "divider" | "code"
  | "mockup";

export type CommentStatus = "open" | "resolved";

export type CanvasShape =
  | { type: "pen"; points: [number, number][]; stroke: string; width: number }
  | { type: "rect"; x: number; y: number; w: number; h: number; stroke: string; fill: string }
  | { type: "circle"; cx: number; cy: number; r: number; stroke: string; fill: string }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string }
  | { type: "text"; x: number; y: number; text: string; color: string; size: number }
  | { type: "eraser"; points: [number, number][] };

export interface Block {
  id: string;
  type: BlockType;
  content?: string;
  title?: string;
  imageUrl?: string | null;
  language?: string;
}

export interface Comment {
  id: string;
  blockId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  content: string;
  status: CommentStatus;
  createdAt: string;
}

export interface DocumentVersion {
  createdAt: string;
  changes: string[];
  blocks: Block[];
  comments: Comment[];
}

export interface PlanDocument {
  id: string;
  name: string;
  projectId: string;
  categoryId: string;
  currentVersion: string;
  createdAt: string;
  updatedAt: string;
  versions: Record<string, DocumentVersion>;
}

export interface DocRef {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  documents: DocRef[];
}

export interface PlanProject {
  id: string;
  name: string;
  createdAt: string;
  categories: Category[];
}

export interface ProjectsData {
  projects: PlanProject[];
}
