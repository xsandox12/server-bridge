import type { CanvasShape } from "./types";

export const CANVAS_W = 900;
export const CANVAS_H = 540;

// 도형 배열을 캔버스에 렌더 (MockupEditorModal과 공유)
export function redraw(ctx: CanvasRenderingContext2D, shapes: CanvasShape[]) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  for (const s of shapes) {
    if (!s) continue;
    if (s.type === "pen") {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.stroke; ctx.lineWidth = s.width; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
    } else if (s.type === "rect") {
      ctx.beginPath();
      ctx.strokeStyle = s.stroke; ctx.lineWidth = 1.5;
      ctx.fillStyle = s.fill;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === "circle") {
      ctx.beginPath();
      ctx.strokeStyle = s.stroke; ctx.lineWidth = 1.5;
      ctx.fillStyle = s.fill;
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (s.type === "line") {
      ctx.beginPath();
      ctx.strokeStyle = s.stroke; ctx.lineWidth = 1.5;
      ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
    } else if (s.type === "text") {
      ctx.fillStyle = s.color; ctx.font = `${s.size}px sans-serif`;
      ctx.fillText(s.text, s.x, s.y);
    } else if (s.type === "eraser") {
      for (const [x, y] of s.points) {
        ctx.clearRect(x - 12, y - 12, 24, 24);
      }
    }
  }
}

// 도형 배열 → PNG dataURL (클라이언트 전용 — offscreen canvas 사용)
export function shapesToPng(shapes: CanvasShape[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  redraw(ctx, shapes);
  return canvas.toDataURL("image/png");
}
