export type BlockType = "text" | "mockup";
export type CommentStatus = "open" | "resolved";

export interface Block {
  id: string;
  type: BlockType;
  content?: string;
  title?: string;
  imageUrl?: string | null;
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
