import fs from "fs";
import path from "path";
import type { ProjectsData, PlanDocument } from "./types";

const BASE = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DATA_DIR = path.join(BASE, "planning");
const PROJECTS_FILE = path.join(DATA_DIR, "projects.json");
const DOCUMENTS_DIR = path.join(DATA_DIR, "documents");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function readProjects(): ProjectsData {
  ensureDir(DATA_DIR);
  if (!fs.existsSync(PROJECTS_FILE)) {
    const empty: ProjectsData = { projects: [] };
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(PROJECTS_FILE, "utf-8"));
}

export function writeProjects(data: ProjectsData): void {
  ensureDir(DATA_DIR);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2));
}

export function readDocument(docId: string): PlanDocument | null {
  ensureDir(DOCUMENTS_DIR);
  const file = path.join(DOCUMENTS_DIR, `${docId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function writeDocument(doc: PlanDocument): void {
  ensureDir(DOCUMENTS_DIR);
  const file = path.join(DOCUMENTS_DIR, `${doc.id}.json`);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
}

export function deleteDocument(docId: string): void {
  const file = path.join(DOCUMENTS_DIR, `${docId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function nextVersionKey(existing: Record<string, unknown>): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const base = `${yy}${mm}${dd}`;
  let n = 1;
  while (existing[`${base}_${n}`]) n++;
  return `${base}_${n}`;
}
