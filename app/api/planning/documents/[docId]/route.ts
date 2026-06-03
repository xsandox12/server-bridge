import { NextResponse } from "next/server";
import { readDocument, writeDocument } from "@/lib/planning/fileSystem";

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
  if (body.name !== undefined) doc.name = body.name;
  doc.updatedAt = new Date().toISOString();
  writeDocument(doc);
  return NextResponse.json(doc);
}
