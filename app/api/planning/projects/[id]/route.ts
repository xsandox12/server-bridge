import { NextResponse } from "next/server";
import { readProjects, writeProjects, deleteDocument } from "@/lib/planning/fileSystem";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data = readProjects();
  const project = data.projects.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.name) project.name = body.name;
  writeProjects(data);
  return NextResponse.json(project);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = readProjects();
  const project = data.projects.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  for (const cat of project.categories) {
    for (const doc of cat.documents) deleteDocument(doc.id);
  }
  data.projects = data.projects.filter((p) => p.id !== id);
  writeProjects(data);
  return NextResponse.json({ ok: true });
}
