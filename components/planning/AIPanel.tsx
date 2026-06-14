"use client";

import { useEffect, useState } from "react";

type Mode = "generate" | "refine" | "feedback";

interface Provider { id: string; name: string; model: string | null; is_default: number }

const PROVIDER_LABELS: Record<string, string> = {
  claude: "Claude (Anthropic)",
  gpt: "GPT (OpenAI)",
  gemini: "Gemini (Google)",
  ollama: "Ollama (로컬)",
};

interface Props {
  openCommentCount: number;
  busy: boolean;
  error: string | null;
  onRun: (mode: Mode, instruction: string, provider: string) => void;
}

export default function AIPanel({ openCommentCount, busy, error, onRun }: Props) {
  const [instruction, setInstruction] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [provider, setProvider] = useState("");

  useEffect(() => {
    fetch("/api/settings/providers").then(r => r.json()).then((d: Provider[]) => {
      setProviders(d);
      const def = d.find(p => p.is_default === 1) ?? d[0];
      if (def) setProvider(def.name);
    }).catch(() => {});
  }, []);

  const run = (mode: Mode) => onRun(mode, instruction, provider);

  return (
    <div className="flex flex-col h-full p-3 overflow-y-auto gap-3">
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1">✨ AI 작성 / 수정</p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          결과는 새 버전으로 저장됩니다. 버전 관리에서 비교·되돌리기 할 수 있어요.
        </p>
      </div>

      <div>
        <label className="text-[11px] text-gray-500 block mb-1">AI 모델</label>
        {providers.length === 0 ? (
          <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded p-1.5">
            연결된 AI가 없습니다. 설정에서 프로바이더를 추가하세요.
          </p>
        ) : (
          <select value={provider} onChange={e => setProvider(e.target.value)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 text-gray-800 bg-white">
            {providers.map(p => (
              <option key={p.id} value={p.name}>
                {PROVIDER_LABELS[p.name] ?? p.name}{p.model ? ` · ${p.model}` : ""}
              </option>
            ))}
          </select>
        )}
      </div>

      <textarea
        value={instruction}
        onChange={e => setInstruction(e.target.value)}
        placeholder={"예) 회원가입 화면 기획서를 써줘\n예) 더 명확하고 간결하게 다듬어줘"}
        rows={5}
        disabled={busy}
        className="w-full text-xs p-2 border border-gray-300 rounded resize-none text-gray-900 bg-white disabled:opacity-50"
      />

      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => run("generate")}
          disabled={busy || !instruction.trim() || !provider}
          className="w-full py-1.5 text-xs rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >📝 생성 (새로 작성)</button>
        <button
          onClick={() => run("refine")}
          disabled={busy || !instruction.trim() || !provider}
          className="w-full py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >✨ 다듬기 (현재 문서 수정)</button>
        <button
          onClick={() => run("feedback")}
          disabled={busy || openCommentCount === 0 || !provider}
          title={openCommentCount === 0 ? "반영할 메모가 없습니다" : ""}
          className="w-full py-1.5 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >💬 메모 반영 ({openCommentCount}건)</button>
      </div>

      {busy && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
          AI 처리 중…
        </div>
      )}
      {error && (
        <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded p-2 whitespace-pre-wrap">{error}</div>
      )}
    </div>
  );
}
