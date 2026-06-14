import { NextResponse } from "next/server";
import { readDocument, writeDocument, deleteDocument, readProjects, writeProjects } from "@/lib/planning/fileSystem";

export async function GET(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(doc);
}

export async function PUT(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const version = doc.versions[doc.currentVersion];
  if (body.blocks !== undefined) version.blocks = body.blocks;
  if (body.comments !== undefined) version.comments = body.comments;
  if (body.name !== undefined) {
    doc.name = body.name;
    const data = readProjects();
    for (const project of data.projects)
      for (const cat of project.categories) {
        const ref = cat.documents.find(d => d.id === docId);
        if (ref) ref.name = body.name;
      }
    writeProjects(data);
  }
  doc.updatedAt = new Date().toISOString();
  writeDocument(doc);
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const data = readProjects();
  for (const project of data.projects) {
    for (const cat of project.categories) {
      cat.documents = cat.documents.filter(d => d.id !== docId);
    }
  }
  writeProjects(data);
  deleteDocument(docId);
  return NextResponse.json({ ok: true });
}
