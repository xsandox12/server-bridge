import { NextResponse } from "next/server";
import { readDocument } from "@/lib/planning/fileSystem";
import { callProvider, type AIProvider } from "@/lib/ai";
import { buildGeneratePrompt, buildRefinePrompt, buildFeedbackPrompt, parseBlocks } from "@/lib/planning/aiPlanner";
import db from "@/lib/db";

type Mode = "generate" | "refine" | "feedback";

interface ProviderRow { name: string; api_key?: string; model?: string; base_url?: string }

function resolveProvider(requested?: string): ProviderRow | null {
  if (requested) {
    const row = db.prepare("SELECT name, api_key, model, base_url FROM ai_providers WHERE name = ?").get(requested) as ProviderRow | undefined;
    if (row) return row;
  }
  const def = db.prepare("SELECT name, api_key, model, base_url FROM ai_providers WHERE is_default = 1").get() as ProviderRow | undefined;
  if (def) return def;
  const claude = db.prepare("SELECT name, api_key, model, base_url FROM ai_providers WHERE name = 'claude'").get() as ProviderRow | undefined;
  return claude ?? null;
}

export async function POST(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const doc = readDocument(docId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json() as { mode: Mode; instruction?: string; provider?: string };
  const { mode, instruction } = body;

  const current = doc.versions[doc.currentVersion];
  const blocks = current.blocks ?? [];
  const openComments = (current.comments ?? []).filter(c => c.status === "open");

  let prompt: string;
  let summary: string;
  let processedCommentIds: string[] = [];

  if (mode === "generate") {
    if (!instruction?.trim()) return NextResponse.json({ error: "instruction required" }, { status: 400 });
    prompt = buildGeneratePrompt(instruction);
    summary = `생성 — ${instruction.slice(0, 40)}`;
  } else if (mode === "refine") {
    if (!instruction?.trim()) return NextResponse.json({ error: "instruction required" }, { status: 400 });
    prompt = buildRefinePrompt(blocks, instruction);
    summary = `다듬기 — ${instruction.slice(0, 40)}`;
  } else if (mode === "feedback") {
    if (openComments.length === 0) return NextResponse.json({ error: "no open comments" }, { status: 400 });
    prompt = buildFeedbackPrompt(blocks, openComments);
    summary = `메모 반영 (${openComments.length}건)`;
    processedCommentIds = openComments.map(c => c.id);
  } else {
    return NextResponse.json({ error: "unknown mode" }, { status: 400 });
  }

  const providerRow = resolveProvider(body.provider);
  if (!providerRow) {
    return NextResponse.json({ error: "설정된 AI 프로바이더가 없습니다. 설정 페이지에서 추가하세요." }, { status: 400 });
  }

  try {
    const rawText = await callProvider(
      { provider: providerRow.name as AIProvider, apiKey: providerRow.api_key, model: providerRow.model, baseUrl: providerRow.base_url },
      prompt,
    );
    const newBlocks = parseBlocks(rawText);
    return NextResponse.json({ blocks: newBlocks, summary, processedCommentIds });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
