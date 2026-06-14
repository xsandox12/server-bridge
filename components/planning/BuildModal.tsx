"use client";

import { useEffect, useMemo, useState } from "react";
import type { Block } from "@/lib/planning/types";
import { blocksToSpec } from "@/lib/planning/toSpec";

interface Project { id: string; name: string; path: string; deploy_cmd: string | null }
interface Provider { id: string; name: string; model: string | null; is_default: number }

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude (Anthropic)",
  gpt: "GPT (OpenAI)",
  gemini: "Gemini (Google)",
  ollama: "Ollama (로컬)",
};

interface Props {
  docName: string;
  blocks: Block[];
  onClose: () => void;
}

export default function BuildModal({ docName, blocks, onClose }: Props) {
  const spec = useMemo(() => blocksToSpec(docName, blocks), [docName, blocks]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [fileFilter, setFileFilter] = useState("");
  const [selectedFile, setSelectedFile] = useState("");
  const [extra, setExtra] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [result, setResult] = useState<{ explanation: string; newContent: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [deployMsg, setDeployMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then((d: Project[]) => {
      setProjects(d);
      if (d.length > 0) setProjectId(d[0].id);
    }).catch(() => {});
    fetch("/api/settings/providers").then(r => r.json()).then((d: Provider[]) => {
      setProviders(d);
      const def = d.find(p => p.is_default === 1) ?? d[0];
      if (def) setProvider(def.name);
    }).catch(() => {});
  }, []);

  // 프로젝트 변경 시 파일 목록 로드
  useEffect(() => {
    if (!project) { setFiles([]); return; }
    setFiles([]); setSelectedFile(""); setResult(null); setApplied(false);
    fetch(`/api/files?path=${encodeURIComponent(project.path)}&recursive=true`)
      .then(r => r.json())
      .then(d => setFiles(d.files ?? []))
      .catch(() => setFiles([]));
  }, [project]);

  const filteredFiles = files.filter(f => !fileFilter || f.toLowerCase().includes(fileFilter.toLowerCase())).slice(0, 100);

  function copySpec() {
    navigator.clipboard.writeText(spec).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadSpec() {
    const blob = new Blob([spec], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${docName || "기획서"}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  async function runAI() {
    if (!selectedFile) return;
    setAiLoading(true); setResult(null); setError(null); setApplied(false);
    const prompt = `다음 기획서 스펙에 맞게 이 파일을 구현/수정해주세요.\n\n[기획서 스펙]\n${spec}\n${extra.trim() ? `\n[추가 지시]\n${extra}` : ""}`;
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider || "claude", prompt, filePath: selectedFile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI 요청 실패");
      if (data.newContent) setResult({ explanation: data.explanation ?? "", newContent: data.newContent });
    } catch (err) {
      setError(String(err instanceof Error ? err.message : err));
    } finally {
      setAiLoading(false);
    }
  }

  async function applyResult() {
    if (!result || !selectedFile) return;
    const res = await fetch("/api/files", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: selectedFile, content: result.newContent }),
    });
    if (res.ok) setApplied(true);
    else setError("파일 적용 실패");
  }

  async function deploy() {
    if (!projectId) return;
    setDeployMsg("배포 요청 중…");
    const res = await fetch("/api/deploy", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const data = await res.json();
    setDeployMsg(res.ok ? `배포 작업 시작됨 (job ${String(data.jobId).slice(0, 8)})` : `배포 실패: ${data.error ?? ""}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 760, maxHeight: "92vh" }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">🛠 제작 — {docName}</h2>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">닫기</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* 1. 스펙 */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-700">① 기획서 스펙 (Markdown)</p>
              <div className="flex gap-1.5">
                <button onClick={copySpec} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700">{copied ? "복사됨 ✓" : "복사"}</button>
                <button onClick={downloadSpec} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 text-gray-700">.md 다운로드</button>
              </div>
            </div>
            <textarea readOnly value={spec} rows={8}
              className="w-full text-xs font-mono p-2 border border-gray-200 rounded bg-gray-50 text-gray-800 resize-none" />
            <p className="text-[11px] text-gray-400 mt-1">외부 코딩 에이전트(Claude Code 등)에 붙여넣어 제작하거나, 아래에서 앱 내 제작을 진행하세요.</p>
          </section>

          {/* 2. 앱 내 제작 */}
          <section className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-700">② 앱 내 제작 (단일 파일)</p>
            <div className="flex gap-2">
              <select value={projectId} onChange={e => setProjectId(e.target.value)}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-800 bg-white">
                {projects.length === 0 && <option value="">프로젝트 없음</option>}
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={provider} onChange={e => setProvider(e.target.value)}
                className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-800 bg-white">
                {providers.length === 0 && <option value="">AI 없음</option>}
                {providers.map(p => (
                  <option key={p.id} value={p.name}>
                    {PROVIDER_LABELS[p.name] ?? p.name}{p.model ? ` · ${p.model}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {project && (
              <>
                <input value={fileFilter} onChange={e => setFileFilter(e.target.value)}
                  placeholder={files.length ? `파일 검색… (${files.length}개)` : "파일 목록 로딩 중 / 없음"}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-800 bg-white" />
                {fileFilter && (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded flex flex-col">
                    {filteredFiles.map(f => (
                      <button key={f} onClick={() => { setSelectedFile(f); setFileFilter(""); }}
                        className="text-left text-xs px-2 py-1 hover:bg-blue-50 text-gray-700 truncate" title={f}>
                        {f.replace(project.path, "").replace(/^[/\\]/, "")}
                      </button>
                    ))}
                    {filteredFiles.length === 0 && <p className="text-xs text-gray-400 px-2 py-2">일치하는 파일 없음</p>}
                  </div>
                )}
                {selectedFile && (
                  <div className="text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 text-blue-700 truncate" title={selectedFile}>
                    📄 {selectedFile.replace(project.path, "").replace(/^[/\\]/, "")}
                  </div>
                )}

                <textarea value={extra} onChange={e => setExtra(e.target.value)}
                  placeholder="추가 지시 (선택) — 예) 이 컴포넌트만 수정해줘"
                  rows={2}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-800 bg-white resize-none" />

                <button onClick={runAI} disabled={aiLoading || !selectedFile}
                  className="w-full py-2 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed">
                  {aiLoading ? "AI 처리 중…" : "✨ AI 코드 생성"}
                </button>
              </>
            )}

            {error && <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap">{error}</div>}

            {result && (
              <div className="flex flex-col gap-2">
                {result.explanation && <div className="text-xs bg-gray-100 rounded p-2 text-gray-600">{result.explanation}</div>}
                <textarea readOnly value={result.newContent} rows={8}
                  className="w-full text-xs font-mono p-2 border border-gray-200 rounded bg-gray-50 text-gray-800 resize-none" />
                <div className="flex gap-2">
                  <button onClick={applyResult} disabled={applied}
                    className="flex-1 py-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-green-600">
                    {applied ? "✓ 적용 완료" : "변경사항 적용"}
                  </button>
                  <button onClick={deploy} disabled={!applied || !project?.deploy_cmd}
                    title={!project?.deploy_cmd ? "deploy_cmd 미설정" : ""}
                    className="flex-1 py-2 text-xs rounded bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed">
                    🚀 배포
                  </button>
                </div>
                {deployMsg && <p className="text-xs text-gray-500">{deployMsg}</p>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
