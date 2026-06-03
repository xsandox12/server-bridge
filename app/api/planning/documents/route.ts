import { NextResponse } from "next/server";
import { readProjects, writeProjects, writeDocument, nextVersionKey } from "@/lib/planning/fileSystem";
import type { PlanDocument } from "@/lib/planning/types";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  const body = await req.json();
  const { projectId, categoryId, name } = body;

  const data = readProjects();
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  const category = project.categories.find((c) => c.id === categoryId);
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const docId = nanoid();
  const versionKey = nextVersionKey({});
  const now = new Date().toISOString();

  const doc: PlanDocument = {
    id: docId,
    name,
    projectId,
    categoryId,
    currentVersion: versionKey,
    createdAt: now,
    updatedAt: now,
    versions: {
      [versionKey]: {
        createdAt: now,
        changes: ["초기 생성"],
        blocks: [{ id: nanoid(), type: "text", content: "기획서 작성" }],
        comments: [],
      },
    },
  };

  writeDocument(doc);
  category.documents.push({ id: docId, name });
  writeProjects(data);
  return NextResponse.json(doc);
}
