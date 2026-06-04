import { NextResponse } from "next/server";
import { readDocument, writeDocument } from "@/lib/planning/fileSystem";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ docId: string; version: string }> }
) {
  const { docId, version } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.currentVersion === version)
    return NextResponse.json({ error: "Cannot delete current version" }, { status: 400 });
  if (!doc.versions[version])
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  delete doc.versions[version];
  doc.updatedAt = new Date().toISOString();
  writeDocument(doc);
  return NextResponse.json({ ok: true });
}
