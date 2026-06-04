import { NextResponse } from "next/server";
import { readProjects, writeProjects, deleteDocument } from "@/lib/planning/fileSystem";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const { id, catId } = await params;
  const data = readProjects();
  const project = data.projects.find((p) => p.id === id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cat = project.categories.find((c) => c.id === catId);
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  for (const doc of cat.documents) deleteDocument(doc.id);
  project.categories = project.categories.filter((c) => c.id !== catId);
  writeProjects(data);
  return NextResponse.json({ ok: true });
}
