"use client";

import { useEffect, useRef, useState, useCallback, useReducer } from "react";
import type { CanvasShape } from "@/lib/planning/types";
import { redraw, CANVAS_W, CANVAS_H } from "@/lib/planning/canvasRender";

type Tool = "pen" | "rect" | "circle" | "line" | "text" | "eraser";

const COLORS = ["#1a1a1a", "#6b7280", "#ef4444", "#3b82f6", "#22c55e"];

interface Props {
  initialContent?: string;
  initialTitle?: string;
  onSave: (content: string, imageUrl: string, title: string) => void;
  onClose: () => void;
}

// --- 히스토리 관리 (undo/redo) ---
interface EditorState {
  shapes: CanvasShape[];
  undone: CanvasShape[]; // redo 스택 (undo된 도형들)
}
type EditorAction =
  | { type: "ADD"; shape: CanvasShape }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "CLEAR" };

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "ADD":
      return { shapes: [...state.shapes, action.shape], undone: [] };
    case "UNDO":
      if (state.shapes.length === 0) return state;
      return {
        shapes: state.shapes.slice(0, -1),
        undone: [...state.undone, state.shapes[state.shapes.length - 1]],
      };
    case "REDO":
      if (state.undone.length === 0) return state;
      return {
        shapes: [...state.shapes, state.undone[state.undone.length - 1]],
        undone: state.undone.slice(0, -1),
      };
    case "CLEAR":
      return { shapes: [], undone: [] };
    default:
      return state;
  }
}

function parseShapes(content?: string): CanvasShape[] {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed.filter(Boolean) as CanvasShape[]) : [];
  } catch {
    return [];
  }
}

export default function MockupEditorModal({ initialContent, initialTitle, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, dispatch] = useReducer(editorReducer, undefined, () => ({
    shapes: parseShapes(initialContent),
    undone: [],
  }));
  const { shapes } = state;

  const [tool, setTool] = useState<Tool>("rect");
  const [color, setColor] = useState(COLORS[0]);
  const [title, setTitle] = useState(initialTitle ?? "");
  const drawing = useRef(false);
  const origin = useRef<[number, number]>([0, 0]);
  const currentPen = useRef<[number, number][]>([]);
  const currentEraser = useRef<[number, number][]>([]);
  const previewShape = useRef<CanvasShape | null>(null);

  const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

  const [textInput, setTextInput] = useState<{ x: number; y: number; canvasX: number; canvasY: number } | null>(null);
  const [textValue, setTextValue] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);

  // shapes 변경 시 캔버스 재드로우
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    redraw(ctx, shapes);
  }, [shapes]);

  // 초기 마운트 시 한 번 드로우
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    redraw(ctx, parseShapes(initialContent));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getPos(e: React.MouseEvent<HTMLCanvasElement>): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const [x, y] = getPos(e);
    if (tool === "text") {
      const rect = canvasRef.current!.getBoundingClientRect();
      setTextInput({ x: e.clientX - rect.left, y: e.clientY - rect.top, canvasX: x, canvasY: y });
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }
    drawing.current = true;
    origin.current = [x, y];
    if (tool === "pen") currentPen.current = [[x, y]];
    if (tool === "eraser") currentEraser.current = [[x, y]];
  }

  const drawPreview = useCallback((shape: CanvasShape) => {
    const ctx = getCtx();
    if (!ctx) return;
    redraw(ctx, shapes);
    ctx.beginPath();
    ctx.globalAlpha = 0.6;
    if (shape.type === "rect") {
      ctx.strokeStyle = shape.stroke; ctx.lineWidth = 1.5; ctx.fillStyle = shape.fill;
      ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
      ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
    } else if (shape.type === "circle") {
      ctx.strokeStyle = shape.stroke; ctx.lineWidth = 1.5; ctx.fillStyle = shape.fill;
      ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (shape.type === "line") {
      ctx.strokeStyle = shape.stroke; ctx.lineWidth = 1.5;
      ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [shapes]);

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const [x, y] = getPos(e);
    const [ox, oy] = origin.current;
    const ctx = getCtx();
    if (!ctx) return;

    if (tool === "pen") {
      currentPen.current.push([x, y]);
      redraw(ctx, shapes);
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.moveTo(currentPen.current[0][0], currentPen.current[0][1]);
      for (let i = 1; i < currentPen.current.length; i++) ctx.lineTo(currentPen.current[i][0], currentPen.current[i][1]);
      ctx.stroke();
    } else if (tool === "eraser") {
      currentEraser.current.push([x, y]);
      // 시각적 피드백: 직접 지우기
      ctx.clearRect(x - 12, y - 12, 24, 24);
    } else if (tool === "rect") {
      const s: CanvasShape = { type: "rect", x: Math.min(ox, x), y: Math.min(oy, y), w: Math.abs(x - ox), h: Math.abs(y - oy), stroke: color, fill: "rgba(255,255,255,0)" };
      previewShape.current = s; drawPreview(s);
    } else if (tool === "circle") {
      const r = Math.sqrt((x - ox) ** 2 + (y - oy) ** 2);
      const s: CanvasShape = { type: "circle", cx: ox, cy: oy, r, stroke: color, fill: "rgba(255,255,255,0)" };
      previewShape.current = s; drawPreview(s);
    } else if (tool === "line") {
      const s: CanvasShape = { type: "line", x1: ox, y1: oy, x2: x, y2: y, stroke: color };
      previewShape.current = s; drawPreview(s);
    }
  }

  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    const [x, y] = getPos(e);
    const [ox, oy] = origin.current;

    if (tool === "pen") {
      if (currentPen.current.length > 1) {
        dispatch({ type: "ADD", shape: { type: "pen", points: [...currentPen.current], stroke: color, width: 2 } });
      }
      currentPen.current = [];
    } else if (tool === "eraser") {
      if (currentEraser.current.length > 0) {
        dispatch({ type: "ADD", shape: { type: "eraser", points: [...currentEraser.current] } });
        currentEraser.current = [];
      }
    } else if (previewShape.current) {
      const shape = previewShape.current;
      previewShape.current = null;
      dispatch({ type: "ADD", shape });
    }
    void x; void y; void ox; void oy;
  }

  function commitText() {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    dispatch({ type: "ADD", shape: { type: "text", x: textInput.canvasX, y: textInput.canvasY, text: textValue, color, size: 16 } });
    setTextInput(null); setTextValue("");
  }

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageUrl = canvas.toDataURL("image/png");
    onSave(JSON.stringify(shapes), imageUrl, title);
  }

  const toolBtn = (t: Tool, label: string) => (
    <button
      key={t}
      onMouseDown={() => setTool(t)}
      className={`px-2.5 py-1 text-xs rounded border ${tool === t ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 text-gray-700 hover:bg-gray-100"}`}
    >{label}</button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col" style={{ width: 980, maxHeight: "95vh" }}>
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-200">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="목업 제목 (선택)"
            className="flex-1 text-sm text-gray-800 outline-none border border-gray-200 rounded px-2 py-1"
          />
          <button onMouseDown={onClose} className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100">취소</button>
          <button onMouseDown={handleSave} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
        </div>

        {/* 툴바 */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 flex-wrap">
          <div className="flex gap-1">
            {toolBtn("pen", "✏️ 펜")}
            {toolBtn("rect", "▭ 사각")}
            {toolBtn("circle", "◯ 원")}
            {toolBtn("line", "— 선")}
            {toolBtn("text", "T 텍스트")}
            {toolBtn("eraser", "⌫ 지우개")}
          </div>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <div className="flex gap-1.5">
            {COLORS.map(c => (
              <button
                key={c}
                onMouseDown={() => setColor(c)}
                className={`w-5 h-5 rounded-full border-2 ${color === c ? "border-blue-500 scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <button
            onMouseDown={() => dispatch({ type: "UNDO" })}
            disabled={shapes.length === 0}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >↩ 취소</button>
          <button
            onMouseDown={() => dispatch({ type: "REDO" })}
            disabled={state.undone.length === 0}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >↪ 다시하기</button>
          <button
            onMouseDown={() => dispatch({ type: "CLEAR" })}
            className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-red-500"
          >🗑 전체 삭제</button>
        </div>

        {/* 캔버스 */}
        <div className="relative flex-1 overflow-auto bg-gray-100 flex items-center justify-center p-4">
          <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              className="border border-gray-300 shadow-sm block"
              style={{ cursor: tool === "eraser" ? "crosshair" : tool === "text" ? "text" : "crosshair", width: CANVAS_W, height: CANVAS_H }}
            />
            {textInput && (
              <input
                ref={textInputRef}
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onBlur={commitText}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitText(); } if (e.key === "Escape") { setTextInput(null); } }}
                className="absolute border border-blue-400 outline-none bg-transparent text-sm px-1"
                style={{ top: textInput.y, left: textInput.x, minWidth: 100, fontSize: 16, color }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
