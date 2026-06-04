"use client";

import { useState } from "react";
import type { PlanDocument } from "@/lib/planning/types";

interface Props {
  doc: PlanDocument;
  previewVersion: string | null;
  onPreviewVersion: (version: string | null) => void;
  onDeleteVersion: (version: string) => void;
}

export default function VersionPanel({ doc, previewVersion, onPreviewVersion, onDeleteVersion }: Props) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const versionKeys = Object.keys(doc.versions).sort((a, b) =>
    doc.versions[b].createdAt.localeCompare(doc.versions[a].createdAt)
  );

  return (
    <div className="flex flex-col h-full p-2">
      <div className="flex-1 overflow-y-auto">
        <button onClick={() => onPreviewVersion(null)}
          className={`w-full text-left px-2 py-1 rounded text-sm font-medium mb-1 ${
            previewVersion === null ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-700"
          }`}>
          • 작성중
        </button>
        {previewVersion === null && (
          <div className="ml-4 mb-1">
            {doc.versions[doc.currentVersion].changes.map((c, i) => (
              <p key={i} className="text-xs text-gray-500 py-0.5">• {c}</p>
            ))}
          </div>
        )}
        {versionKeys.filter(k => k !== doc.currentVersion).map(key => {
          const v = doc.versions[key];
          const isPreviewing = previewVersion === key;
          return (
            <div key={key} className="mb-0.5">
              <div className={`flex items-center gap-1 rounded ${isPreviewing ? "bg-yellow-700" : ""}`}>
                <button onClick={() => onPreviewVersion(isPreviewing ? null : key)}
                  className={`flex-1 text-left flex items-center gap-1 px-2 py-1 text-xs ${
                    isPreviewing ? "text-white" : "hover:bg-gray-100 text-gray-700"
                  }`}>
                  <span>{isPreviewing ? "▼" : "▶"}</span>
                  <span>ver.{key}</span>
                </button>
                {confirmDelete === key ? (
                  <span className="flex items-center gap-1 text-xs pr-1">
                    <button onClick={() => { onDeleteVersion(key); setConfirmDelete(null); }}
                      className="text-red-400 hover:text-red-300 px-1">예</button>
                    <button onClick={() => setConfirmDelete(null)}
                      className="text-gray-400 hover:text-gray-200 px-1">취소</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmDelete(key)}
                    className={`px-1 text-sm leading-none ${isPreviewing ? "text-yellow-200 hover:text-red-300" : "text-gray-400 hover:text-red-400"}`}>
                    ×
                  </button>
                )}
              </div>
              {isPreviewing && (
                <div className="ml-4 mt-0.5">
                  {v.changes.map((c, i) => <p key={i} className="text-xs text-gray-500 py-0.5">• {c}</p>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {previewVersion !== null && (
        <p className="mt-2 text-xs text-gray-400 text-center pb-2">수정 후 저장하면 새 버전으로 이어집니다</p>
      )}
    </div>
  );
}
