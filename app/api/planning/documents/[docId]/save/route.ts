import { NextResponse } from "next/server";
import { readDocument, writeDocument, nextVersionKey } from "@/lib/planning/fileSystem";

export async function POST(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const changes: string[] = body.changes ?? [];
  const currentData = doc.versions[doc.currentVersion];
  const newKey = nextVersionKey(doc.versions);
  const blocks = body.blocks !== undefined ? body.blocks : currentData.blocks;
  const comments = body.comments !== undefined ? body.comments : currentData.comments;
  doc.versions[newKey] = {
    createdAt: new Date().toISOString(),
    changes,
    blocks: JSON.parse(JSON.stringify(blocks)),
    comments: JSON.parse(JSON.stringify(comments)),
  };
  doc.currentVersion = newKey;
  doc.updatedAt = new Date().toISOString();
  writeDocument(doc);
  return NextResponse.json(doc);
}
