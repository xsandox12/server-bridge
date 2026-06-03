import { NextResponse } from "next/server";
import { readDocument, writeDocument } from "@/lib/planning/fileSystem";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ docId: string; version: string }> }
) {
  const { docId, version } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const target = doc.versions[version];
  if (!target) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  doc.versions[doc.currentVersion].blocks = JSON.parse(JSON.stringify(target.blocks));
  doc.versions[doc.currentVersion].comments = JSON.parse(JSON.stringify(target.comments));
  doc.updatedAt = new Date().toISOString();
  writeDocument(doc);
  return NextResponse.json(doc);
}
